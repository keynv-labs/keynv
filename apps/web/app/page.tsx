import { Logomark } from '@/components/brand/logomark';
import { InstallTabs } from '@/components/install-tabs';
import { GithubStars } from '@/components/trust/github-stars';
import { StatusPill } from '@/components/trust/status-pill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkipLink } from '@/components/ui/skip-link';
import { getCapabilities } from '@/lib/capabilities';
import { getSession } from '@/lib/session';
import { ArrowRight, Check, EyeOff, Github, Lock, Terminal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

const TITLE = 'keynv — secrets your AI agent can’t leak';
const DESCRIPTION =
  'Self-hosted vault for your team’s API keys, DB passwords, and SSH credentials. Reference them by alias — your AI coding agent sees the alias literal, never the value.';

export const metadata: Metadata = {
  metadataBase: new URL('https://keynv.dev'),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'keynv',
  keywords: [
    'secrets management',
    'AI agent security',
    'AI coding agents',
    'Claude Code',
    'Cursor',
    'self-hosted vault',
    'AI-safe secrets',
    'environment variables',
    'API key vault',
  ],
  openGraph: {
    type: 'website',
    url: 'https://keynv.dev',
    siteName: 'keynv',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: { canonical: 'https://keynv.dev' },
};

interface CtaContext {
  isAuthed: boolean;
  publicSignup: boolean;
}

export default async function LandingPage() {
  const [session, { publicSignup }] = await Promise.all([getSession(), getCapabilities()]);
  const ctx: CtaContext = { isAuthed: Boolean(session), publicSignup };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <SkipLink />
      <TopNav ctx={ctx} />
      <main id="main" className="flex-1">
        <Hero ctx={ctx} />
        <Problem />
        <HowItWorks />
        <Integrations />
        <InstallTabs />
        <Pricing ctx={ctx} />
        <BottomCta ctx={ctx} />
      </main>
      <Footer />
    </div>
  );
}

// ─── TOP NAV ─────────────────────────────────────────────────────────────────

function TopNav({ ctx }: { ctx: CtaContext }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 md:px-6 h-14 flex items-center gap-4">
        <Link href={{ pathname: '/' }} className="flex items-center">
          <Logomark size={22} />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-fg-muted ml-6">
          <a
            href="#how-it-works"
            className="hover:text-fg transition-colors duration-fast ease-snap"
          >
            How it works
          </a>
          <a
            href="#integrations"
            className="hover:text-fg transition-colors duration-fast ease-snap"
          >
            Integrations
          </a>
          <a href="#pricing" className="hover:text-fg transition-colors duration-fast ease-snap">
            Pricing
          </a>
          <Link
            href={{ pathname: '/docs' }}
            className="hover:text-fg transition-colors duration-fast ease-snap"
          >
            Docs
          </Link>
          <GithubStars />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {ctx.isAuthed ? (
            <Link href={{ pathname: '/dashboard' }}>
              <Button size="sm" className="gap-1.5">
                Open dashboard
                <ArrowRight size={13} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : ctx.publicSignup ? (
            <>
              <Link
                href={{ pathname: '/login' }}
                className="text-sm text-fg-muted hover:text-fg transition-colors duration-fast ease-snap px-2"
              >
                Sign in
              </Link>
              <Link href={{ pathname: '/register' }}>
                <Button size="sm" className="gap-1.5">
                  Get started
                  <ArrowRight size={13} strokeWidth={2.25} />
                </Button>
              </Link>
            </>
          ) : (
            <Link href={{ pathname: '/login' }}>
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── HERO ────────────────────────────────────────────────────────────────────

function Hero({ ctx }: { ctx: CtaContext }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-50" />
      <div aria-hidden className="absolute inset-0 bg-amber-glow pointer-events-none" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-30 animate-scan motion-reduce:hidden"
      />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-28 text-center">
        <div className="animate-hero-rise">
          <Badge tone="accent" className="mx-auto">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent animate-amber-pulse" />
            Phases 1–3 shipping · Phase 4 in progress
          </Badge>
        </div>

        <h1
          className="display mt-6 text-[44px] sm:text-[58px] md:text-[72px] lg:text-[84px] max-w-4xl mx-auto animate-hero-rise"
          style={{ animationDelay: '60ms' }}
        >
          Secrets your AI agent
          <br />
          <span className="bg-gradient-to-b from-fg-muted to-fg-subtle bg-clip-text text-transparent">
            can&rsquo;t leak.
          </span>
        </h1>

        <p
          className="mt-6 text-base md:text-lg text-fg-muted max-w-2xl mx-auto leading-relaxed animate-hero-rise"
          style={{ animationDelay: '120ms' }}
        >
          Self-hosted vault for your team&rsquo;s API keys, database passwords, and SSH credentials.
          Your AI coding agent sees the alias literal —{' '}
          <code className="text-accent">@billing.prod.db_password</code> — never the value.
        </p>

        <div
          className="mt-9 flex items-center justify-center gap-3 flex-wrap animate-hero-rise"
          style={{ animationDelay: '180ms' }}
        >
          {ctx.isAuthed ? (
            <Link href={{ pathname: '/dashboard' }}>
              <Button size="lg" className="gap-2">
                Open dashboard
                <ArrowRight size={14} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : ctx.publicSignup ? (
            <>
              <Link href={{ pathname: '/register' }}>
                <Button size="lg" className="gap-2">
                  Get started — free
                  <ArrowRight size={14} strokeWidth={2.25} />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline">
                  See how it works
                </Button>
              </a>
            </>
          ) : (
            <Link href={{ pathname: '/login' }}>
              <Button size="lg" className="gap-2">
                Sign in
                <ArrowRight size={14} strokeWidth={2.25} />
              </Button>
            </Link>
          )}
        </div>

        {!ctx.isAuthed && ctx.publicSignup ? (
          <p className="mt-5 text-xs text-fg-subtle font-mono uppercase tracking-[0.14em]">
            no credit card · self-host the same binary anytime
          </p>
        ) : null}

        <div className="animate-hero-rise" style={{ animationDelay: '260ms' }}>
          <AgentVsSubprocessFrame />
        </div>
      </div>
    </section>
  );
}

// ─── AGENT VS SUBPROCESS DEMO ────────────────────────────────────────────────
//
// The aha-moment of the product: same command, two realities. The left
// pane is what the AI agent sees in its tool transcript; the right pane
// is what actually runs in the subprocess that keynv-exec spawns. The
// agent's process tree literally cannot read the right pane.

function AgentVsSubprocessFrame() {
  return (
    <div className="mt-14 mx-auto max-w-5xl text-left">
      <div className="grid md:grid-cols-2 gap-px bg-border-strong rounded-xl border border-border-strong overflow-hidden shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)]">
        {/* ─── Agent's view ─────────────────────────────────────────── */}
        <div className="bg-bg-elevated">
          <TerminalChrome
            label="agent's view"
            sublabel="what your AI sees"
            indicator={{ tone: 'warn', icon: <EyeOff size={11} strokeWidth={2.25} /> }}
          />
          <pre className="px-5 py-5 font-mono text-[12px] sm:text-[13px] leading-[1.7] overflow-x-auto whitespace-pre">
            <Line dim>$ keynv exec --</Line>
            <Line>
              {'  '}
              <span className="text-fg">mysql</span> -p
              <span className="text-accent">@billing.prod.db_password</span>
            </Line>
            <Line dim># exit 0 · 142ms</Line>
            <Line> </Line>
            <Line dim>$ ps aux | grep mysql</Line>
            <Line>
              {'  '}
              <span className="text-fg-muted">mysql -p</span>
              <span className="text-warn">▒▒▒▒▒▒</span>
              <span className="text-fg-muted"> -h </span>
              <span className="text-warn">▒▒▒▒▒▒</span>
            </Line>
            <Line dim># argv redacted by output scanner</Line>
            <Line>
              <Cursor />
            </Line>
          </pre>
        </div>

        {/* ─── Subprocess (privileged) ──────────────────────────────── */}
        <div className="bg-bg-inset">
          <TerminalChrome
            label="subprocess"
            sublabel="privileged · agent-blind"
            indicator={{ tone: 'success', icon: <Lock size={11} strokeWidth={2.25} /> }}
          />
          <pre className="px-5 py-5 font-mono text-[12px] sm:text-[13px] leading-[1.7] overflow-x-auto whitespace-pre">
            <Line dim># resolved at fork-time, no env / no argv</Line>
            <Line>
              {'  '}
              <span className="text-fg">mysql</span> -p
              <span className="text-success">$secret_via_stdin</span>
            </Line>
            <Line>
              {'  '}
              <span className="text-fg-subtle">→ </span>
              <span className="text-fg-muted">connected to db.prod.acme.internal</span>
            </Line>
            <Line> </Line>
            <Line dim>$ select count(*) from payments;</Line>
            <Line>
              {'  '}
              <span className="text-fg">42,318</span>
            </Line>
            <Line dim># this output never reaches the agent's transcript</Line>
            <Line> </Line>
          </pre>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle flex-wrap">
        <span>verified</span>
        <span className="text-fg-subtle/60">·</span>
        <span className="text-accent">sha256:9f4c2e</span>
        <span className="text-fg-subtle/60">·</span>
        <span>chain head</span>
        <span className="text-fg-subtle/60">·</span>
        <span>3 actors · 7 reads in last hour</span>
      </div>
    </div>
  );
}

function TerminalChrome({
  label,
  sublabel,
  indicator,
}: {
  label: string;
  sublabel: string;
  indicator: { tone: 'success' | 'warn'; icon: React.ReactNode };
}) {
  const toneClass =
    indicator.tone === 'success' ? 'text-success bg-success-soft' : 'text-warn bg-warn-soft';
  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-bg-overlay border border-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-bg-overlay border border-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-bg-overlay border border-border-strong" />
      </div>
      <span className="ml-2 font-mono text-[11px] text-fg-subtle uppercase tracking-[0.14em]">
        {label}
      </span>
      <span className="font-mono text-[11px] text-fg-subtle/60">·</span>
      <span className="font-mono text-[10px] text-fg-subtle">{sublabel}</span>
      <span
        className={`ml-auto inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${toneClass}`}
      >
        {indicator.icon}
      </span>
    </div>
  );
}

function Line({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return <div className={dim ? 'text-fg-subtle' : ''}>{children}</div>;
}

function Cursor() {
  return (
    <span
      aria-hidden
      className="inline-block h-[1em] w-[0.5em] align-middle bg-accent animate-pulse motion-reduce:opacity-50"
    />
  );
}

// ─── PROBLEM ─────────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-20 md:py-24">
        <div className="display-eyebrow">01 · why it exists</div>
        <h2 className="display mt-3 text-3xl md:text-[42px] leading-[1.05]">
          AI coding agents made the secret-leak problem{' '}
          <span className="text-fg-muted">an order of magnitude worse.</span>
        </h2>
        <p className="mt-6 text-base text-fg-muted leading-relaxed max-w-3xl">
          Developers leak credentials constantly — <code className="text-fg">.env</code> files
          committed to repos, keys left in shell history, tokens in tool outputs. AI agents
          permanently residing in your terminal made it worse: every command, every file, every diff
          is shipped to a vendor&rsquo;s logs. Existing vaults (HashiCorp, Doppler, 1Password) are
          mature but none were designed around AI agents being there.
        </p>

        <ul className="mt-10 grid gap-3 sm:grid-cols-3 text-sm">
          <Stat value="23.7M" label="hardcoded secrets pushed to GitHub in 2024 (+25% YoY)" />
          <Stat value="every diff" label="visible to your AI agent's vendor — and their logs" />
          <Stat value="alias-only" label="resolution happens in a process the agent cannot read" />
        </ul>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className="rounded-lg border border-border bg-bg-elevated p-4 hover:border-border-strong transition-colors duration-fast ease-snap">
      <div className="text-fg font-mono text-[15px] font-medium tabular tracking-tight">
        {value}
      </div>
      <div className="text-xs text-fg-muted mt-1.5 leading-relaxed">{label}</div>
    </li>
  );
}

// ─── HOW IT WORKS ────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-20 md:py-24">
        <div className="display-eyebrow text-center">02 · how it works</div>
        <h2 className="display mt-3 text-3xl md:text-[42px] leading-[1.05] text-center max-w-3xl mx-auto">
          Aliases in code.{' '}
          <span className="text-fg-muted">Resolution in a process the agent can&rsquo;t see.</span>
        </h2>

        <ol className="mt-12 grid gap-4 md:grid-cols-3 relative">
          <div
            aria-hidden
            className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-border-strong to-transparent"
          />
          <Step
            number="01"
            title="Store"
            body={
              <>
                Add a secret with the CLI or web UI. Encrypted at rest with a per-project DEK; the
                master KEK lives in your OS keychain.
              </>
            }
          />
          <Step
            number="02"
            title="Reference"
            body={
              <>
                In code, configs, and bash you type{' '}
                <code className="text-accent">@project.env.key</code>. The literal alias is the only
                string the agent ever sees.
              </>
            }
          />
          <Step
            number="03"
            title="Resolve safely"
            body={
              <>
                <code className="text-accent">keynv exec</code> spawns a subprocess with the real
                value injected via stdin. Tool outputs are scanned for leaks before they return.
              </>
            }
          />
        </ol>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="relative rounded-lg border border-border bg-bg-elevated p-6 hover:border-border-strong transition-colors duration-fast ease-snap">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-accent-soft-border bg-accent-soft font-mono text-[12px] font-semibold text-accent tabular"
        >
          {number}
        </span>
        <h3 className="text-[17px] font-semibold tracking-tight text-fg">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-fg-muted leading-relaxed">{body}</p>
    </li>
  );
}

// ─── INTEGRATIONS ────────────────────────────────────────────────────────────

function Integrations() {
  return (
    <section id="integrations" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-24">
        <div className="display-eyebrow text-center">03 · agent integrations</div>
        <h2 className="display mt-3 text-3xl md:text-[42px] leading-[1.05] text-center max-w-3xl mx-auto">
          Drop into the agent you already use.{' '}
          <span className="text-fg-muted">No prompt-engineering required.</span>
        </h2>
        <p className="mt-6 text-base text-fg-muted text-center max-w-2xl mx-auto leading-relaxed">
          The CLI ships installers for popular AI coding agents — they configure the MCP server,
          register the safety hooks, and rewrite your shell so secrets are resolved out-of-band.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <IntegrationCard
            name="Claude Code"
            command="keynv install claude-code"
            file="~/.claude/settings.local.json"
            snippet={
              <>
                <Line>
                  <span className="text-fg-subtle">{'{'}</span>
                </Line>
                <Line>
                  {'  '}
                  <span className="text-fg-muted">"mcpServers"</span>:{' '}
                  <span className="text-fg-subtle">{'{'}</span>
                </Line>
                <Line>
                  {'    '}
                  <span className="text-accent">"keynv"</span>:{' '}
                  <span className="text-fg-subtle">{'{'}</span>
                </Line>
                <Line>
                  {'      '}
                  <span className="text-fg-muted">"command"</span>:{' '}
                  <span className="text-success">"keynv-mcp"</span>
                </Line>
                <Line>
                  {'    '}
                  <span className="text-fg-subtle">{'}, ...'}</span>
                </Line>
                <Line>
                  {'  '}
                  <span className="text-fg-subtle">{'}'}</span>
                </Line>
                <Line>
                  <span className="text-fg-subtle">{'}'}</span>
                </Line>
              </>
            }
            features={[
              'MCP server with use_secret refs',
              'Read denylist on .env / *.pem',
              'Output redactor on every tool result',
            ]}
          />
          <IntegrationCard
            name="Cursor"
            command="keynv install cursor"
            file="~/.cursor/mcp.json"
            snippet={
              <>
                <Line>
                  <span className="text-fg-subtle">{'{'}</span>
                </Line>
                <Line>
                  {'  '}
                  <span className="text-fg-muted">"mcpServers"</span>:{' '}
                  <span className="text-fg-subtle">{'{'}</span>
                </Line>
                <Line>
                  {'    '}
                  <span className="text-accent">"keynv"</span>:{' '}
                  <span className="text-fg-subtle">{'{'}</span>
                </Line>
                <Line>
                  {'      '}
                  <span className="text-fg-muted">"command"</span>:{' '}
                  <span className="text-success">"keynv-mcp"</span>,
                </Line>
                <Line>
                  {'      '}
                  <span className="text-fg-muted">"args"</span>:{' '}
                  <span className="text-fg-subtle">[</span>
                  <span className="text-success">"--mode=cursor"</span>
                  <span className="text-fg-subtle">{']'}</span>
                </Line>
                <Line>
                  {'    '}
                  <span className="text-fg-subtle">{'}'}</span>
                </Line>
                <Line>
                  {'  '}
                  <span className="text-fg-subtle">{'}'}</span>
                </Line>
                <Line>
                  <span className="text-fg-subtle">{'}'}</span>
                </Line>
              </>
            }
            features={[
              'Same MCP server as Claude Code',
              'Composer auto-resolves @aliases',
              'Per-rule access scoping',
            ]}
          />
          <IntegrationCard
            name="Any shell"
            command="keynv exec -- pnpm dev"
            file="any process · zero config"
            snippet={
              <>
                <Line dim># in your bash / zsh / fish</Line>
                <Line>
                  <span className="text-fg-subtle">$</span>{' '}
                  <span className="text-fg">keynv exec</span> --
                </Line>
                <Line>
                  {'    '}
                  <span className="text-fg">pg_dump</span> -d{' '}
                  <span className="text-accent">@reports.prod.dsn</span>
                </Line>
                <Line> </Line>
                <Line dim># subprocess gets the value via stdin;</Line>
                <Line dim># your shell history sees only the alias</Line>
              </>
            }
            features={[
              'Works with anything that takes argv/env/stdin',
              'CI runners, Docker, Coolify',
              'No vendor lock-in',
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function IntegrationCard({
  name,
  command,
  file,
  snippet,
  features,
}: {
  name: string;
  command: string;
  file: string;
  snippet: React.ReactNode;
  features: string[];
}) {
  return (
    <article className="rounded-xl border border-border bg-bg-elevated overflow-hidden flex flex-col hover:border-border-strong transition-colors duration-fast ease-snap">
      <header className="px-5 py-4 border-b border-border bg-bg-inset/40">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight text-fg">{name}</h3>
          <Terminal size={13} strokeWidth={2} className="text-accent shrink-0" />
        </div>
        <code className="block mt-2 font-mono text-[11px] text-fg-muted tabular truncate">
          {file}
        </code>
      </header>

      <pre className="flex-1 px-4 py-4 font-mono text-[11px] sm:text-[12px] leading-[1.7] bg-bg-inset overflow-x-auto whitespace-pre">
        {snippet}
      </pre>

      <div className="px-5 py-4 border-t border-border space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">
          install
        </div>
        <code className="block font-mono text-[12px] text-accent tabular truncate">{command}</code>
        <ul className="mt-3 space-y-1.5 text-xs text-fg-muted">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <Check size={11} strokeWidth={2.5} className="shrink-0 mt-0.5 text-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

// ─── PRICING ─────────────────────────────────────────────────────────────────

function Pricing({ ctx }: { ctx: CtaContext }) {
  return (
    <section id="pricing" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-24">
        <div className="display-eyebrow text-center">05 · pricing</div>
        <h2 className="display mt-3 text-3xl md:text-[42px] leading-[1.05] text-center max-w-3xl mx-auto">
          Free to self-host, forever.{' '}
          <span className="text-fg-muted">Managed tier ships with Phase 5.</span>
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <PriceCard
            tier="Self-hosted"
            price="Free"
            priceSub="MIT-when-Phase-5"
            description="The whole platform, on your infra. Single binary + SQLite + Litestream."
            features={[
              'Unlimited projects, secrets, members',
              'Full audit chain + tamper verification',
              'OS keychain KEK, libsodium envelope encryption',
              'All AI-agent integrations',
              'Community support on GitHub',
            ]}
            cta={
              ctx.isAuthed ? (
                <Link href={{ pathname: '/dashboard' }}>
                  <Button size="md" variant="outline" className="w-full gap-1.5">
                    Open dashboard
                    <ArrowRight size={13} strokeWidth={2.25} />
                  </Button>
                </Link>
              ) : (
                <a
                  href="https://github.com/keynv-labs/keynv/blob/main/deploy/COOLIFY.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="md" variant="outline" className="w-full gap-1.5">
                    Deploy guide
                    <ArrowRight size={13} strokeWidth={2.25} />
                  </Button>
                </a>
              )
            }
          />
          <PriceCard
            tier="Managed"
            price="TBD"
            priceSub="Phase 5 · waitlist"
            highlight
            description="We run it for your team. Same binary, hosted region of your choice, 99.9% SLA."
            features={[
              'Everything in Self-hosted',
              'Hosted on your region (EU / US)',
              'Daily encrypted backups',
              'Email support, 1-business-day reply',
              'Migration tool from Doppler / 1Password',
            ]}
            cta={
              <a href="mailto:hello@keynv.dev?subject=Managed%20waitlist">
                <Button size="md" className="w-full gap-1.5">
                  Join waitlist
                  <ArrowRight size={13} strokeWidth={2.25} />
                </Button>
              </a>
            }
          />
          <PriceCard
            tier="Enterprise"
            price="Custom"
            priceSub="Phase 6"
            description="HSM/KMS-backed KEK, SSO, on-prem audit export, named architect."
            features={[
              'AWS KMS / GCP KMS / Vault Transit KEK',
              'SSO (SAML, OIDC) + SCIM provisioning',
              'SOC 2 Type II report',
              'Postgres adapter, multi-region replication',
              'Dedicated solution architect',
            ]}
            cta={
              <a href="mailto:hello@keynv.dev?subject=Enterprise">
                <Button size="md" variant="outline" className="w-full gap-1.5">
                  Talk to us
                  <ArrowRight size={13} strokeWidth={2.25} />
                </Button>
              </a>
            }
          />
        </div>

        <p className="mt-8 text-center text-xs text-fg-subtle font-mono uppercase tracking-[0.14em]">
          self-host stays free regardless of which tier you pick
        </p>
      </div>
    </section>
  );
}

function PriceCard({
  tier,
  price,
  priceSub,
  description,
  features,
  cta,
  highlight = false,
}: {
  tier: string;
  price: string;
  priceSub: string;
  description: string;
  features: string[];
  cta: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <article
      className={`relative rounded-xl border p-6 flex flex-col ${
        highlight
          ? 'border-accent-soft-border bg-bg-elevated shadow-[0_24px_64px_-24px_rgba(255,183,77,0.18)]'
          : 'border-border bg-bg-elevated'
      }`}
    >
      {highlight ? (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-sm border border-accent-soft-border bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
          <span className="h-1 w-1 rounded-full bg-accent" />
          coming soon
        </span>
      ) : null}

      <header>
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          {tier}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="display text-[32px] tracking-tight text-fg">{price}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            {priceSub}
          </span>
        </div>
        <p className="mt-3 text-sm text-fg-muted leading-relaxed">{description}</p>
      </header>

      <ul className="mt-6 space-y-2.5 text-sm text-fg-muted flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              size={13}
              strokeWidth={2.25}
              className={`shrink-0 mt-0.5 ${highlight ? 'text-accent' : 'text-success'}`}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">{cta}</div>
    </article>
  );
}

// ─── BOTTOM CTA ──────────────────────────────────────────────────────────────

function BottomCta({ ctx }: { ctx: CtaContext }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="absolute inset-0 bg-amber-glow pointer-events-none opacity-70" />
      <div className="relative mx-auto max-w-3xl px-4 md:px-6 py-20 md:py-24 text-center">
        <h2 className="display text-3xl md:text-[42px] leading-[1.05]">Ready to stop leaking?</h2>
        <p className="mt-4 text-base text-fg-muted max-w-xl mx-auto">
          15-minute self-host on Coolify. Single binary CLI. Source-available, MIT-when-Phase-5
          ships.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
          {ctx.isAuthed ? (
            <Link href={{ pathname: '/dashboard' }}>
              <Button size="lg" className="gap-2">
                Open dashboard
                <ArrowRight size={14} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : ctx.publicSignup ? (
            <Link href={{ pathname: '/register' }}>
              <Button size="lg" className="gap-2">
                Create your account
                <ArrowRight size={14} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : (
            <Link href={{ pathname: '/login' }}>
              <Button size="lg" className="gap-2">
                Sign in
                <ArrowRight size={14} strokeWidth={2.25} />
              </Button>
            </Link>
          )}
          <a
            href="https://github.com/keynv-labs/keynv/blob/main/deploy/COOLIFY.md"
            target="_blank"
            rel="noreferrer"
          >
            <Button size="lg" variant="outline">
              Deploy guide
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] text-xs text-fg-muted">
          <div>
            <Logomark size={26} wordmarkClassName="text-base" />
            <p className="mt-4 leading-relaxed max-w-sm">
              Self-hosted, source-available secrets manager built for the AI-coding era. Phase 4 in
              progress; treat as not-yet-OSI-licensed until Phase 5 ships.
            </p>
            <div className="mt-5">
              <StatusPill />
            </div>
          </div>

          <FooterColumn title="Product">
            <FooterLink href="/docs">Docs</FooterLink>
            <FooterLink href="/changelog">Changelog</FooterLink>
            <FooterLink href="#integrations">Integrations</FooterLink>
            <FooterLink href="#pricing">Pricing</FooterLink>
          </FooterColumn>

          <FooterColumn title="Security">
            <FooterLink href="/docs/threat-model">Threat model</FooterLink>
            <FooterLink href="/docs/encryption-design">Encryption design</FooterLink>
            <FooterLink external href="https://github.com/keynv-labs/keynv/blob/main/SECURITY.md">
              Responsible disclosure
            </FooterLink>
          </FooterColumn>

          <FooterColumn title="Community">
            <FooterLink external href="https://github.com/keynv-labs/keynv">
              <Github size={11} strokeWidth={2} className="inline-block mr-1 -mt-px" />
              GitHub
            </FooterLink>
            <FooterLink external href="https://github.com/keynv-labs/keynv/issues">
              Issues
            </FooterLink>
            <FooterLink external href="https://github.com/keynv-labs/keynv/discussions">
              Discussions
            </FooterLink>
            <FooterLink href="/changelog/rss.xml">RSS</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] text-fg-subtle">
          <span className="font-mono uppercase tracking-[0.14em]">
            public beta · soc2 readiness h2/2026 ·{' '}
            <Link
              href={{ pathname: '/docs/threat-model' }}
              className="text-fg-muted hover:text-fg normal-case"
            >
              what we defend against today
            </Link>
          </span>
          <span className="font-mono tabular">© {new Date().getFullYear()} keynv labs</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-fg-subtle">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external || href.startsWith('#')) {
    return (
      <li>
        <a
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          className="hover:text-fg transition-colors duration-fast ease-snap"
        >
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={{ pathname: href } as never}
        className="hover:text-fg transition-colors duration-fast ease-snap"
      >
        {children}
      </Link>
    </li>
  );
}
