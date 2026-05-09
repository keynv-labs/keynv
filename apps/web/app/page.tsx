import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export const metadata: Metadata = {
  title: 'keynv — secrets your AI agent can’t leak',
  description:
    'Self-hosted vault for your team’s API keys, DB passwords, and SSH credentials. Reference them by alias — your AI coding agent sees the alias literal, never the value.',
};

export default async function LandingPage() {
  const session = await getSession();
  const isAuthed = Boolean(session);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <TopNav isAuthed={isAuthed} />
      <main className="flex-1">
        <Hero isAuthed={isAuthed} />
        <Problem />
        <Pillars />
        <HowItWorks />
        <BottomCta isAuthed={isAuthed} />
      </main>
      <Footer />
    </div>
  );
}

// ─── TOP NAV ─────────────────────────────────────────────────────────────────

function TopNav({ isAuthed }: { isAuthed: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 md:px-6 h-14 flex items-center gap-4">
        <Link
          href={{ pathname: '/' }}
          className="flex items-center gap-2 font-semibold tracking-tight text-fg"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-fg-on-accent text-[11px] font-bold">
            k
          </span>
          <span>keynv</span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm text-fg-muted ml-4">
          <a
            href="#how-it-works"
            className="hover:text-fg transition-colors duration-fast ease-snap"
          >
            How it works
          </a>
          <a href="#pillars" className="hover:text-fg transition-colors duration-fast ease-snap">
            Features
          </a>
          <a
            href="https://github.com/keynv-labs/keynv"
            target="_blank"
            rel="noreferrer"
            className="hover:text-fg transition-colors duration-fast ease-snap inline-flex items-center gap-1.5"
          >
            <Github size={13} strokeWidth={2} />
            GitHub
          </a>
        </nav>

        <div className="ml-auto">
          {isAuthed ? (
            <Link href={{ pathname: '/projects' }}>
              <Button className="gap-1.5">
                Open dashboard
                <ArrowRight size={13} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : (
            <Link href={{ pathname: '/login' }}>
              <Button>Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── HERO ────────────────────────────────────────────────────────────────────

function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <GridBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-28 text-center">
        <Badge tone="neutral" className="mx-auto">
          Phases 1–3 shipping · Phase 4 in progress
        </Badge>

        <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
          Secrets your AI agent <span className="text-fg-muted">can&rsquo;t leak.</span>
        </h1>

        <p className="mt-5 text-base md:text-lg text-fg-muted max-w-2xl mx-auto leading-relaxed">
          Self-hosted vault for your team&rsquo;s API keys, database passwords, and SSH credentials.
          Reference them everywhere by alias — your AI coding agent sees the alias literal, never
          the value.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          {isAuthed ? (
            <Link href={{ pathname: '/projects' }}>
              <Button className="gap-1.5">
                Open dashboard
                <ArrowRight size={13} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : (
            <Link href={{ pathname: '/login' }}>
              <Button className="gap-1.5">
                Sign in
                <ArrowRight size={13} strokeWidth={2.25} />
              </Button>
            </Link>
          )}
          <a href="https://github.com/keynv-labs/keynv" target="_blank" rel="noreferrer">
            <Button variant="secondary" className="gap-1.5">
              <Github size={13} strokeWidth={2} />
              View on GitHub
            </Button>
          </a>
        </div>

        <CodeFrame />
      </div>
    </section>
  );
}

function GridBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,0,0,0.6), transparent 70%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,0,0,0.6), transparent 70%)',
        opacity: 0.5,
      }}
    />
  );
}

function CodeFrame() {
  return (
    <div className="mt-12 mx-auto max-w-2xl rounded-xl border border-border bg-bg-elevated text-left shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-bg-elevated-hover" />
        <span className="h-2.5 w-2.5 rounded-full bg-bg-elevated-hover" />
        <span className="h-2.5 w-2.5 rounded-full bg-bg-elevated-hover" />
        <span className="ml-2 text-[11px] font-mono text-fg-subtle">~/billing-app</span>
      </div>
      <pre className="px-4 py-4 font-mono text-[12px] sm:text-[13px] leading-relaxed overflow-x-auto whitespace-pre">
        <span className="text-fg-subtle">$</span> <span className="text-fg">keynv</span> exec --
        {'\n'}
        <span className="text-fg-subtle"> </span>
        <span className="text-fg">mysql</span> -p
        <span className="text-accent">@billing.prod.db_password</span>
        {'\n'}
        <span className="text-fg-subtle"> \\</span>{' '}
        <span className="text-fg-muted">
          comment: what your AI agent sees in tool input + output
        </span>
        {'\n\n'}
        <span className="text-fg-subtle">$</span> ps aux | grep mysql{'\n'}
        <span className="text-fg-muted"> mysql -p</span>
        <span className="text-success">******</span>
        <span className="text-fg-muted"> -h</span>
        <span className="text-success">******</span>
        {'\n'}
        <span className="text-fg-subtle"> \\</span>{' '}
        <span className="text-fg-muted">
          comment: argv redacted; subprocess holds the real values
        </span>
      </pre>
    </div>
  );
}

// ─── PROBLEM ─────────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-16 md:py-20">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          Why it exists
        </div>
        <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
          AI coding agents made the secret-leak problem{' '}
          <span className="text-fg-muted">an order of magnitude worse.</span>
        </h2>
        <p className="mt-5 text-base text-fg-muted leading-relaxed">
          Developers leak credentials constantly — <code className="font-mono text-fg">.env</code>{' '}
          files committed to repos, keys left in shell history, tokens in tool outputs. AI agents
          permanently residing in your terminal made it worse: every command, every file, every diff
          is shipped to a vendor&rsquo;s logs. Existing vaults (HashiCorp, Doppler, 1Password) are
          mature but none were designed around AI agents being there.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3 text-sm">
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
    <li className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="text-fg font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-fg-muted mt-1 leading-relaxed">{label}</div>
    </li>
  );
}

// ─── PILLARS ─────────────────────────────────────────────────────────────────

function Pillars() {
  return (
    <section id="pillars" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-20">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle text-center">
          What it does
        </div>
        <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-center max-w-2xl mx-auto">
          Two products in one — a team vault and an AI-safety layer.
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Pillar
            icon={<KeyRound size={16} strokeWidth={2} />}
            title="Self-hosted vault"
            tone="success"
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
                <code className="font-mono text-fg">@project.env.key</code> aliases everywhere
              </span>,
              <span key="exec">
                <code className="font-mono text-fg">keynv exec</code> spawns a privileged subprocess
                your agent can&rsquo;t see
              </span>,
              'MCP server returns single-use refs, never values',
              'Output redactor (regex + entropy) on every tool result',
            ]}
          />
          <Pillar
            icon={<ScrollText size={16} strokeWidth={2} />}
            title="Tamper-evident audit"
            tone="neutral"
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
  tone: 'success' | 'warn' | 'neutral';
  bullets: React.ReactNode[];
}) {
  const ringClass =
    tone === 'success' ? 'text-success' : tone === 'warn' ? 'text-warn' : 'text-fg-muted';
  return (
    <article className="rounded-lg border border-border bg-bg-elevated p-5">
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md bg-bg ${ringClass}`}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-fg">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-fg-muted">
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
            <span>{b}</span>
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
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-16 md:py-20">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle text-center">
          How it works
        </div>
        <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-center max-w-2xl mx-auto">
          Aliases in code. Resolution in a process the agent can&rsquo;t see.
        </h2>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          <Step
            number="1"
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
            number="2"
            icon={<Terminal size={14} strokeWidth={2} />}
            title="Reference"
            body={
              <>
                In code, configs, and bash commands you type{' '}
                <code className="font-mono text-fg">@billing.prod.db_password</code>. That&rsquo;s
                the only string the AI agent ever sees.
              </>
            }
          />
          <Step
            number="3"
            icon={<ShieldCheck size={14} strokeWidth={2} />}
            title="Resolve safely"
            body={
              <>
                <code className="font-mono text-fg">keynv exec</code> spawns a subprocess with the
                real value injected via stdin or a temp file. The agent&rsquo;s process tree, env
                vars, and tool output are scrubbed.
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
    <li className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-strong bg-bg text-fg-muted"
        >
          {icon}
        </span>
        <span className="font-mono text-[11px] text-fg-subtle">step {number}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-fg">{title}</h3>
      <p className="mt-2 text-sm text-fg-muted leading-relaxed">{body}</p>
    </li>
  );
}

// ─── BOTTOM CTA ──────────────────────────────────────────────────────────────

function BottomCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-16 md:py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
          Ready to stop leaking?
        </h2>
        <p className="mt-3 text-base text-fg-muted">
          15-minute self-host on Coolify. Single binary CLI. Source-available, MIT-when-Phase-5
          ships.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
          {isAuthed ? (
            <Link href={{ pathname: '/projects' }}>
              <Button className="gap-1.5">
                Open dashboard
                <ArrowRight size={13} strokeWidth={2.25} />
              </Button>
            </Link>
          ) : (
            <Link href={{ pathname: '/login' }}>
              <Button className="gap-1.5">
                Sign in
                <ArrowRight size={13} strokeWidth={2.25} />
              </Button>
            </Link>
          )}
          <a
            href="https://github.com/keynv-labs/keynv/blob/main/deploy/COOLIFY.md"
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="secondary">Deploy guide</Button>
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
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 text-xs text-fg-muted">
        <div className="flex items-center gap-2 text-fg">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-accent text-fg-on-accent text-[10px] font-bold">
            k
          </span>
          <span className="font-semibold tracking-tight">keynv</span>
        </div>
        <p className="leading-relaxed max-w-md">
          Self-hosted, source-available secrets manager built for the AI-coding era. Phase 4 in
          progress; treat as not-yet-OSI-licensed until Phase 5 ships.
        </p>
        <div className="ml-auto flex items-center gap-5">
          <a
            href="https://github.com/keynv-labs/keynv"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-fg transition-colors duration-fast ease-snap"
          >
            <Github size={12} strokeWidth={2} />
            keynv-labs/keynv
          </a>
          <a
            href="https://github.com/keynv-labs/keynv/tree/main/docs"
            target="_blank"
            rel="noreferrer"
            className="hover:text-fg transition-colors duration-fast ease-snap"
          >
            Docs
          </a>
        </div>
      </div>
    </footer>
  );
}
