# UX Roadmap — Phase 4 follow-on

A sequenced execution plan for the post-Phase-4 UX/auth/marketing
gaps. Owned by the keynv-web + keynv-server slices. Update the
checkboxes as items ship; reorder only across sprint boundaries.

Numbering follows the original audit (steps 1–12). Sprint ordering
reflects dependency, not the original numbering.

---

## Sprint 0 — Foundations (must ship first)

Everything in Sprint 2 (auth) depends on Resend + the email module.
Everything in Sprint 1–3 benefits from a working toast system. Do not
skip ahead.

### 0.1 · Toast / notification primitive  (step 9 partial)

**Why.** Password-reset success, email-verification success, register
errors, copy-to-clipboard confirmations, and 5xx fallbacks all need a
shared surface. Today every form ships ad-hoc red `<p>` tags.

**Files.**
- `apps/web/components/ui/toast.tsx` — primitive (use `sonner` library, well-maintained, ~3 KB gzipped, Radix-compatible)
- `apps/web/app/layout.tsx` — mount `<Toaster />` once at root
- `apps/web/lib/toast.ts` — thin wrapper (`notify.success`, `notify.error`, `notify.info`) so we can swap impl later without grepping the codebase

**Steps.**
1. `pnpm --filter @keynv/web add sonner`
2. Create the wrapper in `lib/toast.ts` — pin the three semantic helpers to current design tokens (`text-fg`, `bg-bg-elevated`, `border-border`)
3. Mount `<Toaster richColors closeButton position="bottom-right" />` in root layout (NOT in `(authed)/layout.tsx` — public pages also need it)
4. Migrate `register/form.tsx` and `login/form.tsx` to use `notify.error()` for non-field-level errors (keep inline for field validation)

**Acceptance.**
- `notify.success('Project created')` works on any client component
- Server-action error result → toast after redirect via `?toast=...` search param helper (or set a flash cookie; see ADR-TBD)
- Visual matches the dark theme without overrides

**Security note.** Toast bodies are user-visible strings. Never put a
secret alias resolution result here — same redaction rules as
everywhere else. Add a unit test in `lib/toast.test.ts` that asserts
`notify.error(unsanitizedErrorWithSecret)` is rejected or scrubbed.

**Time.** ~3 h.

---

### 0.2 · `error.tsx` and `not-found.tsx`  (step 9)

**Why.** A 5xx today drops the user into Next.js's stock white screen
with stack trace in dev / nothing in prod. Same for 404. We're a
security product — looking polished matters here.

**Files.**
- `apps/web/app/error.tsx` — global error boundary (client component)
- `apps/web/app/not-found.tsx` — root 404
- `apps/web/app/(authed)/error.tsx` — authed-scope error (keeps sidebar visible)
- `apps/web/app/(authed)/not-found.tsx` — authed 404
- `apps/web/components/ui/error-state.tsx` — shared visual

**Steps.**
1. Build `<ErrorState>` component: icon, title, message, primary CTA, secondary CTA (back / GitHub issue link)
2. `error.tsx` receives `{ error, reset }` — log via pino on the server (NOT in browser); show generic message + "Try again" button calling `reset()`
3. `not-found.tsx`: simple "We couldn't find that" + link back to `/` or `/projects` depending on auth state
4. Add a top-level `<a className="sr-only focus:not-sr-only" href="#main">Skip to content</a>` while we're here (ties into step 10)

**Acceptance.**
- Throw `new Error('boom')` in a server component → polished error page, no stack in prod
- Visit `/projects/nonexistent` → branded 404
- Skip-to-content link visible only on Tab focus

**Security note.** Errors must never leak the `cause` chain to the
browser. The boundary receives a `digest` string (server-generated
hash); show that, not the raw message. The full message is in server
logs (already redacted by pino).

**Time.** ~3 h.

---

### 0.3 · Resend setup + transactional email module  (step 3 prereq)

**Why.** Password reset, email verification, future magic-link, and
upcoming "secret expiry approaching" alerts all need a working email
sender. Resend chosen for: clean API, React Email templates, generous
free tier (3 k/mo), good deliverability defaults.

**Files (server-side; lives in keynv-server, not web).**
- `packages/email/` — new workspace package
  - `package.json` — deps: `resend`, `@react-email/components`, `react`, `zod`
  - `src/client.ts` — Resend client singleton, env validation
  - `src/templates/` — one `.tsx` per email (password-reset, email-verify, magic-link)
  - `src/send.ts` — typed `sendEmail({ to, template, props })` wrapper
  - `src/render.ts` — server-side render via `@react-email/render`
- `apps/server/src/env.ts` — add `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- `apps/server/src/routes/dev/email-preview.ts` — dev-only route to preview templates in browser (gated by `NODE_ENV !== 'production'`)
- `deploy/coolify.yml` — add env vars (KEYNV_RESEND_API_KEY surfaced)

**Steps.**

1. **Domain verification (do this first; takes 24-48 h to propagate).**
   - Resend dashboard → Domains → Add `keynv.dev`
   - Add the four DNS records (DKIM x2, SPF, MX-not-needed for sending-only)
   - Set up DMARC at `p=quarantine` after first 7 days of clean sends
   - Use a dedicated sending subdomain: `mail.keynv.dev` so a future
     deliverability mishap doesn't poison the apex domain. From:
     `keynv <noreply@mail.keynv.dev>`, Reply-To: `support@keynv.dev`

2. **Create `packages/email`.**
   - `pnpm init` inside the new dir, add to `pnpm-workspace.yaml`
   - Deps: `resend@^4`, `@react-email/components@^0.0.36`, `@react-email/render@^1`, `react@^18`
   - Strict TypeScript config inherits from `tsconfig.base.json`

3. **Build the templates** (three to start, but the loader is generic):
   - `PasswordReset` — heading, reset URL button, expiry note ("Expires in 30 minutes"), security footer ("If you didn't request this…")
   - `EmailVerify` — heading, verify URL button, expiry note ("Expires in 24 hours")
   - `MagicLink` — same shape, "Sign in to keynv" wording, expiry 15 min
   - All use a shared `<Layout>` wrapper with brand header (the `k` chip in SVG) and footer
   - All emails are **plain-text + HTML** (Resend supports both via `text: render(template, { plainText: true })`)

4. **Typed send wrapper.**
   ```ts
   // packages/email/src/send.ts shape
   export async function sendEmail<T extends EmailTemplate>(args: {
     to: string;
     template: T;
     props: PropsFor<T>;
     idempotencyKey?: string;
   }): Promise<SendResult>
   ```
   - Validates `to` via zod
   - Forbids sending to disposable domains (small allowlist + Mailgun's open list is fine — block by default in prod, log+allow in dev)
   - Auto-attaches `keynv-email-version: 1` header for future template-rev tracking
   - Returns `{ id, status }` from Resend; throws typed errors

5. **Idempotency + rate limit.**
   - Pass Resend's `idempotency-key` header for every send keyed by `{userId, template, day}`
   - Server-side rate limit (per-user): 5 password-reset emails per hour, 3 verify emails per day. Store counters in SQLite (a `email_send_audit` table with `(user_id, template, sent_at)` index)
   - Hard global limit (per-IP) at 20/hour to defend the unauthenticated endpoints

6. **Dev-mode preview.**
   - `apps/server/src/routes/dev/email-preview.ts` mounts `/dev/emails/:template` returning the rendered HTML — only when `NODE_ENV !== 'production'` AND request comes from loopback
   - Do NOT ship to prod build; conditional import behind `process.env.NODE_ENV`

7. **Logging.**
   - Every send → `audit_events` row: `email.sent` with `{template, to_hash, message_id}`. `to_hash` = SHA-256 of normalized email; we don't store the plaintext in the audit log to keep PII out of an append-only structure that's hard to GDPR-delete
   - Resend webhook → `/v1/webhooks/resend` (sig-verified) updates `email_send_audit` with `delivered`, `bounced`, `complained` — bounces auto-lock the recipient against further sends until manually cleared

**Acceptance.**
- `sendEmail({ to: 'me@test', template: 'PasswordReset', props: {...} })` returns a message ID in dev
- `curl /dev/emails/password-reset` shows the rendered HTML in dev only
- Bounced address → second send attempt 400s with `email.bounced_recipient`
- All emails: SPF=pass, DKIM=pass, DMARC=pass when sent to a Google Workspace inbox

**Security notes.**
- `RESEND_API_KEY` lives only in keynv-server's env. **Never expose to keynv-web.** Web triggers email via authenticated server endpoint, not directly.
- Email bodies must never contain a resolved secret value. Audit log lines for `email.sent` go through the standard pino redactor — assert in tests.
- Reset URLs use a **single-use, hashed-at-rest token** (32 bytes from crypto.getRandomValues; store `sha256(token)` in DB so a DB leak doesn't enable reset). See 2.1.
- Webhook signature verification is mandatory; Resend signs with HMAC-SHA256. Reject any unsigned or wrong-sig request with 401 + log to `audit_events`.

**Time.** ~1 day (excluding DNS wait).

---

## Sprint 1 — Marketing & discoverability (parallelizable with Sprint 2)

### 1.1 · Dynamic OG image  (step 1)

**Why.** keynv.dev shared on Twitter/LinkedIn today renders a blank
preview. A polished card 5-10x's CTR per industry benchmark.

**Files.**
- `apps/web/app/opengraph-image.tsx` — generated at request time
- `apps/web/app/twitter-image.tsx` — re-export of opengraph-image OR a tighter variant

**Steps.**
1. Use `ImageResponse` from `next/og`. 1200×630 dark canvas.
2. Layout:
   - Top-left: `k` chip + "keynv" wordmark
   - Top-right: "Phases 1-3 shipping" badge in muted neutral
   - Center: headline "Secrets your AI agent can't leak." 64 px Inter Semibold, leading 1.05
   - Below: mono code chip `keynv exec -- mysql -p @billing.prod.db_password` at 24 px with accent highlight on the alias
   - Bottom-right: `keynv.dev` in 18 px muted, faint grid backdrop matches landing
3. Font loading: Inter via `next/og` fetch helper at build (avoid `node:fs` in edge runtime)
4. Cache headers: `s-maxage=31536000, immutable` (the image is content-derived, never changes per-request)

**Acceptance.**
- `curl https://keynv.dev/opengraph-image` returns a 1200×630 PNG
- LinkedIn Post Inspector + Twitter Card Validator both render correctly
- Image is < 200 KB

**Time.** ~2 h.

---

### 1.2 · `/docs` route with MDX  (step 2a)

**Why.** Today docs live only at github.com/keynv-labs/keynv/docs. On
mobile that's painful, not shareable as a permalink, and no syntax
highlighting on long examples.

**Files.**
- `apps/web/app/docs/[[...slug]]/page.tsx` — catch-all rendering MDX files
- `apps/web/app/docs/layout.tsx` — docs-specific layout with sidebar nav
- `apps/web/components/docs/sidebar.tsx`
- `apps/web/components/docs/toc.tsx` — table of contents from headings
- `apps/web/lib/docs.ts` — file loader (reads from `../../docs/*.md`)
- `apps/web/next.config.ts` — add `pageExtensions: ['ts','tsx','md','mdx']` if MDX used directly, OR keep using raw .md + react-markdown

**Decision: react-markdown + remark/rehype, not MDX.** Reasoning:
- Docs are pure prose + code blocks (no React components today)
- react-markdown ships ~50 KB; @next/mdx with all extensions is closer to 200 KB
- Keeps `docs/*.md` git-ergonomic, no JSX leakage that breaks GitHub rendering
- Phase 5 can swap to MDX if we need components in docs

**Steps.**

1. `pnpm --filter @keynv/web add react-markdown remark-gfm rehype-pretty-code shiki`

2. Build the loader:
   ```ts
   // lib/docs.ts
   export interface DocPage { slug: string[]; title: string; body: string; toc: TocEntry[] }
   export async function listDocs(): Promise<DocPage[]>
   export async function loadDoc(slug: string[]): Promise<DocPage | null>
   ```
   Source path: `path.join(process.cwd(), '..', '..', 'docs')` — reads the same files that live on GitHub. Skip files in `decisions/` (those are ADRs; surface as "Architecture decisions" sub-section).

3. Page component:
   - Server component, no client JS for the body
   - `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypePrettyCode, {theme:'github-dark'}]]} components={{ a: smartLink, h2: anchorH2 }}>`
   - Anchor links: `h2`/`h3` get auto-generated ids + a clickable `#` on hover

4. Sidebar:
   - Section 1: "Getting started" — Quickstart, Install, First project
   - Section 2: "Concepts" — Architecture, Threat model, Encryption design
   - Section 3: "Reference" — API spec, CLI reference, MCP server
   - Section 4: "Operations" — Self-host, Backup/restore, Audit chain
   - Section 5: "Decisions (ADRs)" — auto-collapsed list of `docs/decisions/*.md`

5. Cross-link from landing's "How it works" section and footer ("Docs" link goes to `/docs` not GitHub).

6. **Important content additions** (creates the docs that today are missing):
   - `docs/quickstart.md` — "5-minute getting started" (NEW)
   - `docs/cli-reference.md` — generated from clipanion definitions (can hand-write v1)
   - `docs/integrations/claude-code.md` — guided setup walkthrough for AI agents
   - `docs/integrations/cursor.md` — same for Cursor
   - `docs/faq.md` — Vault vs keynv, self-host vs SaaS, GDPR, etc.
   - `docs/migration/doppler.md`, `docs/migration/1password.md` — conversion levers
   - These can ship incrementally; sidebar gracefully omits missing pages

**Build-time consideration.** Docker build needs `docs/` directory.
Update `apps/web/Dockerfile` to `COPY docs/ ./docs/` before the build
step. Standalone output is fine — files get traced.

**Acceptance.**
- `/docs` renders an index with sidebar
- `/docs/architecture` renders `docs/01-architecture.md` with syntax-highlighted code blocks
- Heading anchor links work
- 404 for missing slugs (uses Sprint 0.2 not-found)
- Search engine indexable (no robots disallow on /docs)

**Time.** ~1 day (loader + render + sidebar + 2 new content pages).

---

### 1.3 · `/changelog` page  (step 6)

**Why.** CHANGELOG.md already exists at root. Just needs a public surface. Devs check changelogs; SEO + trust.

**Files.**
- `apps/web/app/changelog/page.tsx`
- Reuse `lib/docs.ts` loader (or extract a `lib/markdown.ts` shared helper)

**Steps.**
1. Read `CHANGELOG.md` from repo root at request time (cached with `revalidate: 3600`)
2. Same renderer as /docs
3. Top-level layout: title "Changelog", description "What shipped, when, and why", RSS link
4. Add `/changelog/rss.xml` route — auto-generates feed from version headings (`## [x.y.z] — date`)
5. Add Changelog link to landing footer + top nav (replacing GitHub link in nav, keep GH in footer)

**Acceptance.**
- `/changelog` renders the current CHANGELOG.md formatted
- `/changelog/rss.xml` is valid RSS 2.0 (validate at validator.w3.org/feed)
- Robots allows indexing; sitemap includes it

**Time.** ~3 h.

---

### 1.4 · CLI install widget on landing  (step 8)

**Why.** Users have to dig into README to find how to install. The
landing should make it one click.

**Files.**
- `apps/web/components/install-tabs.tsx`
- Mount in `app/page.tsx` between Hero's `<CodeFrame />` and the
  "Problem" section, OR as a dedicated section after "How it works"

**Steps.**
1. Three tabs: **npm** / **brew** / **curl | sh** / **scoop** (Windows). Default to npm — most coding agent users have Node.
2. Each tab shows:
   - One line install command in a copy-to-clipboard chip
   - One line "verify" command: `keynv --version`
   - "View install docs →" link to `/docs/install`
3. Copy-to-clipboard uses the toast system from 0.1 ("Copied to clipboard")
4. Auto-detect OS via `navigator.platform` (client component) and pre-select the tab — fallback npm if undetected

**Acceptance.**
- Click any chip → command in clipboard + toast
- macOS visitor opens with brew tab; Windows with scoop; Linux/other with curl | sh
- Mobile: tabs stay readable; copy still works (uses `navigator.clipboard.writeText`)

**Time.** ~4 h.

---

### 1.5 · Trust signals  (step 12)

**Why.** Early-stage products need credibility scaffolding without
overstating. GitHub stars + status link + roadmap message is the
minimum.

**Files.**
- `apps/web/components/trust/github-stars.tsx` — server component, fetches GitHub API with 1-hour revalidation
- `apps/web/components/trust/status-pill.tsx` — server component fetches `/v1/health` from api.keynv.dev, shows green/amber/red dot
- `apps/web/app/page.tsx` — TopNav: stars badge next to GitHub link; Footer: status pill + "Roadmap: SOC2 readiness H2 2026"

**Steps.**

1. **GitHub stars.** Server component:
   ```tsx
   const data = await fetch('https://api.github.com/repos/keynv-labs/keynv', {
     next: { revalidate: 3600 },
     headers: { 'user-agent': 'keynv-web' }
   }).then(r => r.json());
   ```
   Render: `<a href="https://github.com/..."><Github /> {data.stargazers_count} ★</a>`. Skeleton fallback while loading.

2. **Status pill.** Calls `https://api.keynv.dev/v1/health` (cached 60 s). Renders:
   - Green dot + "All systems operational" if `ok: true`
   - Amber if 5xx; "Investigating" — link to status page (TODO: pick one)
   - Red if unreachable for > 60 s

3. **Roadmap text in footer.** Add a small block:
   > "Public beta. SOC2 readiness on the roadmap for H2 2026 — see [security](/docs/security)."
   Don't overclaim. Don't claim "certified" — just "on the roadmap".

4. **Status page choice.** Recommend [openstatus.dev](https://openstatus.dev) — open source, free tier, supports public status page at status.keynv.dev. Configure a 5-minute interval check against `api.keynv.dev/v1/health` and `keynv.dev/`. Spawn this as a separate config task; needs DNS + a free OpenStatus account.

**Acceptance.**
- GitHub badge shows current star count; updates within an hour
- Status pill flips to amber if api.keynv.dev returns 500 in a synthetic test
- Footer roadmap text is visible on desktop + mobile

**Security note.** GitHub API call is unauthenticated (public repo);
no token exposure. Status pill fetches public endpoint only.

**Time.** ~4 h (excluding OpenStatus setup, which is config not code).

---

## Sprint 2 — Auth completeness (depends on Sprint 0.3)

### 2.1 · Password reset flow  (step 3)

**Why.** Today a forgotten password on keynv.dev locks the user out
permanently — there's no admin to call. Industry baseline feature.

**Backend files (apps/server).**
- `apps/server/src/db/schema.ts` — new `password_reset_tokens` table: `{id, user_id, token_hash, expires_at, used_at, created_at, ip, user_agent}`
- `apps/server/src/db/migrations/` — Drizzle-generated migration
- `apps/server/src/routes/auth/reset.ts` — two endpoints:
  - `POST /v1/auth/forgot { email }` → always returns 202 (no email enumeration), sends email if user exists + unbounced
  - `POST /v1/auth/reset { token, new_password }` → validates token, rotates password, invalidates all sessions for the user, deletes token row
- `apps/server/src/services/password.ts` — argon2id helpers (probably exists; verify)

**Frontend files (apps/web).**
- `apps/web/app/forgot/page.tsx` + `form.tsx` + `actions.ts`
- `apps/web/app/reset/page.tsx` + `form.tsx` + `actions.ts`
- `apps/web/middleware.ts` — add `/forgot` and `/reset` to PUBLIC_PATHS
- `apps/web/app/login/page.tsx` — add "Forgot password?" link below the form

**Steps.**

1. **Schema + migration.**
   ```ts
   export const passwordResetTokens = sqliteTable('password_reset_tokens', {
     id: text('id').primaryKey(),
     user_id: text('user_id').notNull().references(() => users.id),
     token_hash: text('token_hash').notNull(), // sha256(token), hex
     expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
     used_at: integer('used_at', { mode: 'timestamp_ms' }),
     created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
     ip: text('ip'),
     user_agent: text('user_agent'),
   });
   ```
   Index on `(user_id, used_at)` for cleanup. Index on `token_hash` for lookup.

2. **Forgot endpoint.**
   - zod validate `{ email: z.string().email() }`
   - Look up user by normalized email (lowercase, trim)
   - **Always return 202** with body `{ok: true}` — do not reveal whether the email exists (prevents user enumeration)
   - If user exists AND `email_send_audit` allows (per 0.3 rate limits):
     - Generate 32-byte random token via `crypto.randomBytes(32).toString('hex')` (64-char hex)
     - Insert row with `token_hash = sha256(token)`, expires in 30 min
     - Send `PasswordReset` email with URL `https://keynv.dev/reset?token={token}`
   - Audit log: `auth.password_reset_requested` regardless of email existence (with bool `user_existed` field for ops insight)

3. **Reset endpoint.**
   - zod validate `{ token: z.string().length(64), new_password: z.string().min(12).max(256) }`
   - Look up by `token_hash = sha256(token)`
   - Reject if `used_at IS NOT NULL` OR `expires_at < now` — both with generic `auth.invalid_or_expired_token`
   - Re-validate password complexity (server-side; client should match)
   - Update `users.password_hash` with new argon2id digest
   - Mark token used: `used_at = now`
   - **Invalidate all sessions for user_id** — bump `users.session_version` (need a column for this; if not present, add it; existing JWTs include it as a claim and middleware rejects mismatches)
   - Audit log: `auth.password_reset_completed`
   - Return 204; client redirects to /login with success toast

4. **Frontend /forgot.**
   - Form: single email input, submit button
   - Server action: posts to `/v1/auth/forgot`, always shows success page regardless ("If an account exists for {email}, we've sent reset instructions.")
   - Success page has explicit "Wrong email?" link back

5. **Frontend /reset.**
   - Server component reads `?token=` searchParam
   - If missing → redirect /forgot
   - Form: new password + confirm new password
   - Submit → posts to `/v1/auth/reset { token, new_password }`
   - On 200: toast "Password updated", redirect to /login
   - On error: inline form error (token expired, weak password)

6. **Login page link.** Add small "Forgot your password?" link right-aligned under password field.

7. **Background sweeper.** Cron-style cleanup (already a slice on the roadmap?): every 6 h, delete `password_reset_tokens WHERE expires_at < now - 7d`. Don't keep stale tokens around indefinitely.

**Acceptance.**
- E2E test (vitest + supertest) covers: forgot → email sent → reset → login with new password → old session invalidated
- Submitting an unknown email returns 202 with identical timing (use a constant-time `crypto.timingSafeEqual` dance or fixed `setTimeout`) — no enumeration
- Token reuse returns 400 `auth.invalid_or_expired_token`
- Rate limit: 6th forgot request in an hour returns 429

**Security notes (CRITICAL).**
- **Email enumeration**: response shape AND timing must be identical for known/unknown emails. Add a `setTimeout(800)` floor on the unknown path if needed.
- **Token storage**: never store the plaintext token; only `sha256(token)`. A DB dump must not enable reset.
- **Session invalidation**: a successful reset must invalidate all extant tokens (web sessions + CLI tokens). The `users.session_version` claim approach is simplest. Alternative: a token revocation list, more code.
- **Audit chain**: both forgot and reset emit audit events. The chain ensures we can detect tampering retroactively.
- **No secret in email body**: emails contain only the URL, not the token alone or any user PII beyond their email (already known to recipient).

**Time.** ~1.5 days (schema + endpoints + 2 web pages + tests).

---

### 2.2 · Email verification  (step 4)

**Why.** Today registration creates a fully-verified account. Phishing
risk (signup with someone else's email), spam risk (no email-quality
check), and weak fraud signal. Verification is industry baseline.

**Design decisions.**
- **Verify-on-registration model** (not "verify-on-first-action"). Account is created in `unverified` state; user receives an email; cannot create projects or add secrets until verified. Reasoning: cleaner state machine and the cost (one extra click) is negligible.
- **NOT magic-link as primary auth.** Magic links can ship as a secondary login method later (separate slice). Password remains primary because: (1) it's what CLI uses, (2) password managers handle it well, (3) magic-link UX has friction in cross-device flows.

**Backend files.**
- `apps/server/src/db/schema.ts` — add `users.email_verified_at: integer` + `email_verification_tokens` table (same shape as password_reset_tokens)
- `apps/server/src/routes/auth/verify.ts`:
  - `POST /v1/auth/verify/send { ... }` — requires authenticated unverified user; rate-limited
  - `POST /v1/auth/verify/confirm { token }` — unauthenticated, completes verification
- `apps/server/src/routes/auth/register.ts` — modify to create user as unverified + auto-send first verification email
- `apps/server/src/middleware/require-verified.ts` — guards routes that need verified status

**Frontend files.**
- `apps/web/app/verify/page.tsx` — confirms via `?token=`
- `apps/web/app/(authed)/verify-pending/page.tsx` — shown to unverified authenticated users
- `apps/web/app/(authed)/layout.tsx` — redirect unverified to /verify-pending (except for /verify-pending and /settings/account)

**Steps.**

1. **Schema migration.** Add `email_verified_at` column; backfill `now()` for all existing users so we don't lock everyone out. Future signups default `NULL`.

2. **Register flow update.**
   - On successful registration → insert user with `email_verified_at = null`
   - Auto-send verification email (uses 0.3 send infra, template `EmailVerify`)
   - Session is still created (user can browse) but limited routes
   - Audit: `auth.user_registered_unverified`

3. **Verify confirm endpoint.**
   - Same token shape as password reset (32-byte hex, hashed at rest, 24-h expiry)
   - Sets `email_verified_at = now()`, marks token used
   - Audit: `auth.email_verified`

4. **Verify send endpoint.**
   - Requires session (authenticated)
   - Rejects if already verified (`auth.already_verified`)
   - Rate limit: 3 sends per 24h per user
   - Invalidates prior unused tokens (only one outstanding at a time)

5. **Frontend `/verify`.**
   - Server component reads `?token=`, calls confirm endpoint
   - Success → toast "Email verified" + redirect to `/projects`
   - Failure → "Link expired" page with "Resend" button (uses send endpoint if authenticated, otherwise prompts login)

6. **Frontend `/verify-pending`.**
   - Banner: "We sent a verification link to alice@team.com. Open it to finish setup."
   - "Resend email" button (toast on success)
   - "Wrong email? Sign out and start over."

7. **Layout guard.**
   - In `(authed)/layout.tsx`: if `session.email_verified_at == null` and pathname not in `['/verify-pending', '/settings/account']`, redirect to `/verify-pending`
   - Account settings stay accessible so they can change email before verifying

8. **Backend guard.**
   - `require-verified` middleware applied to: project create, secret read/write/rotate, environment create
   - Allows: account read/update, audit read, logout, refresh
   - Returns 403 `auth.email_not_verified` with `{required_action: 'verify_email'}`

9. **Optional: Phase 4.x — magic-link as secondary auth.**
   - Login page gets a "Sign in with email link" toggle
   - Same token infra
   - Sends `MagicLink` template; consume creates session
   - Useful for users who forgot password and want temporary access without going through reset

**Acceptance.**
- New registration → unverified → email arrives → click link → verified → projects accessible
- Unverified user can't `POST /v1/projects` (returns 403)
- Resend rate limit kicks in at 4th attempt within 24h
- Reusing a verify token returns the same `auth.invalid_or_expired_token`

**Security notes.**
- Same token-hashing rules as 2.1
- Email-change flow (in account settings) MUST send verification to the NEW address AND a notification to the OLD address ("Your email was changed. Wasn't you? Reach out."). Implement when email-change is added; flagged here.
- Don't auto-merge accounts on email-change collision.

**Time.** ~1.5 days.

---

### 2.3 · Register form UX polish  (step 5)

**Why.** Tiny details that add up to "this feels professional".

**Files.**
- `apps/web/app/register/form.tsx`
- `apps/web/components/ui/password-input.tsx` — new shared component
- `apps/web/components/ui/password-strength.tsx`

**Steps.**

1. **PasswordInput component.**
   - Reuses base `<Input type={visible ? 'text' : 'password'}>`
   - Trailing eye/eye-off icon button toggles visibility
   - `aria-label` on the toggle, focus ring matches input
   - Auto-clears clipboard after 30 s if user copy-pasted the password? — skip for now; password managers handle this

2. **PasswordStrength component.**
   - Client-side: use [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) (~50 KB, but only loaded on /register and /reset — dynamic import)
   - Below the input: 5-segment bar + label ("Weak", "Fair", "Good", "Strong", "Excellent")
   - Show 1-2 worst suggestions from zxcvbn output below the bar
   - **Do not block submission** on weak — server still has the 12-char minimum; this is guidance, not gate

3. **Success state (after form submits + email sent).**
   - Currently the form just redirects to /projects
   - Post-2.2: redirect to /verify-pending which has the "we sent an email" message
   - Add a brief animated checkmark in the form before redirect (Framer Motion or pure CSS transition)

4. **Inline field validation.**
   - Email field: blur → check format; show "Looks good" or hint
   - Org name: 64-char limit; show counter at 50+ chars
   - Password: live strength meter; hint about complexity tips

5. **Caps Lock warning.**
   - On password input keydown, detect Caps Lock; show small "Caps Lock is on" hint above input
   - Same on /login form

**Acceptance.**
- Tab through: email → org → password (visible toggle reachable) → submit
- Type a weak password → see "Weak" bar + suggestion ("Add another word or two")
- Submit a 6-char password → server rejects with clear error; form preserves email and org
- Caps Lock on → visual indicator next to password field

**Time.** ~6 h.

---

## Sprint 3 — Onboarding (after Sprint 2)

### 3.1 · Post-register onboarding checklist  (step 7)

**Why.** Today: register → /projects empty state with "Create first project" button + a code example. User has no idea about the AI-safety layer (the actual product); no path to the CLI; no path to "Connect Claude Code".

**Files.**
- `apps/web/app/(authed)/projects/page.tsx` — empty state replaced
- `apps/web/components/onboarding/checklist.tsx`
- `apps/web/lib/onboarding.ts` — derives step status from server data
- `apps/server/src/routes/onboarding/status.ts` — `GET /v1/onboarding/status` returns booleans

**Steps.**

1. **Server endpoint.** Compute from existing data — no new tables needed:
   ```ts
   {
     project_created: boolean,       // count(projects where owner) > 0
     secret_added: boolean,           // count(secrets across user projects) > 0
     cli_authenticated: boolean,      // count(cli_tokens) > 0
     integration_installed: boolean,  // join an `integration_install_audit` if we add one,
                                       // otherwise: count(audit_events where event='integration.installed') > 0
   }
   ```

2. **Checklist component.**
   - Card with title "Get started" + dismiss button (writes `users.onboarding_dismissed_at`)
   - 4 steps as rows:
     1. **Create your first project** — primary CTA "New project" → `/projects/new`
     2. **Add a secret to it** — inline `keynv secret add @yourproject.dev.api_key` snippet with copy button
     3. **Connect your CLI** — `keynv` + copy button
     4. **Install in your AI agent** — three buttons: Claude Code, Cursor, Codex — each opens `/docs/integrations/{slug}` in a new tab
   - Each row: muted state with checkbox, "current" state highlighted, "done" state with checkmark + struck-through
   - Show until all 4 done OR explicitly dismissed

3. **Empty-state coexistence.**
   - If `project_created === false`: replace today's "No projects yet" card with the checklist (only step 1 is current)
   - If `project_created === true && some other step pending`: show checklist as a top card ABOVE the projects list, smaller
   - If all done or dismissed: show normal projects list

4. **Tour overlay (lightweight).**
   - On first authenticated visit, a single tooltip pointing at the "New project" button: "Start here →"
   - Dismissed on click or first project create
   - No multi-step `react-joyride` style tour; respect the "don't write speculative abstractions" rule
   - Localstorage flag `keynv-tour-dismissed`

**Acceptance.**
- Fresh user lands on /projects → sees 4-step checklist, step 1 highlighted
- Create a project → checklist updates, step 2 highlighted, step 1 done
- Dismiss → reload → no checklist (state persisted server-side via `users.onboarding_dismissed_at`)
- Each integration button → docs page opens

**Time.** ~1.5 days.

---

## Sprint 4 — Quality (final sweep)

### 4.1 · Accessibility audit  (step 10)

**Why.** Security products serve devs in regulated industries (gov,
fintech, healthcare). WCAG AA conformance is table stakes for those
procurement processes.

**Files.** Spread across components; biggest impact on:
- `components/ui/button.tsx`, `input.tsx`, dialog/sheet primitives
- `components/layout/sidebar.tsx`
- `app/(authed)/projects/[id]/page.tsx` and other dashboards
- `app/globals.css` — focus ring tokens

**Steps.**

1. **Audit setup.**
   - Install `@axe-core/react` in dev only; mount in `_app` equivalent for dev
   - Manual sweep with Lighthouse (Chrome devtools) on /, /login, /register, /projects, /audit
   - Manual sweep with Polypane or BrowserStack for browser zoom 200%, prefers-reduced-motion, prefers-color-scheme

2. **Skip-to-content link.** (Already covered in 0.2 plan.) Ensure all main routes have a `<main id="main">` landmark.

3. **Focus rings.** Audit each interactive: button, link, input, kbd, tab. Ensure 2px visible outline with `--color-focus` (3:1 contrast against bg). Use Tailwind `focus-visible:` not `focus:`.

4. **Color contrast.**
   - Test `text-fg-subtle` on `bg-bg` → currently might fail 4.5:1
   - Test `text-fg-muted` on `bg-bg-elevated` → likely OK but verify
   - Test alias accent color used in code chips
   - Fix by darkening / lightening tokens; document in `globals.css` why each token has its specific contrast

5. **Semantic HTML.** Review:
   - Sidebar uses `<nav>` + `<ul>` ✓ (already)
   - Login/register form uses `<form>` + `<label>` ✓
   - Dashboard pages: ensure each `<h1>` is unique per page; breadcrumb uses `<nav aria-label="breadcrumb">`
   - Tables in audit log: `<th scope="col">`, `<caption>` (sr-only)

6. **Keyboard nav.**
   - Tab order matches visual order
   - Sidebar `kbd` hints (`g p`, `g a`) — are they wired up? If yes, document; if no, either wire or remove
   - Modal/dialog focus trap (use Radix primitives — already in `@radix-ui/*` deps)

7. **prefers-reduced-motion.** Wrap any animation in `motion-safe:` Tailwind variant. Already mostly compliant since few animations exist; verify Framer Motion usage in 2.3 success state.

8. **Screen-reader test.**
   - VoiceOver pass on macOS: register flow, login, create project
   - Announce form errors via `aria-live="polite"` region (today the error `<p>` is silent)

**Acceptance.**
- Lighthouse a11y score ≥ 95 on /, /login, /register, /projects
- axe-core reports 0 critical / 0 serious issues
- Full keyboard nav of /projects without mouse
- VoiceOver announces all form errors

**Time.** ~1 day.

---

### 4.2 · Mobile experience audit  (step 11)

**Why.** Many devs check dashboards on phones during on-call.
Onboarding signups happen on whatever device the user has open.

**Files.** Same spread; focus on viewport-conditional styles.

**Steps.**

1. **Device matrix.** Test in Chrome DevTools at 375×667 (iPhone SE), 390×844 (iPhone 14), 412×915 (Pixel 7), 768×1024 (iPad).

2. **Per-route review.**
   - `/` landing — Hero hopefully responsive (max-w-3xl + text-4xl); audit each section
   - `/login` and `/register` — card centered, sufficient padding; password input must fit show/hide toggle
   - `/projects` — table or card list? If table, horizontal scroll? Convert to stacked cards under md
   - `/projects/[id]` — environment switcher + secret list ergonomics
   - `/audit` — table will be cramped; convert to cards under md (one row = one entry, label + value pairs)
   - Sidebar drawer (already exists per `MobileTopBar`) — verify open/close gesture, swipe-to-close, focus return

3. **Tap targets.** Minimum 44×44 px per WCAG 2.5.5. Audit kbd shortcuts (hidden on mobile, OK), copy buttons, dismiss icons.

4. **Form ergonomics.**
   - `inputmode="email"` on email field, `inputmode="text" autoComplete="organization"` on org, etc.
   - Disable iOS auto-capitalize on email
   - On-screen keyboard doesn't cover the submit button (use `100dvh` not `100vh` for full-height wrappers)

5. **Performance.** Mobile is bandwidth-limited.
   - Run Lighthouse mobile → LCP, CLS, TTI
   - Check bundle size of landing — likely small but verify post-1.4 (zxcvbn could bloat /register; ensure dynamic import)

**Acceptance.**
- All routes usable on 375 px width
- No horizontal scrollbars
- Lighthouse mobile performance ≥ 85 on /
- Form on /login readable without zoom

**Time.** ~6 h (mostly review + tweaks; major mobile issues found in review get filed as follow-up tasks).

---

## Cross-cutting concerns

### Database migrations

Sprint 2 needs three migrations:
1. `password_reset_tokens` table
2. `email_verification_tokens` + `users.email_verified_at` column
3. `users.session_version` column (for invalidation)

Sequence them as separate migration files so they ship in three commits, not one. Each migration:
- Reversible (drop column / drop table)
- Has a backfill for existing users where needed
- Tested via vitest migration test

### Audit log additions

New event types to add to the schema enum:
- `email.sent` (sprint 0.3)
- `auth.password_reset_requested`, `auth.password_reset_completed` (sprint 2.1)
- `auth.user_registered_unverified`, `auth.email_verified` (sprint 2.2)
- `auth.email_changed` (future)
- `integration.installed` (sprint 3.1, optional)

All flow through the existing append-only chain. No bypasses.

### Environment variables added

```bash
# Server
RESEND_API_KEY=...
EMAIL_FROM=keynv <noreply@mail.keynv.dev>
EMAIL_REPLY_TO=support@keynv.dev
KEYNV_RESEND_WEBHOOK_SECRET=...  # HMAC for incoming webhooks

# Web (none added — web never calls Resend directly)
```

Update `deploy/coolify.yml`, `deploy/.env.example`, `apps/server/src/env.ts`.

### Test strategy per sprint

- Sprint 0: unit tests for toast wrapper redaction; visual test for error.tsx
- Sprint 1: snapshot test for OG image dimensions; integration test for /docs loader; RSS feed validates
- Sprint 2: **end-to-end happy path + enumeration timing + token reuse + rate limit** (these are the high-risk paths)
- Sprint 3: integration test for /v1/onboarding/status
- Sprint 4: Lighthouse CI in GitHub Actions on every PR

### Rollout

Each sprint's items land in a feature branch behind a feature flag
where possible (e.g., `KEYNV_FEATURE_EMAIL_VERIFICATION=true`). Default
off in self-host until the slice is signed off. On keynv.dev, enable
via Coolify env once green.

---

## Timeline summary

| Sprint | Items | Estimated time | Calendar |
|---|---|---|---|
| 0 — Foundations | 0.1 toast, 0.2 error boundaries, 0.3 Resend | ~2 days | Week 1, Mon–Tue |
| 1 — Marketing | 1.1 OG, 1.2 /docs, 1.3 /changelog, 1.4 CLI, 1.5 trust | ~2.5 days | Week 1, Wed–Fri |
| 2 — Auth | 2.1 password reset, 2.2 email verify, 2.3 register UX | ~3.5 days | Week 2, Mon–Thu |
| 3 — Onboarding | 3.1 checklist + tour | ~1.5 days | Week 2, Fri & Week 3, Mon |
| 4 — Quality | 4.1 a11y, 4.2 mobile | ~1.5 days | Week 3, Tue–Wed |

Total: ~11 working days, 2.5 calendar weeks at one focused dev.

**Critical-path note:** Resend DNS verification (0.3 step 1) blocks
Sprint 2. Kick off DNS records on Day 1, work Sprint 1 in parallel
while propagation happens.

---

## Checklist (tick as you go)

### Sprint 0
- [ ] 0.1 Toast system
- [ ] 0.2 error.tsx + not-found.tsx
- [ ] 0.3 Resend setup (DNS, package, templates, webhook)

### Sprint 1
- [ ] 1.1 Dynamic OG image
- [ ] 1.2 /docs with MDX/markdown
- [ ] 1.3 /changelog + RSS
- [ ] 1.4 CLI install widget
- [ ] 1.5 Trust signals (GH stars, status pill, footer text)

### Sprint 2
- [ ] 2.1 Password reset (backend + /forgot + /reset)
- [ ] 2.2 Email verification (backend + /verify + /verify-pending)
- [ ] 2.3 Register form UX (show password, strength, caps lock)

### Sprint 3
- [ ] 3.1 Onboarding checklist + tour tooltip

### Sprint 4
- [ ] 4.1 Accessibility audit + fixes
- [ ] 4.2 Mobile audit + fixes

### Cross-cutting
- [ ] DB migrations land in 3 separate commits
- [ ] Audit event types added to enum
- [ ] Coolify env vars set (RESEND_API_KEY, EMAIL_*, KEYNV_RESEND_WEBHOOK_SECRET)
- [ ] Lighthouse CI wired in GitHub Actions
