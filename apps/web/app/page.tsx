import { Logomark } from '@/components/brand/logomark';
import { InstallTabs } from '@/components/install-tabs';
import { GithubStars } from '@/components/trust/github-stars';
import { StatusPill } from '@/components/trust/status-pill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkipLink } from '@/components/ui/skip-link';
import { getCapabilities } from '@/lib/capabilities';
import { getSession } from '@/lib/session';
import {
  ArrowRight,
  CheckCircle2,
  FileLock,
  Github,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
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
        <Pillars />
        <HowItWorks />
        <InstallTabs />
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
          <Link
            href={{ pathname: '/docs' }}
            className="hover:text-fg transition-colors duration-fast ease-snap"
          >
            Docs
          </Link>
          <Link
            href={{ pathname: '/changelog' }}
            className="hover:text-fg transition-colors duration-fast ease-snap"
          >
            Changelog
          </Link>
          <GithubStars />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {ctx.isAuthed ? (
            <Link href={{ pathname: '/projects' }}>
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

      {/* phosphor scan line — runs slowly down the hero, ambient terminal feel */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-30 animate-scan motion-reduce:hidden"
      />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-24 md:py-32 text-center">
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
          Reference them everywhere by alias — your AI coding agent sees the alias literal, never
          the value.
        </p>

        <div
          className="mt-9 flex items-center justify-center gap-3 flex-wrap animate-hero-rise"
          style={{ animationDelay: '180ms' }}
        >
          {ctx.isAuthed ? (
            <Link href={{ pathname: '/projects' }}>
              <Button size="lg" className="gap-2">
                Open dashboard
                <ArrowRight size={14} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : ctx.publicSignup ? (
            <>
              <Link href={{ pathname: '/register' }}>
                <Button size="lg" className="gap-2">
                  Get started — it&rsquo;s free
                  <ArrowRight size={14} strokeWidth={2.25} />
                </Button>
              </Link>
              <Link href={{ pathname: '/login' }}>
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </Link>
            </>
          ) : (
            <Link href={{ pathname: '/login' }}>
              <Button size="lg" className="gap-2">
                Sign in
                <ArrowRight size={14} strokeWidth={2.25} />
              </Button>
            </Link>
          )}
          <a href="https://github.com/keynv-labs/keynv" target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline" className="gap-2">
              <Github size={14} strokeWidth={2} />
              View on GitHub
            </Button>
          </a>
        </div>

        {!ctx.isAuthed && ctx.publicSignup ? (
          <p className="mt-5 text-xs text-fg-subtle font-mono uppercase tracking-[0.14em]">
            no credit card · self-host the same binary anytime
          </p>
        ) : null}

        <div className="animate-hero-rise" style={{ animationDelay: '260ms' }}>
          <CodeFrame />
        </div>
      </div>
    </section>
  );
}

function CodeFrame() {
  return (
    <div className="mt-14 mx-auto max-w-2xl text-left">
      <div className="rounded-xl border border-border-strong bg-bg-elevated overflow-hidden shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 bg-bg-inset/60">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bg-overlay border border-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-overlay border border-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-overlay border border-border-strong" />
          </div>
          <span className="ml-2 font-mono text-[11px] text-fg-subtle">~/billing-app</span>
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            redaction on
          </span>
        </div>
        <pre className="px-5 py-5 font-mono text-[12px] sm:text-[13px] leading-[1.7] overflow-x-auto whitespace-pre">
          <span className="text-fg-subtle">$</span> <span className="text-fg">keynv</span>
          {' exec -- '}
          {'\n'}
          <span className="text-fg-subtle"> </span>
          <span className="text-fg">mysql</span> -p
          <span className="text-accent">@billing.prod.db_password</span>
          {'\n'}
          <span className="text-fg-subtle"> # </span>
          <span className="text-fg-muted">what your AI agent sees in its tool input + output</span>
          {'\n\n'}
          <span className="text-fg-subtle">$</span> ps aux | grep mysql
          {'\n'}
          <span className="text-fg-muted"> mysql -p</span>
          <span className="text-success">▒▒▒▒▒▒</span>
          <span className="text-fg-muted"> -h </span>
          <span className="text-success">▒▒▒▒▒▒</span>
          {'\n'}
          <span className="text-fg-subtle"> # </span>
          <span className="text-fg-muted">argv redacted; subprocess holds the real values</span>
        </pre>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
        <span>verified</span>
        <span className="text-fg-subtle/60">·</span>
        <span className="text-accent">sha256:9f4c2e</span>
        <span className="text-fg-subtle/60">·</span>
        <span>chain head</span>
      </div>
    </div>
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

// ─── PILLARS ─────────────────────────────────────────────────────────────────

function Pillars() {
  return (
    <section id="pillars" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-24">
        <div className="display-eyebrow text-center">02 · what it does</div>
        <h2 className="display mt-3 text-3xl md:text-[42px] leading-[1.05] text-center max-w-3xl mx-auto">
          Two products in one — a team vault and an{' '}
          <span className="text-fg-muted">AI-safety layer.</span>
        </h2>

        <div className="mt-12 grid gap-px md:grid-cols-3 bg-border rounded-xl overflow-hidden border border-border">
          <Pillar
            icon={<KeyRound size={16} strokeWidth={2} />}
            title="Self-hosted vault"
            tone="accent"
            bullets={[
              'SQLite + Litestream — single file, real-time S3 backup',
              'Envelope encryption (libsodium): KEK in OS keychain, per-project DEK',
              'RBAC: Owner / Admin / Developer / Reader',
              'Append-only hash-chained audit log',
            ]}
          />
          <Pillar
            icon={<ShieldCheck size={16} strokeWidth={2} />}
            title="AI-safety layer"
            tone="warn"
            bullets={[
              <span key="alias">
                <code className="text-fg">@project.env.key</code> aliases everywhere
              </span>,
              <span key="exec">
                <code className="text-fg">keynv exec</code> spawns a privileged subprocess your
                agent can&rsquo;t see
              </span>,
              'MCP server returns single-use refs, never values',
              'Output redactor (regex + entropy) on every tool result',
            ]}
          />
          <Pillar
            icon={<ScrollText size={16} strokeWidth={2} />}
            title="Tamper-evident audit"
            tone="success"
            bullets={[
              'Every read, write, rotation, role change appended to the chain',
              'SHA-256 prev-hash links every entry to the previous one',
              'Re-verify integrity any time — green or "broken at id X"',
              'Filter by actor, event type, alias, time range',
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function Pillar({
  icon,
  title,
  tone,
  bullets,
}: {
  icon: React.ReactNode;
  title: string;
  tone: 'accent' | 'warn' | 'success';
  bullets: React.ReactNode[];
}) {
  const ringClass =
    tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-warn' : 'text-success';
  const bgClass =
    tone === 'accent'
      ? 'bg-accent-soft border-accent-soft-border'
      : tone === 'warn'
        ? 'bg-warn-soft border-warn-soft-border'
        : 'bg-success-soft border-success-soft-border';
  return (
    <article className="bg-bg-elevated p-6 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap">
      <div
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${bgClass} ${ringClass}`}
      >
        {icon}
      </div>
      <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-fg">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm text-fg-muted">
        {bullets.map((b, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: static layout, order never changes
            key={i}
            className="flex items-start gap-2"
          >
            <CheckCircle2
              size={13}
              strokeWidth={2}
              className={`shrink-0 mt-0.5 ${ringClass}`}
              aria-hidden
            />
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

// ─── HOW IT WORKS ────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-20 md:py-24">
        <div className="display-eyebrow text-center">03 · how it works</div>
        <h2 className="display mt-3 text-3xl md:text-[42px] leading-[1.05] text-center max-w-3xl mx-auto">
          Aliases in code.{' '}
          <span className="text-fg-muted">Resolution in a process the agent can&rsquo;t see.</span>
        </h2>

        <ol className="mt-12 grid gap-4 md:grid-cols-3 relative">
          {/* connecting line on desktop */}
          <div
            aria-hidden
            className="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-border-strong to-transparent"
          />
          <Step
            number="01"
            icon={<FileLock size={14} strokeWidth={2} />}
            title="Store"
            body={
              <>
                Your team adds secrets to the keynv server with the CLI or web UI. Values are
                encrypted at rest with a per-project DEK; the master KEK lives in the OS keychain or
                HSM.
              </>
            }
          />
          <Step
            number="02"
            icon={<Terminal size={14} strokeWidth={2} />}
            title="Reference"
            body={
              <>
                In code, configs, and bash commands you type{' '}
                <code className="text-fg">@billing.prod.db_password</code>. That&rsquo;s the only
                string the AI agent ever sees.
              </>
            }
          />
          <Step
            number="03"
            icon={<ShieldCheck size={14} strokeWidth={2} />}
            title="Resolve safely"
            body={
              <>
                <code className="text-fg">keynv exec</code> spawns a subprocess with the real value
                injected via stdin or a temp file. The agent&rsquo;s process tree, env vars, and
                tool output are scrubbed.
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
  icon,
  title,
  body,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="relative rounded-lg border border-border bg-bg-elevated p-6 hover:border-border-strong transition-colors duration-fast ease-snap">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-accent-soft-border bg-accent-soft text-accent"
        >
          {icon}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle tabular">
          step {number}
        </span>
      </div>
      <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-fg">{title}</h3>
      <p className="mt-2 text-sm text-fg-muted leading-relaxed">{body}</p>
    </li>
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
            <Link href={{ pathname: '/projects' }}>
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
            <FooterLink href="/docs/quickstart">Quickstart</FooterLink>
            <FooterLink href="/docs/roadmap">Roadmap</FooterLink>
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
  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
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
