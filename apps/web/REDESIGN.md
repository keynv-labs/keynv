# keynv Web Dashboard — Visual Redesign Spec

## Why This Redesign Works

keynv occupies a peculiar product space: it's a security tool that *deliberately withholds* the very data its users came to manage. The UI's job is to make that absence feel like *strength*, not deprivation — and the way we do that is by surfacing every other signal at maximum density: rotation cadence, access recency, chain integrity, environment health, approval velocity. Engineers will stare at this for hours; the design borrows from Linear's information density, Raycast's keyboard-first ergonomics, and Arc's calm dark surfaces — three products that respect their users' time and attention. Monospace typography for aliases/IDs/hashes telegraphs that *those strings are the operative datatype* — the secret values themselves are absent on purpose, and the prominence of references makes that absence a feature. The single-accent rule per view, the semantic env-tier coloring, and the tiny green/amber/red health dots replace the "wall of cards" Phase 1 prototype with a tool that feels surgical, trustworthy, and built for people who already know what they're doing.

---

## Screen 1 — APP SHELL (Chrome)

### 1a. Desktop, expanded sidebar (1440 × 900)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────┐ ┌────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│ │ ▣ keynv          ⌘K  │ │ ◀ Projects  ›  billing  ›  Secrets                                          ⌘K  ?  ◐    [FB] ▾  │   │
│ │ ──────────────────────│ ├────────────────────────────────────────────────────────────────────────────────────────────────┤   │
│ │                        │ │                                                                                                │   │
│ │  HOME                  │ │                                                                                                │   │
│ │  ▸ Projects        gp │ │                                                                                                │   │
│ │  ▸ Audit log       ga │ │                                                                                                │   │
│ │  ▸ Approvals    3  gr │ │                                                                                                │   │
│ │                        │ │                                                                                                │   │
│ │  WORKSPACE             │ │                       MAIN CONTENT SLOT                                                        │   │
│ │  ▸ Members             │ │                       (page-specific content renders here)                                     │   │
│ │  ▸ Settings        gs │ │                                                                                                │   │
│ │                        │ │                                                                                                │   │
│ │  ADMIN                 │ │                                                                                                │   │
│ │  ▸ Users               │ │                                                                                                │   │
│ │  ▸ Audit verify        │ │                                                                                                │   │
│ │  ▸ KEK rotation        │ │                                                                                                │   │
│ │                        │ │                                                                                                │   │
│ │                        │ │                                                                                                │   │
│ │                        │ │                                                                                                │   │
│ │ ──────────────────────│ │                                                                                                │   │
│ │ ● audit chain verified │ │                                                                                                │   │
│ │   2 min ago            │ │                                                                                                │   │
│ │                        │ │                                                                                                │   │
│ │ [FB] furkan@…           │ │                                                                                                │   │
│ │      Owner       ◀    │ │                                                                                                │   │
│ └────────────────────────┘ └────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│   240px sidebar              flexible main (max-w 1180, gutter p-6)                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                ┌─────────────────────────────────┐
                                                                                                │ ✓ Secret rotated successfully   │  ← toast slot
                                                                                                │   billing.prod.STRIPE_KEY       │     bottom-right
                                                                                                └─────────────────────────────────┘     z-50
```

### 1b. Desktop, collapsed sidebar (toggled via the `◀` chevron, persists per user)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌────┐ ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ▣ │ │ ◀ Projects  ›  billing  ›  Secrets                                                          ⌘K  ?  ◐    [FB] ▾       │ │
│ │ ───│ ├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │    │ │                                                                                                                       │ │
│ │ ⌂ │ │                                                                                                                       │ │
│ │ ⎙ │ │                                                                                                                       │ │
│ │ ✓3│ │                              MAIN CONTENT SLOT                                                                        │ │
│ │ ───│ │                              (icons-only sidebar reveals tooltip on hover, 250ms delay)                              │ │
│ │ ◯ │ │                                                                                                                       │ │
│ │ ⚙ │ │                                                                                                                       │ │
│ │ ───│ │                                                                                                                       │ │
│ │ ⛤ │ │                                                                                                                       │ │
│ │ ⚖ │ │                                                                                                                       │ │
│ │ ⟲ │ │                                                                                                                       │ │
│ │    │ │                                                                                                                       │ │
│ │ ───│ │                                                                                                                       │ │
│ │ ●  │ │                                                                                                                       │ │
│ │ FB │ │                                                                                                                       │ │
│ │ ▶ │ │                                                                                                                       │ │
│ └────┘ └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│  56px                                                                                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1c. Mobile drawer trigger (768px wide)

```
┌────────────────────────────────────────────────────────────┐
│  ☰  ▣ keynv                              ⌘K   [FB] ▾    │  ← top bar 56px, sticky
├────────────────────────────────────────────────────────────┤
│  ◀ Projects  ›  billing                                    │  ← breadcrumb, scroll-x if overflow
├────────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│                  MAIN CONTENT                              │
│                  (full-width, p-4 gutter)                  │
│                                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘

  Tap ☰ → Sheet slides in from left (280px wide, scrim behind):

┌────────────────────────────┬───────────────────────────────┐
│ ▣ keynv             ⨯    │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← scrim 60% black
│ ──────────────────────────│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  HOME                      │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ Projects                │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ Audit log               │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ Approvals  3            │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  WORKSPACE                 │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ Members                 │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ Settings                │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ADMIN                     │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ Users                   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ Audit verify            │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ▸ KEK rotation            │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ──────────────────────────│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ● chain verified           │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│   2 min ago                │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ [FB] furkan@gmail   Owner  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Sign out                   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────┴───────────────────────────────┘
```

### Interactions / states

- **Sidebar collapse**: click `◀` chevron at bottom toggles 240px ↔ 56px; preference persisted in `localStorage('keynv.sidebar.collapsed')`. Transition is 180ms ease-out, content re-flows in same frame.
- **Breadcrumb bar**: 48px tall, sticky to top of main pane. Each segment is a link (cmd-click opens new tab). Last segment is current page (fg, not muted). Right side hosts ⌘K hint, ?-shortcut help, theme toggle (◐), and user menu.
- **User menu (avatar dropdown)**: opens a `DropdownMenu` with: Account, CLI tokens, Switch organization, Theme (Light/Dark/System), Sign out. Driven by initials avatar (`[FB]`) — falls back to gravatar if available.
- **Toast slot**: `aria-live=polite` region pinned bottom-right (24px from edges). Stacks max 3 visible. Auto-dismiss 4s for success, sticky for error until user closes.
- **Modal/dialog slot**: portal at root, scrim `bg-overlay`, focus-trapped, `Esc` closes (unless destructive AlertDialog requires explicit cancel).
- **Command palette slot**: same portal layer, mounts above modal scrim if both somehow open (palette wins).
- **Mobile breakpoint**: < 768px collapses sidebar to `Sheet`. The chain-integrity pill stays in the sheet footer (it's a trust signal, must remain visible).
- **Loading state for shell**: skeleton renders the chrome immediately (sidebar + breadcrumb shape) while the main pane streams in via Suspense — never a blank flash.
- **Error state**: top-level error boundary replaces main pane only with a `Card` showing the error code, request ID, and "Reload" / "Report" actions. Sidebar remains usable.

---

## Screen 2 — /projects (Dashboard / Home Landing)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▣ keynv  │ ◀ Projects                                                                              ⌘K  ?  ◐    [FB] ▾           │
│          ├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  HOME    │                                                                                                                      │
│  Projects│   Projects                                                                                  ╔═══════════════════╗   │
│  Audit   │   Operational state across your organization.                                              ║  + New project    ║   │
│  Approv 3│                                                                                            ╚═══════════════════╝   │
│          │                                                                                                                      │
│  WORKSPC │   ┌──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐                     │
│  Members │   │ TOTAL SECRETS        │ ACCESSED TODAY        │ PENDING APPROVALS    │ AUDIT CHAIN          │                     │
│  Setting │   │                      │                      │                      │                      │                     │
│          │   │  127                 │  84                  │  3                   │  ● Verified         │                     │
│  ADMIN   │   │  ▲ +4 this week      │  across 6 projects   │  ! oldest: 18m ago   │   #a3f2c…  2m ago   │                     │
│  Users   │   │                      │                      │                      │  [Re-verify]        │                     │
│  Audit V │   └──────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘                     │
│  KEK rot │                                                                                                                      │
│          │   ┌────────────────────────────────────────────────────────────────────┐  ┌──────────────────────────────────────┐ │
│          │   │  PROJECTS                                       Filter ▾   /search │  │  RECENT ACTIVITY                     │ │
│ ─────────│   ├────────────────────────────────────────────────────────────────────┤  ├──────────────────────────────────────┤ │
│ ● chain  │   │                                                                    │  │                                      │ │
│ verified │   │  billing                              ● ● ●        ⋯              │  │  [SK]  sara@…  rotated               │ │
│ 2 min ago│   │  Stripe + invoice infra                                            │  │  ○ billing.prod.STRIPE_KEY           │ │
│          │   │  3 envs · 24 secrets · 5 members           dev  stg  prod          │  │  3m ago                              │ │
│ [FB]     │   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │                                      │ │
│ furkan@… │   │                                                                    │  │  [FB]  furkan@…  approved            │ │
│ Owner ▾  │   │  api-gateway                          ● ● !        ⋯              │  │  ⛤ api-gateway prod access for       │ │
│          │   │  Edge proxy + rate limit              dev  stg  prod               │  │  liu@…  · 12m ago                    │ │
│          │   │  3 envs · 18 secrets · 8 members                                   │  │                                      │ │
│          │   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │  [LH]  liu@…  requested              │ │
│          │   │                                                                    │  │  ⛤ access to api-gateway prod        │ │
│          │   │  data-pipeline                        ● ●          ⋯              │  │  18m ago                             │ │
│          │   │  ETL + warehouse keys                 dev  stg                     │  │                                      │ │
│          │   │  2 envs · 41 secrets · 3 members                                   │  │  [SK]  sara@…  added                 │ │
│          │   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │  ○ data-pipeline.dev.SNOWFLAKE_USER  │ │
│          │   │                                                                    │  │  41m ago                             │ │
│          │   │  internal-tools                       ●            ⋯              │  │                                      │ │
│          │   │  CI / runner secrets                  dev                          │  │  [FB]  furkan@…  invited             │ │
│          │   │  1 env · 9 secrets · 12 members                                   │  │  ✉ liu@… as Member                  │ │
│          │   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │  · 2h ago                            │ │
│          │   │                                                                    │  │                                      │ │
│          │   │  ml-infra                             ● ● ●        ⋯              │  │  [SK]  sara@…  deleted               │ │
│          │   │  Hugging Face / Replicate             dev  stg  prod               │  │  ○ billing.dev.OLD_TEST_KEY          │ │
│          │   │  3 envs · 15 secrets · 4 members                                   │  │  · 3h ago                            │ │
│          │   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │                                      │ │
│          │   │                                                                    │  │  [LH]  liu@…  signed in              │ │
│          │   │  growth-marketing                     ● ●          ⋯              │  │  · 4h ago                            │ │
│          │   │  Customer.io + analytics              dev  stg                     │  │                                      │ │
│          │   │  2 envs · 20 secrets · 6 members                                   │  │  ─────────────────────────────────   │ │
│          │   └────────────────────────────────────────────────────────────────────┘  │  View all activity ›                 │ │
│          │                                                                            └──────────────────────────────────────┘ │
│          │   Showing 6 of 6 projects                                                                                            │
│          │                                                                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

env health legend:    ● green = all secrets healthy  ● amber = ≥1 due for rotation   ● red/! = ≥1 expired or failing health check
```

### Empty state (zero projects)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│   Projects                                                                   │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                                                                    │   │
│   │                          ◯                                         │   │
│   │                   no projects yet                                  │   │
│   │                                                                    │   │
│   │   A project is a namespace for secrets. References look like       │   │
│   │   `@<project>.<env>.<key>` and get resolved by the keynv CLI       │   │
│   │   without ever exposing the value to your AI agent.                │   │
│   │                                                                    │   │
│   │   ┌────────────────────────────────────────────────────────────┐ │   │
│   │   │  Example:                                                   │ │   │
│   │   │                                                             │ │   │
│   │   │   $ keynv exec -- pnpm dev                                 │ │   │
│   │   │     resolves @billing.dev.STRIPE_KEY into the subprocess   │ │   │
│   │   │                                                             │ │   │
│   │   └────────────────────────────────────────────────────────────┘ │   │
│   │                                                                    │   │
│   │            ╔════════════════════════╗                              │   │
│   │            ║  + Create first project║                              │   │
│   │            ╚════════════════════════╝                              │   │
│   │                                                                    │   │
│   │            or run `keynv project init` from the CLI                │   │
│   │                                                                    │   │
│   └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Interactions / states

- **Top rollup cards**: 4-column grid on ≥1280px, 2-column on ≥768px, stacked on mobile. Each is a link to its detail surface (e.g., "Pending approvals" → `/projects/[?]/approvals` with org-wide filter; "Audit chain" → `/admin/audit/verify`).
- **Project rows**: hover raises bg one level (`bg-elevated`), shows trailing ⋯ icon for project-level menu (Rename, Archive, Settings, Copy ID). Whole row clickable → `/projects/[id]`. Env dots are clickable → jumps to `/projects/[id]/secrets?env=prod` etc.
- **Filter bar inside Projects card**: `Filter ▾` opens a `DropdownMenu` with checkable env filters and member filters; `/` shortcut focuses the inline search; result count updates live.
- **Recent activity rail**: shows 10 events; each row's actor avatar + verb + object (alias rendered in mono with env-tier color); clicking expands details inline (no navigation). "View all activity" deep-links to `/audit`.
- **Loading state**: rollup cards render skeleton bars (animated shimmer 1.4s loop), project rows render 6 skeleton lines, activity rail renders 10 skeleton items. Shell is never blank.
- **Error state**: each card has its own boundary; if rollup query fails, only that card shows "Couldn't load · retry"; the rest of the page works.
- **Empty state**: only triggers when org has zero projects (rare) — designed to teach the alias mental model in the same screen real estate the loaded view uses.

---

## Screen 3 — /projects/[id]/secrets (Daily Driver)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▣ keynv  │ ◀ Projects › billing › Secrets                                                            ⌘K  ?  ◐    [FB] ▾         │
│          ├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  HOME    │                                                                                                                      │
│  Projects│   billing                                                                            ╔═════════════════════════╗   │
│  Audit   │   Stripe + invoice infrastructure                                                    ║  + New secret      n   ║   │
│  Approv 3│   ─────────────────────────────────────────────────────────────────────────────     ╚═════════════════════════╝   │
│          │   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│          │   │  Overview │  Secrets ●  │  Audit │  Members │  Approvals 1 │  Status │  Settings                            │ │
│  WORKSPC │   └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│  Members │                                                                                                                    │
│  Setting │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│          │   │  Env: ▾ all (3)    Health: ▾ all    /  search alias…                              24 secrets · 3 envs      │ │
│  ADMIN   │   └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│  Users   │                                                                                                                    │
│  Audit V │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  KEK rot │   │ ALIAS                                ENV   VER  ROTATED       LAST ACCESSED BY                  HEALTH   ⋯ │ │
│          │   ├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│          │   │ @billing.dev.STRIPE_KEY              dev   v3   12d ago      [SK] sara@…   ·  3m ago                ●     │ │
│ ─────────│   │ @billing.dev.WEBHOOK_SECRET          dev   v1   89d ago      [FB] furkan@… ·  2h ago                ●     │ │
│ ● chain  │   │ @billing.dev.PG_PASSWORD             dev   v2   31d ago      [LH] liu@…    ·  18m ago               ●     │ │
│ verified │   │ @billing.dev.SENDGRID_API            dev   v1   142d ago     [SK] sara@…   ·  1d ago                ●     │ │
│ 2 min ago│   ├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│          │   │ @billing.stg.STRIPE_KEY              stg   v3   12d ago      [FB] furkan@… ·  44m ago               ●     │ │
│ [FB]     │   │ @billing.stg.WEBHOOK_SECRET          stg   v2   45d ago      [SK] sara@…   ·  6h ago                ●     │ │
│ furkan@… │   │ @billing.stg.PG_PASSWORD             stg   v2   31d ago      [LH] liu@…    ·  3h ago                ●     │ │
│ Owner ▾  │   │ @billing.stg.SENDGRID_API            stg   v1   142d ago     [SK] sara@…   ·  9h ago                ●     │ │
│          │   ├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│          │   │ @billing.prod.STRIPE_KEY             prod  v4   3m ago       [SK] sara@…   ·  3m ago                ●     │ │
│          │   │ @billing.prod.WEBHOOK_SECRET         prod  v3   45d ago      [FB] furkan@… ·  12m ago               ●     │ │
│          │   │ @billing.prod.PG_PASSWORD            prod  v3   31d ago      [LH] liu@…    ·  1h ago        ⟳ rotate ⋯  │ │
│          │   │   └ rotation due in 14d                                                                              ●     │ │
│          │   │ @billing.prod.SENDGRID_API           prod  v1   142d ago     [SK] sara@…   ·  4h ago                ●     │ │
│          │   │ @billing.prod.DATADOG_KEY            prod  v2   201d ago     —             ·  never                  !     │ │
│          │   │ @billing.prod.AWS_S3_INVOICES        prod  v1   312d ago     [FB] furkan@… ·  18d ago               !     │ │
│          │   └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│          │                                                                                                                    │
│          │   Showing 24 of 24 secrets                                                                       Export ▾  ↑ Top   │
│          │                                                                                                                    │
└──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  hovered row reveals action icons (rotate, view audit, run test, delete) at the right end:

  │ @billing.prod.PG_PASSWORD            prod  v3   31d ago    [LH] liu@…    ·  1h ago      ●  ⟳ ⎙ ▶ ⌫  │
                                                                                              │ │ │ │
                                                                                              │ │ │ └ delete
                                                                                              │ │ └── run test
                                                                                              │ └──── view audit
                                                                                              └────── rotate
```

### "+ New secret" Dialog (modal, never inline)

```
                ╔══════════════════════════════════════════════════════════════════╗
                ║  New secret                                                  ⨯ ║
                ║  ──────────────────────────────────────────────────────────────  ║
                ║                                                                  ║
                ║  Reference will be:                                              ║
                ║  ┌────────────────────────────────────────────────────────────┐ ║
                ║  │  @billing . [env ▾] . [____________________________]       │ ║
                ║  │                                                             │ ║
                ║  │  resolves to:  @billing.prod.STRIPE_KEY                    │ ║
                ║  └────────────────────────────────────────────────────────────┘ ║
                ║                                                                  ║
                ║  Environment                                                     ║
                ║  ( ) dev      ( ) staging      (●) prod                          ║
                ║                                                                  ║
                ║  Alias key                                                       ║
                ║  ┌────────────────────────────────────────────────────────────┐ ║
                ║  │  STRIPE_KEY                                                 │ ║
                ║  └────────────────────────────────────────────────────────────┘ ║
                ║  UPPER_SNAKE_CASE recommended.  Must be unique within env.      ║
                ║                                                                  ║
                ║  Value                                                           ║
                ║  ┌────────────────────────────────────────────────────────────┐ ║
                ║  │  ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●                       │ ║
                ║  │                                                             │ ║
                ║  └────────────────────────────────────────────────────────────┘ ║
                ║  This is the only time the value is visible to you.            ║
                ║  After submit, no UI surface (this dashboard included)         ║
                ║  will display it again.  CLI subprocesses can still resolve.   ║
                ║                                                                  ║
                ║  Rotation cadence                                                ║
                ║  ▾ Every 90 days   (alerts at 75 days, expired at 90)           ║
                ║                                                                  ║
                ║  ─────────────────────────────────────────────────────────────  ║
                ║                       [ Cancel ]    ╔══════════════════════╗   ║
                ║                                     ║  Create secret  ⌘↵  ║   ║
                ║                                     ╚══════════════════════╝   ║
                ╚══════════════════════════════════════════════════════════════════╝
```

### Destructive AlertDialog (delete row)

```
                ╔══════════════════════════════════════════════════════════════════╗
                ║  ⚠  Delete secret?                                                ║
                ║  ──────────────────────────────────────────────────────────────  ║
                ║                                                                  ║
                ║  You are about to delete:                                        ║
                ║                                                                  ║
                ║      @billing.prod.STRIPE_KEY                                    ║
                ║                                                                  ║
                ║  This is destructive and cannot be undone.  Existing CLI         ║
                ║  subprocesses caching this value will continue to work until    ║
                ║  process exit.  New resolutions will fail.                      ║
                ║                                                                  ║
                ║  Type the alias key to confirm:                                  ║
                ║  ┌────────────────────────────────────────────────────────────┐ ║
                ║  │  STRIPE_KEY                                                 │ ║
                ║  └────────────────────────────────────────────────────────────┘ ║
                ║                                                                  ║
                ║  ─────────────────────────────────────────────────────────────  ║
                ║                       [ Cancel ]    ╔══════════════════════╗   ║
                ║                                     ║  Delete permanently  ║   ║
                ║                                     ╚══════════════════════╝   ║
                ║                                       (red, disabled until typed) ║
                ╚══════════════════════════════════════════════════════════════════╝
```

### Empty state

```
┌──────────────────────────────────────────────────────────────────────────────┐
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │                                                                    │   │
│   │                          ⌗                                         │   │
│   │                  no secrets in this project                        │   │
│   │                                                                    │   │
│   │   Add a secret to start using `@billing.<env>.<alias>` references  │   │
│   │   in your code.  The CLI resolves them at exec-time without ever   │   │
│   │   exposing the value to the AI agent.                              │   │
│   │                                                                    │   │
│   │   Three things happen when you add a secret:                       │   │
│   │     1.  Value is encrypted with this project's DEK                 │   │
│   │     2.  Reference `@billing.<env>.<key>` becomes resolvable        │   │
│   │     3.  An entry is appended to the audit chain                    │   │
│   │                                                                    │   │
│   │            ╔════════════════════════╗                              │   │
│   │            ║  + Add first secret  n║                              │   │
│   │            ╚════════════════════════╝                              │   │
│   │                                                                    │   │
│   │            or run `keynv secret add @billing.dev.<KEY>` from CLI   │   │
│   └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Interactions / states

- **Tabs row**: secondary nav inside the project. The active tab (`Secrets ●`) shows a 2px accent underline and a subtle dot if there's pending state (e.g., `Approvals 1`). Cmd-click any tab to open in new window.
- **Filter bar**: env multi-select is a `DropdownMenu` with checkboxes; default = all. Health filter is similar (all / green / amber / red). The `/` keyboard shortcut focuses the search input from anywhere on the page.
- **Table rows**: env-tier coloring lives in the `ENV` cell badge only — dev = neutral (gray), staging = warn-toned amber edge, prod = serious-toned (deeper red-ish slate). Aliases are mono. Health dot is the only color in the row otherwise — keeps eyes drawn to anomalies. Hovering a row exposes inline action icons aligned right of the health dot; the row's own click target (alias cell) opens the secret detail drawer (right sheet).
- **`+ New secret`** opens the Dialog above. Submitting closes the dialog, fires `Toast: ✓ Created @billing.prod.STRIPE_KEY`, optimistically inserts the row with a 4px translate-from-bottom + 120ms fade.
- **Rotation indication**: a sub-row beneath aliases that are within their warning window shows `└ rotation due in 14d` in muted fg with an amber chevron. Expired secrets show `!` health and `└ rotation overdue 12d` in danger color.
- **Loading state**: 12 skeleton rows with mono-shaped placeholder bars matching column widths. Tabs render their static labels but counts (`Approvals 1`) skeleton-shimmer until loaded.
- **Error state**: table region replaced with a Card: "Couldn't load secrets — `audit_log` write failed (request id `req_…`)" + Retry button. Filter bar above remains, so user can attempt a narrower query.
- **Empty state**: shown when zero secrets in project; teaches alias model in same place loaded view sits.
- **Permissions**: Viewer role sees identical screen but `+ New secret` and per-row destructive actions are disabled with a Tooltip ("Requires Admin or Owner").

---

## Screen 4 — /projects/[id]/audit (Timeline / Log View)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ▣ keynv  │ ◀ Projects › billing › Audit                                                              ⌘K  ?  ◐    [FB] ▾         │
│          ├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  HOME    │                                                                                                                      │
│  Projects│   billing  /  Audit                                                                                                   │
│  Audit   │   ─────────────────────────────────────────────────────────────────────────────────                                  │
│  Approv 3│                                                                                                                      │
│          │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│          │   │  Overview │  Secrets │  Audit ●  │  Members │  Approvals 1 │  Status │  Settings                           │ │
│  WORKSPC │   └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│  Members │                                                                                                                    │
│  Setting │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│          │   │   ● Audit chain verified         #a3f2c… → #d8e1b…   ·  2 min ago                  [ Re-verify ]  [ Export ]│ │
│  ADMIN   │   │     1,284 entries · merkle root validated · all hashes consistent                                          │ │
│  Users   │   └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│  Audit V │                                                                                                                    │
│  KEK rot │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│          │   │  Actor: ▾ all (5)   Type: [project] [member] [secret ●] [approval]   Range: ▾ Last 7 days   /search alias  │ │
│          │   └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│          │                                                                                                                    │
│ ─────────│   ─── Today, May 9 ──────────────────────────────────────────────────────────────────────────────────────────  │
│ ● chain  │                                                                                                                    │
│ verified │   ▸ [SK] sara@…  rotated  ○ @billing.prod.STRIPE_KEY  v3 → v4                                          3m ago  │
│ 2 min ago│   ▸ [FB] furkan@…  approved  ⛤ access to api-gateway prod for liu@…                                   12m ago │
│          │   ▸ [LH] liu@…  resolved  ○ @billing.prod.PG_PASSWORD  via keynv exec (pid 84211)                    18m ago │
│ [FB]     │   ▸ [LH] liu@…  requested  ⛤ access to api-gateway prod  reason: "rerunning migration"                25m ago │
│ furkan@… │   ▸ [SK] sara@…  resolved  ○ @billing.dev.STRIPE_KEY  via MCP (claude-code session abc-…)             44m ago │
│ Owner ▾  │   ▸ [FB] furkan@…  signed in  ⌧ from 73.142.x.x · macOS · Chrome                                        1h ago  │
│          │                                                                                                                    │
│          │   ─── Yesterday, May 8 ──────────────────────────────────────────────────────────────────────────────────────  │
│          │                                                                                                                    │
│          │   ▾ [SK] sara@…  added  ○ @billing.dev.SENDGRID_API  v1                                                3h ago  │
│          │     ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐     │
│          │     │  event_type:    secret.created                                                                    │     │
│          │     │  alias:         @billing.dev.SENDGRID_API                                                         │     │
│          │     │  version:       1                                                                                 │     │
│          │     │  actor_id:      usr_2dF9…                                                                         │     │
│          │     │  ip:            192.0.2.84                                                                        │     │
│          │     │  user_agent:    Mozilla/5.0 (Macintosh; …)                                                        │     │
│          │     │  prev_hash:     #c1a4f8e0b27d…                                                                    │     │
│          │     │  hash:          #d8e1b29a4f31…                                                                    │     │
│          │     │  rotation:      cadence_days: 90                                                                  │     │
│          │     │  metadata:      { dek_version: 7, kek_id: "kek_2024_q3" }                                         │     │
│          │     │                                                                                                  │     │
│          │     │  [Copy as JSON]   [Verify this hash]                                                              │     │
│          │     └──────────────────────────────────────────────────────────────────────────────────────────────────┘     │
│          │                                                                                                                    │
│          │   ▸ [FB] furkan@…  invited  ✉ liu@… as Member                                                          5h ago  │
│          │   ▸ [SK] sara@…  deleted  ○ @billing.dev.OLD_TEST_KEY  v2                                              7h ago  │
│          │   ▸ [FB] furkan@…  changed  ⚙ project settings  cadence_default: 60d → 90d                            8h ago  │
│          │                                                                                                                    │
│          │   ─── Wed, May 7 ────────────────────────────────────────────────────────────────────────────────────────────  │
│          │                                                                                                                    │
│          │   ▸ [SK] sara@…  rotated  ○ @billing.dev.STRIPE_KEY  v2 → v3                                           2d ago  │
│          │   ▸ [LH] liu@…  resolved  ○ @billing.dev.PG_PASSWORD  via keynv exec (pid 41128)                       2d ago │
│          │   ▸ [SK] sara@…  rotated  ○ @billing.stg.STRIPE_KEY  v2 → v3                                           2d ago  │
│          │                                                                                                                    │
│          │                                          ─── Load older entries ───                                             │
│          │                                                                                                                    │
└──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  legend:  ▸ = collapsed entry  ▾ = expanded entry showing full event payload + hash chain links
           ● green = verified  ! amber = stale verification (> 1h)  ! red = chain broken
```

### Re-verify in progress (replaces banner content)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│   ◐ Re-verifying audit chain…   walking 1,284 entries  ·  ████████░░░░░░  62%               [ Cancel ]    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Empty state (no events match filter)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                            │
│                                          ◯                                                                 │
│                            no events match these filters                                                   │
│                                                                                                            │
│             Try widening the date range or clearing actor / type filters.                                  │
│                                                                                                            │
│                                  [ Clear all filters ]                                                     │
│                                                                                                            │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interactions / states

- **Integrity banner**: dominant trust signal at top. Shows latest verified hash range and time-since-verification. After 1h shows amber state ("verification stale — re-verify"); on a broken chain (rare/forensic), pulses red and shows the first divergent hash inline with a link to a forensic detail page (admin only).
- **`Re-verify`**: triggers server-side hash walk; the banner morphs into a progress bar (deterministic % since total entry count is known). On completion, banner returns to verified state and a Toast confirms.
- **Filter bar**: Actor multi-select with avatar previews; Type filter is a row of toggleable pills (filled = active); Date range opens a Popover with presets ("Today", "Last 7 days", "Last 30 days", "Custom…"); search filters by alias substring.
- **Sticky day separators**: as user scrolls, the current day's separator pins to top of the list region (under the filter bar). Format adjusts: "Today", "Yesterday", "Wed, May 7", "Apr 12, 2026".
- **Row expand**: clicking the chevron `▸` expands inline (180ms ease-out) showing the full event payload as a key/value list with mono values, plus `prev_hash` → `hash` chain pointers. Two actions inside: "Copy as JSON" (copies full event), "Verify this hash" (server re-computes just this entry).
- **Object icons**: small leading glyphs to make event types visually scannable — `○` = secret, `⛤` = approval, `✉` = invite, `⌧` = session, `⚙` = settings.
- **Loading state**: banner renders skeleton bar; filter row stays interactive (filters operate on already-loaded data via server query); rows render 8 skeleton items with day separator placeholder.
- **Error state**: if integrity check itself errors, banner shows red `! verification error — chain may be intact, backend unreachable` with retry; if list query fails, list region shows error card while banner remains.
- **Export**: `Export ▾` dropdown offers CSV (filtered visible set) and JSON (full payload of filtered set, signed). Both downloads include a manifest line with the verified hash range used at export time.

---

## Screen 5 — Command Palette (⌘K)

```
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                    ░░░░░░░░╔══════════════════════════════════════════════════════════════════╗░░░░░░░░░░
                    ░░░░░░░░║  ⌕  Search or run a command…                                  ⎋ ║░░░░░░░░░░
                    ░░░░░░░░╠══════════════════════════════════════════════════════════════════╣░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  GO TO                                                           ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⌂  Projects                                            g p ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⎙  Audit log                                            g a ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ✓  Approvals                                            g r ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⚙  Settings                                             g s ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ◯  Members                                              g m ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  ACTIONS                                                         ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ +  New project                                                ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ +  New secret in current project                            n ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⟳  Verify audit chain                                          ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⌧  Sign out                                                    ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ◐  Toggle theme                                                ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  RECENT                                                          ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⌂  billing  · project                                          ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⌂  api-gateway  · project                                      ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ○  @billing.prod.STRIPE_KEY  · secret                          ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⛤  api-gateway prod access  · approval                         ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⎙  billing audit · 1,284 entries                               ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░╠══════════════════════════════════════════════════════════════════╣░░░░░░░░░░
                    ░░░░░░░░║   ↑↓ navigate    ↵ select    > prefix to filter actions    ⎋ close  ║░░░░░░░░░░
                    ░░░░░░░░╚══════════════════════════════════════════════════════════════════╝░░░░░░░░░░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

   palette is 640px wide, centered horizontally, top-offset 20vh.  Scrim is bg-overlay 70%.
```

### Filtered state — typing `> rot` (action filter)

```
                    ░░░░░░░░╔══════════════════════════════════════════════════════════════════╗░░░░░░░░░░
                    ░░░░░░░░║  ⌕  > rot|                                                    ⎋ ║░░░░░░░░░░
                    ░░░░░░░░╠══════════════════════════════════════════════════════════════════╣░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  ACTIONS                                                         ║░░░░░░░░░░
                    ░░░░░░░░║  ▶ ⟳  Rotate @billing.prod.STRIPE_KEY                              ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⟳  Rotate @billing.prod.PG_PASSWORD                            ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⟳  KEK rotation (admin)                                        ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  GO TO                                                           ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⌂  KEK rotation page                                           ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░╠══════════════════════════════════════════════════════════════════╣░░░░░░░░░░
                    ░░░░░░░░║   ↑↓ navigate    ↵ select    ⎋ close                              ║░░░░░░░░░░
                    ░░░░░░░░╚══════════════════════════════════════════════════════════════════╝░░░░░░░░░░
```

### Filtered state — typing `bill` (navigation/object filter, no `>`)

```
                    ░░░░░░░░╔══════════════════════════════════════════════════════════════════╗░░░░░░░░░░
                    ░░░░░░░░║  ⌕  bill|                                                     ⎋ ║░░░░░░░░░░
                    ░░░░░░░░╠══════════════════════════════════════════════════════════════════╣░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  PROJECTS                                                        ║░░░░░░░░░░
                    ░░░░░░░░║  ▶ ⌂  billing                                                     ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  SECRETS                                                         ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ○  @billing.dev.STRIPE_KEY                                     ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ○  @billing.dev.WEBHOOK_SECRET                                 ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ○  @billing.dev.PG_PASSWORD                                    ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ○  @billing.stg.STRIPE_KEY                                     ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ○  @billing.prod.STRIPE_KEY                                    ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║  AUDIT                                                           ║░░░░░░░░░░
                    ░░░░░░░░║   ▸ ⎙  billing audit log                                           ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░╠══════════════════════════════════════════════════════════════════╣░░░░░░░░░░
                    ░░░░░░░░║   ↑↓ navigate    ↵ select    ⎋ close                              ║░░░░░░░░░░
                    ░░░░░░░░╚══════════════════════════════════════════════════════════════════╝░░░░░░░░░░
```

### Empty state — no matches

```
                    ░░░░░░░░╔══════════════════════════════════════════════════════════════════╗░░░░░░░░░░
                    ░░░░░░░░║  ⌕  zzz|                                                      ⎋ ║░░░░░░░░░░
                    ░░░░░░░░╠══════════════════════════════════════════════════════════════════╣░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║                       No matches for "zzz"                       ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░║                  Try `> ` to filter to actions only              ║░░░░░░░░░░
                    ░░░░░░░░║                                                                  ║░░░░░░░░░░
                    ░░░░░░░░╚══════════════════════════════════════════════════════════════════╝░░░░░░░░░░
```

### Interactions / states

- **Open**: ⌘K (Mac) / Ctrl+K (others) anywhere in the app. Mounts in a portal above any other overlay; if a Dialog is already open the palette wins focus and the Dialog dims.
- **Input parsing**: leading `>` switches into actions-only mode (matches against verbs like "rotate", "delete", "verify"); no prefix performs fuzzy match across projects, secret aliases, audit entries, members, settings pages. Aliases match by full path or any segment.
- **Keyboard**: ↑/↓ to move; ↵ to execute; ⌘↵ to execute and open in new tab (where applicable); Tab cycles through groups; ⎋ closes. Selected item shows ▶ marker and a 1px accent left-border.
- **Recent**: derived from a small client-side ring buffer (last 5 visited objects). Cleared on sign-out.
- **Action confirmations**: destructive actions invoked through the palette still trigger their AlertDialog (e.g., `> Delete @billing.dev.X` opens the typed-confirmation modal — the palette never bypasses confirmation).
- **Loading**: results below the input render with a thin animated underline on the input while server-fed groups (Audit, Members) stream in. Local groups (recent, hard-coded actions) are instant.
- **Empty / Error**: empty shows the hint above; if a server-fed group errors, that group renders `▸ ⚠ Couldn't load <group>` and other groups still work.
- **A11y**: input is `role=combobox`; result list `role=listbox`; each item `role=option`; live region announces "N results, top: <label>".

---

## A. Design tokens

### A1. Color — surfaces

| Token | Hex | Usage |
|---|---|---|
| `--surface-bg` | `#0a0c0f` | Body background. One step darker than current `#0b0d10` for slightly more depth contrast against cards. |
| `--surface-bg-elevated` | `#13161b` | Cards, table rows, sidebar panel. |
| `--surface-bg-elevated-hover` | `#181c22` | Row hover, button hover. |
| `--surface-bg-overlay` | `#1c2028` | Dialog, palette, popover. Slightly warmer to read as "above". |
| `--surface-bg-scrim` | `#000000` at 70% | Modal scrim. |
| `--surface-border` | `#23272f` | Default 1px borders. |
| `--surface-border-strong` | `#2f343d` | Emphasized borders, selected states. |

### A2. Color — foreground

| Token | Hex | Usage |
|---|---|---|
| `--fg` | `#e9ecf2` | Primary text, headings. |
| `--fg-muted` | `#9098a4` | Secondary text, labels, meta. |
| `--fg-subtle` | `#5d6470` | Tertiary text, placeholder, disabled. |
| `--fg-on-accent` | `#ffffff` | Text on accent-colored buttons. |

### A3. Color — accent (single primary)

| Token | Hex | Usage |
|---|---|---|
| `--accent` | `#5b8def` | Primary action only. One per view. |
| `--accent-hover` | `#7099f3` | Hover state. |
| `--accent-pressed` | `#4677d6` | Active/pressed state. |
| `--accent-subtle` | `#5b8def` at 12% | Selection highlight, focus ring background. |
| `--accent-ring` | `#5b8def` at 50% | Focus ring outline. |

### A4. Color — semantic

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#3ec98a` | Health green, "verified" states. |
| `--success-subtle` | `#3ec98a` at 14% | Success background tint. |
| `--warn` | `#e0a93a` | Health amber, due-soon, stale verification. |
| `--warn-subtle` | `#e0a93a` at 14% | Warning background tint. |
| `--danger` | `#e25555` | Health red, destructive actions, errors. |
| `--danger-subtle` | `#e25555` at 14% | Danger background tint. |
| `--info` | `#5b8def` | Same as accent — informational notices. |

### A5. Color — environment tier

| Token | Hex | Usage |
|---|---|---|
| `--env-dev-fg` | `#9098a4` | Dev badge text — neutral, low signal. |
| `--env-dev-bg` | `#21242b` | Dev badge background. |
| `--env-dev-border` | `#2f343d` | Dev badge border. |
| `--env-stg-fg` | `#e0a93a` | Staging text — warn-toned. |
| `--env-stg-bg` | `#3a2f15` | Staging background — desaturated amber. |
| `--env-stg-border` | `#5a4520` | Staging border. |
| `--env-prod-fg` | `#e57373` | Prod text — serious. |
| `--env-prod-bg` | `#3a1f1f` | Prod background — desaturated deep red. |
| `--env-prod-border` | `#6b3030` | Prod border. |

### A6. Spacing scale

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-12` | 48px |
| `--space-16` | 64px |

### A7. Typography ramp

Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for UI; `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace` for `.mono`.

| Role | Size | Line height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `display` | 28px | 36px | 600 | -0.02em | Hero numbers in rollup cards. |
| `h1` | 22px | 30px | 600 | -0.01em | Page title (e.g., "Projects"). |
| `h2` | 18px | 26px | 600 | -0.005em | Section heading. |
| `h3` | 15px | 22px | 600 | 0 | Subsection / card title. |
| `body` | 14px | 22px | 400 | 0 | Default text. |
| `body-sm` | 13px | 20px | 400 | 0 | Table cells, dense rows. |
| `label` | 11px | 16px | 600 | 0.06em (uppercase) | Group headers ("HOME", "ACTIONS"). |
| `mono` | 13px | 20px | 450 | 0 | Aliases, IDs, hashes. Slightly heavier than 400 for legibility on dark. |
| `mono-sm` | 12px | 18px | 450 | 0 | Inline mono in dense rows. |

### A8. Radius scale

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Tags, badges, small inputs. |
| `--radius-md` | 6px | Buttons, inputs, table cells (effective). |
| `--radius-lg` | 8px | Cards, sections. |
| `--radius-xl` | 12px | Dialogs, popovers, palette. |
| `--radius-pill` | 9999px | Avatars, status pills. |

### A9. Motion

| Token | Duration |
|---|---|
| `--motion-instant` | 0ms (`prefers-reduced-motion: reduce` resolves all to this) |
| `--motion-fast` | 120ms |
| `--motion-base` | 180ms |
| `--motion-slow` | 240ms |

| Easing token | Curve |
|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` (Linear-style, snappy decelerate) |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` |
| `--ease-linear` | `linear` (loading shimmers only) |

Standard motion patterns:
- Hover bg transition: 120ms `ease-out`
- Row enter: 180ms `ease-out` opacity 0→1 + translateY 4px→0
- Modal/palette open: scrim 120ms fade, surface 180ms fade + scale 0.98→1
- Toast in: 180ms slide-up 8px + fade
- Tab underline: 180ms `ease-out` width

### A10. Elevation (shadow ramp for overlays)

| Token | Value |
|---|---|
| `--shadow-1` | `0 1px 0 0 rgba(0,0,0,0.4)` (resting cards — subtle separation) |
| `--shadow-2` | `0 4px 12px -2px rgba(0,0,0,0.5), 0 0 0 1px var(--surface-border)` (popover, dropdown) |
| `--shadow-3` | `0 16px 40px -8px rgba(0,0,0,0.6), 0 0 0 1px var(--surface-border-strong)` (dialog, palette) |
| `--shadow-focus` | `0 0 0 2px var(--surface-bg), 0 0 0 4px var(--accent-ring)` (focus ring on dark) |

---

## B. Component library plan (priority order)

| Order | Component | One-line purpose |
|---|---|---|
| 1 | **Dialog** | Hosts "+ New secret", "+ New project", invite member — every create/edit flow. Confirmation matters; we never edit inline. |
| 2 | **AlertDialog** | Destructive-only confirmation (delete secret, remove member, archive project) with type-to-confirm input. |
| 3 | **DropdownMenu** | Row ⋯ menus, env/health filter pickers, user avatar menu, project actions. |
| 4 | **Toast** (sonner-style) | Async result feedback — rotation success, link-copied, save-confirmed; auto-dismiss for success, sticky for error. |
| 5 | **Badge** | Env-tier badges (dev/stg/prod), version pills, counts ("Approvals 1"), role labels (Owner/Admin/Member/Viewer). |
| 6 | **Skeleton** | Loading state primitives across cards, rows, palette, banner — never blank flashes. |
| 7 | **Command** (cmdk-based palette) | The ⌘K palette: grouped fuzzy results, keyboard nav, action filter via `>` prefix. |
| 8 | **Table** (custom, not data-grid) | Dense secrets table, audit table, members table — handles row hover actions, sticky header, env-row coloring. |
| 9 | **Avatar** | User initials with deterministic color seed, fallback to gravatar URL when present. |
| 10 | **Tooltip** | Reveals shortcut hints, full alias on truncated cells, "Requires Admin" on disabled actions. |
| 11 | **Tabs** | Sub-nav inside `/projects/[id]/*` (Overview / Secrets / Audit / Members / Approvals / Status / Settings). |
| 12 | **Sheet** (drawer) | Mobile sidebar drawer; secret detail right-drawer (read-only metadata, audit timeline, rotate/delete actions). |
| 13 | **Switch** | Settings toggles (e.g., "Require approval for prod access", "Email me on chain failures", MFA enabled). |
| 14 | **Separator** | Token-styled horizontal/vertical dividers — keeps section spacing consistent without ad-hoc borders. |
| 15 | **Popover** | Date-range picker, filter editors, the chain-integrity hover detail (last verifier, hash range). |
| 16 | **ScrollArea** | Custom-styled scrollbars for the activity rail and palette list — native scrollbars look broken in dark theme. |
| 17 | **Combobox** | Searchable selectors (actor multi-select in audit filters, member picker for invites/approvals). |
| 18 | **Progress** | Audit re-verify progress bar; KEK rotation progress; long-running export indicator. |
| 19 | **Kbd** | Inline shortcut-key display in palette footer, tooltips, and the `?`-help overlay. |
| 20 | **Form** | Schema-bound form wrapper (zod) for create/edit dialogs — surfaces field errors inline, disables submit when invalid. |

---

## C. Keyboard shortcut map

### C1. Global (work anywhere unless inside an input)

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette. |
| `?` | Open shortcuts help overlay. |
| `⎋` | Close any overlay (palette, dialog, popover, sheet) — innermost first. |
| `g` then `p` | Go to Projects. |
| `g` then `a` | Go to Audit log (org-level). |
| `g` then `r` | Go to Approvals (org-level). |
| `g` then `s` | Go to Settings. |
| `g` then `m` | Go to Members (workspace). |
| `g` then `u` | Go to Admin · Users. |
| `g` then `v` | Go to Admin · Audit verify. |
| `g` then `k` | Go to Admin · KEK rotation. |
| `g` then `h` | Go to "home" (= projects). |
| `⌘B` / `Ctrl+B` | Toggle sidebar collapse. |
| `⌘\\` / `Ctrl+\\` | Toggle theme (Dark / Light / System cycle). |
| `⌘Shift+P` | Same as `⌘K` but pre-fills `>` (actions-only). |
| `⌘Shift+L` | Sign out (with confirm). |

### C2. Page-contextual

`/projects` (dashboard)

| Shortcut | Action |
|---|---|
| `n` | New project (opens Dialog). |
| `/` | Focus the projects search field. |
| `↑` / `↓` | Move selection in project list. |
| `↵` | Open selected project. |
| `⌘↵` | Open selected project in new tab. |
| `f` | Open filter dropdown. |

`/projects/[id]/secrets`

| Shortcut | Action |
|---|---|
| `n` | New secret (opens Dialog). |
| `/` | Focus alias search. |
| `1` / `2` / `3` | Filter to dev / staging / prod. |
| `0` | Clear env filter (show all). |
| `↑` / `↓` | Move row selection. |
| `↵` | Open secret detail drawer. |
| `r` | Rotate selected secret (opens AlertDialog). |
| `⌫` / `Delete` | Delete selected secret (opens AlertDialog with type-to-confirm). |
| `a` | View audit for selected secret. |
| `t` | Run test for selected secret (connection check). |
| `e` | Edit metadata for selected secret. |

`/projects/[id]/audit`

| Shortcut | Action |
|---|---|
| `/` | Focus alias search. |
| `↑` / `↓` | Move event selection. |
| `↵` | Expand / collapse selected event. |
| `v` | Verify chain (focuses Re-verify). |
| `x` | Export filtered set (opens menu — `c` = CSV, `j` = JSON). |
| `1` / `2` / `3` / `4` | Toggle filter pills (project / member / secret / approval). |
| `⌘D` | Open date-range picker. |

`/projects/[id]/members`

| Shortcut | Action |
|---|---|
| `n` | Invite member. |
| `/` | Focus member search. |
| `↑` / `↓` | Move selection. |
| `r` | Edit role of selected member. |
| `⌫` | Remove selected member (AlertDialog). |

`/projects/[id]/approvals`

| Shortcut | Action |
|---|---|
| `↑` / `↓` | Move request selection. |
| `↵` | Expand request. |
| `y` | Approve selected. |
| `d` | Deny selected (opens denial-reason dialog). |

`/audit` (org-level) — same shortcuts as project audit.

`/settings/account`

| Shortcut | Action |
|---|---|
| `n` | New CLI token (when on cli-tokens sub-route). |
| `⌫` | Revoke selected token (AlertDialog). |

### C3. Modifier conventions

- `⌘` / `Ctrl` for system-level operations (open palette, save, new tab).
- `⇧` (Shift) only used with `⌘` for "alternate variant" of the base shortcut (`⌘Shift+P` = palette in actions mode).
- Single-letter shortcuts (`n`, `r`, `/`) are always page-contextual and never destructive without a follow-up confirmation modal.
- `g`-prefixed shortcuts are 2-key sequences: press `g`, see a small toast at bottom-right showing remaining options for ~1.2s, then press the second key. This mirrors Linear/Vim and is the only multi-key sequence in the app.
- All shortcuts are listed in the `?` overlay, scoped by current page; the global ones at top, page ones below.

### C4. Accessibility notes

- Every shortcut is also reachable by mouse / touch — shortcuts are accelerators, never the only path.
- Shortcut hints in tooltips and palette use `<Kbd>` rendering with tokenized borders, so they read identically to system keyboard hints.
- Global shortcuts respect `e.target` — disabled inside `input`, `textarea`, `[contenteditable]`. Exception: `⌘K`, `⎋`, `?` always work.
- `prefers-reduced-motion: reduce` collapses the `g`-prefix toast to instant (no fade), and disables row enter translation.

---
