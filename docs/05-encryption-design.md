# 05 — Encryption Design

This document describes the cryptographic primitives, key hierarchy, rotation, and threat-model assumptions of the keynv crypto stack. The goal: at no point does a single compromise (server, backup file, local disk, OS keychain alone) yield plaintext secrets.

## Library choices

- **libsodium-wrappers** (NaCl primitives): `crypto_secretbox` (XSalsa20-Poly1305) for value encryption, `crypto_secretbox_easy` for sealed wrapping.
- **age-encryption** (or `age` binary wrapper): used to seal the local cache key inside the OS keychain payload. Modern, audited, X25519-based.
- **Node's native `crypto.randomBytes`** for nonces and keys.
- **Argon2id** (via `argon2`) for password-derived KEKs (when applicable).

We do **not** use:
- AES-CBC, AES-ECB, MD5, SHA-1, RSA-PKCS1v1.5, or any mode without authentication.
- Custom crypto. Period.
- JWT for anything carrying a secret.

## Key hierarchy

```
                ┌──────────────────────────────────────────┐
                │  Master KEK (Key Encryption Key)         │
                │  • 32 random bytes                       │
                │  • Generated at server bootstrap         │
                │  • Held by org Owner; loaded via         │
                │    sealed file or HSM (Phase 6) at boot  │
                └────────────────────┬─────────────────────┘
                                     │ wraps
                                     ▼
                ┌──────────────────────────────────────────┐
                │  Per-project DEK (Data Encryption Key)   │
                │  • 32 random bytes per project           │
                │  • Stored wrapped (XSalsa20-Poly1305)    │
                │  • Unwrapped only in server memory while │
                │    handling a request                    │
                └────────────────────┬─────────────────────┘
                                     │ encrypts
                                     ▼
                ┌──────────────────────────────────────────┐
                │  Secret value (per row in `secrets`)     │
                │  • XSalsa20-Poly1305 secretbox           │
                │  • 24-byte random nonce per write        │
                │  • Plaintext never persists outside      │
                │    privileged subprocess memory          │
                └──────────────────────────────────────────┘
```

### Master KEK lifecycle

- **Generation**: at first server bootstrap, `keynv-server bootstrap` generates a 32-byte random KEK.
- **Storage (MVP)**: written to `/etc/keynv/master.key` with mode `0400`, owned by the keynv service user. Loaded into memory at startup; zeroed on shutdown.
- **Storage (Phase 6 commercial)**: backed by AWS KMS / GCP KMS / Vault Transit. The on-disk file is replaced by a wrapper config pointing at the KMS key.
- **Backup**: the bootstrap output prints a one-time recovery code (the KEK in armored form). The Owner is instructed to store it in a separate password manager. Loss of both the on-disk file and the recovery code = **all data unrecoverable**. (We make this explicit in onboarding; no silent recovery.)
- **Rotation**: online KEK rotation is planned but not implemented in the OSS CLI/server yet. The intended design is to generate a new KEK, decrypt and re-encrypt every project DEK with the new KEK, and atomically swap the on-disk file. Cost is O(projects), not O(secrets), because secrets are wrapped by DEKs not the KEK directly. Until this ships, suspected KEK exposure is handled by rebuilding the deployment and re-entering rotated upstream credentials.

### Per-project DEK lifecycle

- **Generation**: a 32-byte random DEK is generated at `project create`. The DEK is wrapped with the master KEK (XSalsa20-Poly1305) and stored in the `projects.dek_wrapped` column.
- **Use**: when a request needs to read/write a secret, the server unwraps the DEK in-process, performs the crypto, and zeroes the unwrapped DEK from memory before returning.
- **Rotation** _(planned — not yet implemented)_: `keynv project rotate-dek <project>` will generate a new DEK, decrypt every secret with the old DEK, re-encrypt with the new DEK in a single transaction, and destroy the old DEK. The CLI command and `POST /v1/projects/:id/rotate-dek` endpoint are not shipped yet; tracked for a later iteration.

### Per-secret value encryption

- **Algorithm**: `crypto_secretbox` (XSalsa20-Poly1305). 24-byte random nonce per write.
- **Storage**: `secrets.ciphertext` (binary) + `secrets.nonce` (24 bytes).
- **AAD**: not currently used; we may add the row id + version as additional data (Phase 5 hardening) to bind ciphertext to context.

## Local-cache encryption (CLI)

The `keynv` CLI keeps an SQLite cache at `~/.keynv/cache.db`. The cache holds wrapped DEKs and ciphertexts so that `keynv exec` works offline for short windows.

- **Cache KEK**: a 32-byte random key, generated at first CLI connection. Stored in the OS keychain (`keytar` abstraction over macOS Keychain / Windows Credential Manager / libsecret).
- **Sealing**: each cache row is sealed with the cache KEK using libsodium `secretbox`. Tampering with the file breaks the seal; the CLI re-fetches.
- **TTL**: default 5 minutes. Configurable per project (`cache_ttl_s` in `.keynv.toml`).
- **Eviction**: on logout, the cache file is overwritten with zeros and unlinked.

## Auth tokens

- **JWTs (HS256)**: short-lived (15 min) bearer tokens signed with a server-side HMAC secret. Carry user id, role, and a token version for revocation.
- **Refresh tokens**: opaque random strings (32 bytes), stored hashed (SHA-256) in DB. Tied to a device fingerprint; rotation on each refresh.
- **Cache-auth tokens**: separate, tighter-scoped (only `secret.read` on a single project). Used by long-running dev sessions.

## Audit-chain integrity

The audit log uses a hash chain:

```
audit[n].hash = SHA-256(audit[n].prev_hash || audit[n].payload_json || audit[n].ts || audit[n].actor_user_id)
audit[0].prev_hash = "0000...000" (32 bytes, zero)
```

`keynv audit verify` walks the chain. A broken chain at row N means rows ≥ N have been tampered with or rows have been deleted. The CLI/UI exposes verification on demand and Phase 5 adds nightly automated verification.

We do **not** sign each audit entry — the hash chain is sufficient for tamper-evidence and avoids per-write asymmetric crypto cost. Phase 6 commercial may add Ed25519 signing of chain checkpoints for non-repudiation across organizations.

## Subprocess argv security

When `keynv exec -- mysql -psecret123 -h host` runs:

- `mysql` is `fork+exec`'d with argv `["mysql", "-psecret123", "-h", "host"]`.
- argv is visible via `/proc/<pid>/cmdline` to processes of the same uid.
- Mitigation 1: subprocess runs with the same uid as the agent; ps-grepping is just-as-bad whether the agent runs the value directly or via keynv. The point is the agent's *LLM context* doesn't see the value.
- Mitigation 2 (opt-in): `keynv exec --stdin` mode pipes the secret through stdin instead of argv. For tools that accept passwords on stdin (`mysql --defaults-extra-file=/dev/fd/N`), this avoids argv exposure entirely.
- Mitigation 3 (Phase 5): ephemeral fd-based credential delivery for tools that accept them (e.g., `MYSQL_PWD` env var that exists only in the subprocess's env, not in the agent's).

We do **not** rely on argv hiding for security against root-level adversaries. The threat model assumes a non-root agent; argv visibility to the same uid is acceptable.

## Memory hygiene

- **Unwrapped keys** (KEK, DEKs) live in `Uint8Array` / `Buffer` and are zeroed (`buf.fill(0)` or libsodium's `memzero`) before being garbage-collected. Server-side, an unwrapped DEK exists only for the duration of a single secret read/write; it is not pooled.
- **Plaintext secret values in crypto paths**: `packages/core` exposes byte-oriented `encryptSecretBytes` / `decryptSecretBytes` APIs and `withDecryptedSecretBytes`, which zeroes decrypted plaintext in a `finally` block after callback use. Server create, batch create, read, rotate, and tester flows use these byte APIs for the encryption/decryption boundary.
- **Remaining string boundaries**: JSON request bodies, JSON responses, CLI command arguments, and tester integrations still require V8-managed strings at the delivery boundary. JS strings are immutable; we cannot guarantee zero-on-discard for those copies. The mitigation is to convert to `Uint8Array` immediately before crypto operations, zero encoded/decrypted buffers after use, avoid caching plaintext, and keep request-scoped lifetime short.
- **CLI credential cache**: the encrypted credential cache now encrypts/decrypts raw credential bytes instead of converting through UTF-8 strings. Returned credential bytes are owned by the caller and must be scoped tightly.
- **Subprocess delivery**: resolved alias values are still strings when constructing argv/env for `keynv exec`, because Node's `spawn()` API accepts strings. After the subprocess exits, the CLI clears its resolved-alias, injected-env, and redactor-literal references. The child process memory is reclaimed by the kernel when it exits. Subprocesses are short-lived by design.

## Backup and restore

- Litestream replicates the SQLite WAL to S3/B2 in real time (RPO ≈ 1 s).
- The replicated file contains only ciphertext + wrapped DEKs. Without the master KEK (held by the org Owner separately), the backup is useless to an attacker.
- Restore: `litestream restore -o keynv.db <s3-url>` then `keynv-server start`. Master KEK is loaded as usual.
- Backups are **encrypted at the application layer** (libsodium-wrapped). We do not require S3-side encryption (though recommend it as defense in depth).
- The operator runbook for RPO/RTO, restore drills, KEK loss, and post-restore validation is [`backup-restore-runbook.md`](./backup-restore-runbook.md).

## Threats we don't fully mitigate

- **Server process memory dump while handling a request**: an attacker with `gcore`/`gdb` access to the server could capture the unwrapped DEK or plaintext mid-request. Mitigation: server runs as dedicated service user; OS hardening responsibility.
- **OS-keychain compromise on dev machine**: if the cache KEK is exfiltrated, all cached ciphertexts are decryptable. Mitigation: cache TTL is short; cache eviction on logout.
- **Cold-boot key extraction**: out of scope.

## Verification

- **Unit tests**: every crypto function has known-answer-tests against libsodium spec vectors.
- **Property tests** (`fast-check`): roundtrip — `decrypt(encrypt(x, k), k) === x` for arbitrary `x`, `k`.
- **Negative tests**: tampered ciphertext, wrong key, wrong nonce → all raise authentication error.
- **Audit-chain tests**: 100K-row synthetic chain verifies; tampering with row N breaks verification at exactly N.
- **Memory zero tests**: unit tests cover byte-oriented secret roundtrips and verify `withDecryptedSecretBytes` zeroes the decrypted buffer on both success and error paths. Manual review is still required for JSON/CLI string boundaries.

The crypto code is contained in `packages/core/src/crypto/`. Changes there require approval from at least two maintainers (Phase 5+).
