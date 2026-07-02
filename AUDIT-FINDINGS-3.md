# keynv Code Health & Improvement Findings (Cycle 3)

> **Reviewed 2026-07-02** — every finding below was verified against source in
> `AUDIT-FINDINGS-4.md` (verdict: 16 CONFIRMED, 4 PARTIALLY, 0 REFUTED). The
> four CRITICAL items (K1, K2, K3→revised HIGH, K4) plus Y1 were fixed in that
> cycle; see `AUDIT-FINDINGS-4.md` for verdicts, corrections, and new findings.

Standalone review cycle (2026-07-02) run after `AUDIT-FINDINGS.md` and
`AUDIT-FINDINGS-2.md` closed their findings. Three parallel exploration
streams re-walked the codebase — (1) structure/architecture, (2) tests/CI/tooling,
(3) core secret-detection & runtime paths — looking for **new** correctness,
security, robustness, and quality gaps.

Unlike the prior cycles, nothing here is fixed yet: this is an **open findings
register**, ordered by severity, for the maintainer to schedule. Every 🔴 CRITICAL
item was **read and confirmed in source during this cycle** (marked `VERIFIED`);
🟠/🟡/🔓 items come from static exploration and are marked accordingly.

Framing note: keynv's core promise is that AI agents never see real secret values
and that leaked copies get scrubbed. So **redaction correctness is the product** —
that is why a partial-redaction gap outranks everything else below.

## Summary

| ID  | Sev      | Area                     | Status   | One-liner |
|-----|----------|--------------------------|----------|-----------|
| K1  | CRITICAL | redactor                 | OPEN · VERIFIED | Overlapping matches drop the tail of a real secret un-redacted |
| K2  | CRITICAL | cli/init                 | OPEN · VERIFIED | `--yes` migration writes misclassified secrets as committable plaintext |
| K3  | CRITICAL | redactor / shell         | OPEN · VERIFIED | Two hand-synced pattern banks drift; new patterns don't protect shell history |
| K4  | CRITICAL | mcp                      | OPEN · VERIFIED | Reference token burned before fetch → transient failure makes it unusable |
| Y1  | HIGH     | redactor                 | OPEN     | O(n²) output rebuild dominates on large scans (the "62,311 secrets" case) |
| Y2  | HIGH     | cli/watcher, mcp         | OPEN · VERIFIED | Unbounded IPC socket line buffers → same-uid memory-exhaustion |
| Y3  | HIGH     | cli/init, text-surfaces  | OPEN     | Same-second/minute backups silently overwrite the previous backup |
| Y4  | HIGH     | cli/init                 | OPEN     | Key normalization collides (`FOO_BAR` vs `FOO-BAR`) → silent overwrite |
| O1  | MEDIUM   | cli/exec                 | OPEN     | Comments claim in-memory "zeroing" that JS strings cannot provide |
| O2  | MEDIUM   | cli/exec                 | OPEN     | `--no-redact` advertised as "Audit-flagged" but no audit call exists |
| O3  | MEDIUM   | redactor                 | OPEN     | Trailing `\b` after `[...-]` classes → false negatives on `-`-terminated tokens |
| O4  | MEDIUM   | server                   | OPEN     | `overdue` query param is dead/duplicate logic |
| O5  | MEDIUM   | server (tests)           | OPEN     | Auth primitives (jwt/password/tokens/middleware/kek) have no focused unit tests |
| O6  | MEDIUM   | cross-cutting            | OPEN     | Hand-duplicated entropy calc, socket-path formula, exclude-prefix lists |
| O7  | MEDIUM   | text-surfaces            | OPEN     | `HISTFILE` honored only when `$SHELL` matches `/bash/` → history missed |
| L1–L6 | LOW    | tooling / hygiene        | OPEN     | Coverage gate, dep automation, dead script, templates, committed files, unbounded logs |

---

## 🔴 CRITICAL — undermine the product's core promise

### K1. Redaction "tail leak" on overlapping matches
**Where:** `packages/redactor/src/batch.ts:84-90` (`redact()` de-overlap loop) — `VERIFIED`

**Why it matters:** matches are sorted by start (longer-on-tie) then de-overlapped:
```js
for (const m of raw) {
  const last = merged[merged.length - 1];
  if (!last || m.start >= last.end) merged.push(m);   // else: dropped entirely
}
```
A later match that overlaps the previous one is **dropped without extending
`last.end`**. If a short pattern hit `[0,20]` overlaps a longer entropy token
`[5,45]`, the entropy match is discarded and characters `[20,45]` — part of a real
secret — survive in cleartext. Entropy spans and pattern spans are computed
independently over the same text, so this partial-overlap shape is reachable. This
function is the single choke point behind `doctor`, `scrub`, `exec` output, and the
`watch` daemon, so the leak surfaces everywhere.

**Suggested fix:** merge intervals instead of dropping —
`else last.end = Math.max(last.end, m.end);` (redact the union span with `last`'s
renderer). One line, strictly safer (only ever redacts *more*). Add a regression test
with a deliberately staggered pattern/entropy overlap.

### K2. `--yes` migration writes misclassified secrets as plaintext
**Where:** `apps/cli/src/commands/init.ts:365-388` (classification), `:366-373` (routing) — `VERIFIED`

**Why it matters:** only `verdict === 'secret'` is added to the `isSecret` set and
routed into the vault; `ambiguous` and `literal` verdicts fall through into
`.keynv.env`, which the tool advertises as "safe to commit" (`exec.ts:37`). In
non-interactive `--yes` mode there is no human gate, so correctness rests entirely on
the `classifyEntry` heuristic — a single false negative lands a real secret as
committable plaintext. Compounding it: `init` leaves the original `.env` as a
`.env.backup` sibling (`init/backup.ts`) that a `.env*`-only `.gitignore` may not
cover.

**Suggested fix:** in `--yes` mode, treat `ambiguous` as `secret` by default (fail
safe), or run the produced `.keynv.env` back through the redactor and hard-warn /
abort if anything matches. Ensure the `.env.backup` path is gitignore-covered.

### K3. Two hand-synchronized secret-pattern banks drift apart
**Where:** `packages/redactor/src/patterns.ts` (canonical) vs `apps/cli/src/shell/templates.ts:45-59` (`SHELL_SECRET_ERE`) — `VERIFIED`

**Why it matters:** the shell history hook embeds its *own* ERE regex bank, kept in
sync by hand — the generated header even instructs users to "re-run `keynv shell
install` after updating keynv (the pattern bank evolves with the redactor)." A
pattern added to the redactor silently does **not** protect shell history until every
user regenerates their hook, and the two engines already diverge (word boundaries,
ordering, ERE vs JS-RegExp semantics). For a preventive control, silent drift is a
real coverage hole.

**Suggested fix:** make one bank canonical and **generate** the shell ERE from it
(build step / codegen), or — minimum — add a CI test that asserts the shell bank
covers the same pattern set and fails on divergence.

### K4. MCP reference token is consumed before the value is fetched
**Where:** `apps/mcp/src/resolver.ts:57-68` (`resolveTokenToValue`) — `VERIFIED`

**Why it matters:** `consumeReferenceToken(token)` (single-use flip) runs *before* the
two `await api.request(...)` calls. If either request throws, or the project lookup
returns no id (`:65` → `null`), the single-use token is already burned. The agent
receives an error and **cannot retry** — a transient network blip permanently
invalidates a valid capability token.

**Suggested fix:** resolve the alias and fetch the value first; consume the token only
on a successful fetch (or make consumption compensating — restore on failure). Keep
the "never surface the raw value in an error" guarantee.

---

## 🟠 HIGH — robustness & performance

### Y1. O(n²) redacted-output rebuild
**Where:** `packages/redactor/src/batch.ts:93-101`; same shape in `packages/text-surfaces/src/rewrite.ts:143-151`

**Why it matters:** the output is rebuilt right-to-left with
`out = out.slice(0, m.start) + token + out.slice(m.end)` **per match** — O(matches ×
filesize) allocation. On the promoted "62,311 secrets" scan this is genuinely
quadratic and dominates runtime.

**Suggested fix:** walk matches left-to-right, push `[unmatched slice, token]` pieces
into an array, and `join('')` once at the end — O(n). Fix alongside K1 (same function).

### Y2. Unbounded line buffers in local IPC servers
**Where:** `apps/cli/src/watcher/rpc.ts:71-83`; `apps/mcp/src/resolver.ts:90-98` (`buffer += chunk` with no cap — `VERIFIED`)

**Why it matters:** both accumulate `buffer += chunk` until a newline, with no maximum
length. A same-uid process can send a newline-less stream and exhaust memory. The
redactor stream caps at 64 KB (`streaming.ts:12`), but these sockets and
`register_value` (`rpc.ts:127-133`) do not. Mitigated by 0600 socket perms + same-uid
trust, but it's missing input validation.

**Suggested fix:** cap per-line/per-message length (reuse the 64 KB constant); drop or
error the connection past the cap.

### Y3. Backups overwrite each other within the same time bucket
**Where:** `apps/cli/src/init/backup.ts:27-29` (minute resolution); `packages/text-surfaces/src/rewrite.ts:161-165` + `:213-216` (second resolution)

**Why it matters:** the stamped fallback backup path is not re-checked with
`existsSync`, so a second migration in the same minute (`init`) or a second scrub of
the same file in the same second (`rewrite`) silently overwrites the earlier backup
via `rename`/`copyFile` — the safety net (recovering the pre-scrub original) is lost.

**Suggested fix:** check the target path and append an incrementing suffix on
collision, or use higher-resolution + PID stamping.

### Y4. Vault-key collision after normalization
**Where:** `apps/cli/src/init/collision.ts:252-258` (`toAliasKey()`)

**Why it matters:** normalization lowercases and maps `_`→`-`, so `FOO_BAR` and
`FOO-BAR` both become `foo-bar`. There is no post-normalization collision check, so
during migration one distinct secret silently overwrites the other.

**Suggested fix:** detect collisions on the *normalized* key across the source set and
surface a warning / disambiguation instead of last-write-wins.

---

## 🟡 MEDIUM — quality & consistency

- **O1. False "zeroing" assurance** — `apps/cli/src/exec/spawn.ts:212-215`,
  `commands/exec.ts:311-314`. JS strings are immutable; `x = ''` / `arr.fill('')` only
  drops references — the plaintext lives in the V8 heap until GC. Comments say values
  are "zeroed on exit," overstating the guarantee (`crypto/envelope.ts:104-125` is
  honest about the same limit). Fix: correct the comments to match reality.
- **O2. `--no-redact` "Audit-flagged" but never audited** —
  `apps/cli/src/commands/exec.ts:63-65,239` describe disabling the redactor as
  audit-logged, but there is no audit call in `exec.ts`. Either dead docs or a missing
  feature — pick one.
- **O3. Trailing `\b` false negatives** — `packages/redactor/src/patterns.ts`
  (`slack-bot-token`, `slack-user-token`, `sendgrid-api-key`): a `\b` right after
  `[A-Za-z0-9-]{n}` won't match tokens ending in `-`. Re-check the boundary condition.
- **O4. Dead `overdue` query param** — `apps/server/src/routes/secrets.ts:737-741`:
  the `overdue` branch pushes the identical `lte(next_rotation_at, now)` predicate as
  `due`, and the status field only ever emits `'due'`/`'upcoming'`. Remove or
  implement distinctly.
- **O5. Server auth primitives lack focused unit tests** —
  `apps/server/src/auth/{jwt,password,tokens,cli-tokens,middleware}.ts` and
  `kek/load.ts` are exercised only indirectly by the 2,470-line integration test.
  Add unit tests for token expiry/tamper, argon2 params, and JWT verify edge cases.
- **O6. Hand-duplicated logic** — Shannon entropy (`redactor/entropy.ts:26` +
  `cli/init/heuristics.ts:109`), the IPC socket-path formula (`mcp/resolver.ts:31` +
  `cli/exec/mcp-resolve.ts:17`, kept "byte-for-byte identical" by hand), and
  `SURFACE_ENTROPY_EXCLUDE_PREFIXES` (`text-surfaces/scan.ts:23-40` +
  `rewrite.ts:33-46`). Extract shared modules.
- **O7. `HISTFILE` mis-detection** — `packages/text-surfaces/src/paths.ts:23-30`
  honors `$HISTFILE` for bash only when `$SHELL` matches `/bash/i`; a bash user whose
  `$SHELL` points elsewhere (login-shell / tmux mismatch) gets the wrong path and
  their real history is silently not scanned.

---

## 🔵 LOW — tooling & hygiene (deferred: personal-use-first)

- **L1. No coverage gate in CI** — only `packages/core/vitest.config.ts` defines
  thresholds, and CI never runs `--coverage`, so even that gate is unenforced.
- **L2. No Dependabot/Renovate** — the standout supply-chain gap given otherwise
  strong provenance + SBOM + cosign; dependency bumps are entirely manual.
- **L3. Dead `next lint` script** — `apps/web/package.json` declares `next lint` with
  no ESLint config anywhere; Biome is the real linter. Remove the misleading script.
- **L4. Missing repo governance** — no `CODEOWNERS`, issue, or PR templates; several
  packages run `vitest --passWithNoTests`, which would hide an accidentally-empty
  suite.
- **L5. Committed artifacts** — `.keynv.env` and `.DS_Store` are committed at root.
- **L6. Documented half-finished seams** — watcher log has no rotation
  (`watcher/audit-log.ts:38-48`, "grows unbounded"); `FingerprintRegistry` never
  evicts (`watcher/registry.ts` — a long-running daemon accumulates every resolved
  plaintext for its lifetime); `RewriteNotImplementedError` is a dead reference
  (`text-surfaces/types.ts:121-128`); fish history is suppression-only
  (`shell/templates.ts:132-153`, user loses the whole command).

---

## ✅ Strengths (for balance)

Near-zero `any`/`ts-ignore` under a maximally strict `tsconfig.base.json`; a 3-OS ×
2-node test matrix plus a bundle smoke-test; a 2,470-line black-box server integration
suite; a dedicated `tests/security` abuse package (env-enumeration, indirect
prompt-injection, output-redaction, privileged-subprocess, MCP token); gitleaks in
both CI and the pre-commit hook; a release pipeline with npm provenance, SBOMs, and
cosign signing; server audit logs that record alias/key/version only (never values);
a thorough SSRF guard including DNS-rebind resolution; and OS-keychain-backed
at-rest credential encryption with no plaintext fallback. The load-bearing primitives
from cycles 1–2 (crypto envelope, RBAC matrix, audit hash-chain) remain sound.

---

## Suggested sequencing

1. **K1 + Y1 together** (one function, one PR): fix the tail-leak *and* the O(n²)
   rebuild in `batch.ts`, land a staggered-overlap regression test. Highest value —
   it repairs the core promise and the headline performance path at once.
2. **K4**, then **K2** — small, contained correctness/safety fixes.
3. **K3** — make the shell bank generated or CI-diffed against the canonical bank.
4. **Y2 / Y3 / Y4** — robustness caps and collision checks.
5. **O-series** — comments-vs-reality, dead code, dedup, targeted auth unit tests.
6. **L-series** — schedule as a separate hygiene pass; low priority under the
   personal-use-first posture.
