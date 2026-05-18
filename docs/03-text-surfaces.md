# Text surfaces

A "text surface" is any file or directory where raw secret values leak
into plain text that humans or AI agents subsequently read. This
document defines the contract, the in-scope surfaces, the rewrite
semantics, and the honest gaps. It pairs with the
[threat model](./02-threat-model.md).

---

## The TextSurface interface

Lives in `@keynv/text-surfaces`. Three operations per surface:

```ts
interface TextSurface {
  readonly id: string;
  readonly label: string;
  isPresent(): Promise<boolean>;
  enumerate(): Promise<ReadonlyArray<string>>;
  scan(options?: ScanOptions): Promise<TextSurfaceScanResult>;
  rewrite(options?: RewriteOptions): Promise<RewriteResult>;
}
```

- **`isPresent()`** — best-effort. Stat error → false; never throws.
- **`enumerate()`** — re-globs on every call. New sessions appear; the
  surface re-discovers them.
- **`scan()`** — read-only. Returns *match counts* and *previews*. Never
  carries raw matched values out of the package; previews are bounded
  to 3 characters.
- **`rewrite()`** — atomic. Backs up (`<path>.keynv.bak.<ts>`), writes
  redacted content to `<path>.keynv.tmp.<ts>.<pid>`, `fsync`s, then
  `rename`s. POSIX-atomic on the same filesystem.

Trust boundary: a `TextSurfaceScanResult` is safe to print to a
terminal or write to disk. It cannot leak the underlying secret.

---

## Built-in surfaces

| ID | What | Path |
|---|---|---|
| `shell-history:zsh` | zsh history file | `$HISTFILE` or `~/.zsh_history` |
| `shell-history:bash` | bash history file | `$HISTFILE` (if `$SHELL` is bash) or `~/.bash_history` |
| `shell-history:fish` | fish history file | `~/.local/share/fish/fish_history` |
| `claude-code:transcripts` | Claude Code session JSONL | `~/.claude/projects/<encoded-cwd>/*.jsonl` |
| `cursor:logs` | Cursor logs | `~/Library/Application Support/Cursor/logs/` (macOS) or `~/.config/Cursor/logs/` (Linux) |

Surfaces are discovered at runtime via `discoverPresentSurfaces()`; a
machine without fish installed simply has no `shell-history:fish`
entry. Discovery never blocks on permission errors.

To stub paths in tests, set `KEYNV_TS_HOME` to override the user's
home directory at the discovery layer.

---

## Rewrite semantics

### Atomic file replacement

`rewriteFile(path, options)` does, in order:

1. `stat(path)` — abort if missing or unreadable.
2. **mtime check**: if mtime advanced in the last `ACTIVE_WRITE_WINDOW_MS`
   (default 10 seconds), skip with `skipReason: actively-written`.
   Override with `includeActive: true` (the watcher does this).
3. `readFile(path, 'utf8')`.
4. Run the redactor against the contents. If `matches.length === 0`, no
   backup is written, the file is untouched, returns `matchCount: 0`.
5. Copy to backup `<path>.keynv.bak.<ts>` (unless `backup: false`).
6. Write redacted content to `<dir>/.keynv.tmp.<ts>.<pid>` with mode
   0o600.
7. `fsync` the temp file.
8. `rename(tmp, path)` — POSIX-atomic on the same filesystem.
9. Return `RewriteFileResult`.

If steps 6–8 fail, the temp file is cleaned up; the backup remains so
the user can recover. The original is untouched at that point.

### Why not in-place

Rewriting in place (e.g., `open(path, 'r+')`) sounds attractive for
preserving inode + fd-holding writers, but the replacement length
rarely equals the original (`AKIAIOSFODNN7EXAMPLE` is 20 chars,
`<REDACTED:aws-access-key-id>` is 30). Shifting bytes inside an
actively-written file races every existing writer.

The `mtime + temp-rename` approach picks the lesser evil: skip the file
when a writer is active (or accept the race when `includeActive: true`
is explicit). The race window is the time between `readFile` and
`rename` — sub-100ms on typical hardware.

---

## JSONL safety (Claude Code transcripts)

Claude Code transcripts are line-delimited JSON under
`~/.claude/projects/<encoded-cwd>/*.jsonl`. Each line is a JSON value.
Naively rewriting one as text would risk corrupting the file.

We do not parse-per-field. Instead we rely on two invariants of the
redactor:

1. The default redaction token is `<REDACTED:<pattern-name>>` — a
   string containing only characters valid inside a JSON string body
   (no `"`, no `\`, no control characters).
2. The pattern bank's regexes never match `"` (URI patterns use
   `[^@ ]+@[^ ]+`, vendor tokens use `[A-Za-z0-9_-]+`, etc.). A match
   therefore never spans a JSON string boundary.

Together: replacing every match in the raw bytes with the default
token preserves valid JSONL line-by-line. Tested with golden
fixtures in `packages/text-surfaces/src/rewrite.test.ts` and verified
end-to-end on real session files.

If a future pattern needs to span JSON quotes, this invariant breaks
and we'd need a JSON-aware rewrite path. The redactor would also fail
to round-trip such a pattern; the constraint is mutual.

---

## The race window

Real-time scrubbing has an honest race condition:

```
t=0     Claude Code appends secret to session.jsonl
t=1ms   chokidar add/change event fires
t=50ms  debouncer schedules the rewrite
t=1050ms  rewrite begins (1s debounce)
t=1060ms  rewrite completes
```

For ~1 second after a secret lands, it exists on disk in plaintext.
During that window:

- An agent re-reading the file would see it.
- A backup tool snapshotting the file would capture it.
- A side-channel observer (process memory, fs trace) would observe it.

This is **not solved by scrubbing**. It is solved by **routing agent
secret access through `keynv exec` / `keynv.run` so the secret never
enters the surface in the first place**. The Phase B `keynv.run` MCP
tool is the long-term answer: agents receive *redacted* output, not
raw values that need post-scrubbing.

The scrubbing layer is a safety net for the cases where the primary
discipline (alias-only) fails. Both layers exist because either alone
is insufficient.

---

## Pattern bank false positives + negatives

### False negatives

Custom-format secrets (internal API tokens with no vendor prefix,
opaque UUIDs, encoded credentials) match neither the regex bank nor the
entropy detector. Two mitigations:

1. **Fingerprint registry**: `keynv exec` registers every resolved value
   with the watcher daemon via a Unix socket. The watcher passes
   registered values as `literals` to the redactor on every rewrite, so
   any value that *ever* flowed through `keynv exec` becomes detectable
   on future surface writes — even when its format is unmatched. Pure
   RAM, never persisted, cleared on watcher restart.
2. The entropy detector backs up the regex bank for high-randomness
   strings that don't fit any specific pattern.

Neither mitigation catches:

- A value that lands in a transcript without first being resolved by
  `keynv exec` *and* whose format isn't pattern-bank-shaped *and* isn't
  high-entropy enough.

That's a real gap. The right fix is to route the value through
`keynv exec` in the first place.

### False positives

The entropy detector flags long high-randomness strings. False
positives we already suppress at the scan layer:

- Filesystem paths (`/Users/...`, `./foo/bar`, `~/whatever`)
- URL schemes (`http://`, `https://`, `file://`)
- Content-hash markers (`sha1-…`, `sha256:…`)

Anthropic message/event IDs (`msg_…`, `Eu…`, `Eo…` prefixes) are not
currently suppressed; expect entropy noise in raw Claude Code
transcripts. The histogram in `keynv doctor` clearly separates entropy
hits from vendor-pattern hits so users can read past them.

`--no-entropy` disables the entropy detector entirely. Vendor-pattern
hits remain — those are the high-precision channel.

---

## Adding a surface

1. Implement the `TextSurface` interface in
   `packages/text-surfaces/src/surfaces/<name>.ts`.
2. Add platform-aware path resolution to
   `packages/text-surfaces/src/paths.ts`.
3. Register the factory in
   `packages/text-surfaces/src/discover.ts#builtinSurfaces`.
4. Add a unit test in
   `packages/text-surfaces/src/scan.test.ts` (scan + clean +
   noEntropy override at minimum).
5. Update the table at the top of this document.

If your surface's rewrite semantics differ from
"raw text in, raw text out" (e.g., it's binary, or has a header), wrap
the redactor call with a format-specific transform — see how Claude
Code's JSONL is handled. Most surfaces don't need this.
