import { HashChip } from '@/components/dossier/hash-chip';
import { MarginNote } from '@/components/dossier/margin-note';
import { RedactedText } from '@/components/dossier/redacted-text';
import { Stamp } from '@/components/dossier/stamp';
import { InstallTabs } from '@/components/install-tabs';
import { GithubStars } from '@/components/trust/github-stars';
import { StatusPill } from '@/components/trust/status-pill';
import { Button } from '@/components/ui/button';
import { SkipLink } from '@/components/ui/skip-link';
import { getCapabilities } from '@/lib/capabilities';
import { getSession } from '@/lib/session';
import { ArrowRight, Github } from 'lucide-react';
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

const FILED = new Date().toISOString().slice(0, 10);
const CASE_NUMBER = '0001';

export default async function LandingPage() {
  const [session, { publicSignup }] = await Promise.all([getSession(), getCapabilities()]);
  const ctx: CtaContext = { isAuthed: Boolean(session), publicSignup };

  return (
    <div className="newsprint min-h-screen flex flex-col">
      <SkipLink />
      <Masthead ctx={ctx} />
      <main id="main" className="flex-1">
        <Hero ctx={ctx} />
        <Problem />
        <Exhibits />
        <Procedure />
        <Install />
        <ClosingCta ctx={ctx} />
      </main>
      <Colophon />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* MASTHEAD                                                               */
/* ────────────────────────────────────────────────────────────────────── */

function Masthead({ ctx }: { ctx: CtaContext }) {
  return (
    <header className="border-b-2 border-fg/90">
      <div className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-2 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.22em] text-fg-muted">
          <span>VOL. I · NO. {CASE_NUMBER}</span>
          <span className="hidden sm:inline">SELF-HOSTED · AI-SAFE BY DESIGN</span>
          <span>{FILED}</span>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 flex items-end justify-between gap-6 flex-wrap">
        <Link href={{ pathname: '/' }} className="flex items-baseline gap-3">
          <Logomark />
          <span className="font-display text-5xl md:text-6xl leading-none tracking-tight font-medium">
            keynv
          </span>
        </Link>
        <nav className="flex items-baseline gap-5 text-[13px] text-fg-muted font-sans">
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
          <CtaCluster ctx={ctx} compact />
        </nav>
      </div>
    </header>
  );
}

function Logomark() {
  return (
    <span
      aria-hidden
      className="inline-flex h-12 w-12 items-center justify-center bg-fg text-bg font-display font-semibold text-3xl leading-none -tracking-wide relative shrink-0"
      style={{
        boxShadow: '4px 4px 0 0 var(--color-highlight)',
      }}
    >
      k
    </span>
  );
}

function CtaCluster({ ctx, compact = false }: { ctx: CtaContext; compact?: boolean }) {
  if (ctx.isAuthed) {
    return (
      <Link href={{ pathname: '/projects' }}>
        <Button className="gap-1.5 bg-fg text-bg hover:opacity-80 rounded-none border border-fg">
          Open dashboard
          <ArrowRight size={13} strokeWidth={2.25} />
        </Button>
      </Link>
    );
  }
  if (ctx.publicSignup) {
    return (
      <span className="flex items-center gap-3">
        {!compact && (
          <Link href={{ pathname: '/login' }} className="text-sm hover:underline">
            Sign in
          </Link>
        )}
        <Link href={{ pathname: '/register' }}>
          <Button
            className="gap-1.5 rounded-none border border-fg bg-fg text-bg hover:bg-fg hover:opacity-85"
            style={{
              boxShadow: '3px 3px 0 0 var(--color-highlight)',
            }}
          >
            Get started
            <ArrowRight size={13} strokeWidth={2.25} />
          </Button>
        </Link>
      </span>
    );
  }
  return (
    <Link href={{ pathname: '/login' }}>
      <Button className="gap-1.5 rounded-none border border-fg bg-fg text-bg">
        Sign in
        <ArrowRight size={13} strokeWidth={2.25} />
      </Button>
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* HERO                                                                   */
/* ────────────────────────────────────────────────────────────────────── */

function Hero({ ctx }: { ctx: CtaContext }) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 md:px-6 pt-16 md:pt-24 pb-20 md:pb-28 grid gap-10 md:grid-cols-12 items-start">
        <div className="md:col-span-8 relative">
          <div className="animate-stamp">
            <Stamp
              parts={['FILED', FILED, `CASE ${CASE_NUMBER}`, 'INSTANCE — keynv.dev']}
              variant="rotate"
            />
          </div>

          <h1 className="font-display font-medium tracking-[-0.02em] leading-[0.95] text-[clamp(3.5rem,9vw,7.5rem)] mt-8">
            Secrets your AI
            <br />
            agent <RedactedText mode="hover">can&rsquo;t</RedactedText> see.
          </h1>

          <p className="font-sans text-[19px] md:text-[20px] leading-[1.55] text-fg-muted mt-7 max-w-[44ch]">
            A self-hosted vault for your team&rsquo;s API keys, database passwords, and SSH
            credentials. Reference everything by <span className="highlight">alias</span> — the only
            string an AI agent ever observes.
          </p>

          <div className="mt-9 flex items-center gap-4 flex-wrap">
            <CtaCluster ctx={ctx} />
            <a
              href="https://github.com/keynv-labs/keynv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm hover:underline"
            >
              <Github size={14} strokeWidth={2} />
              View source on GitHub
            </a>
          </div>

          {!ctx.isAuthed && ctx.publicSignup ? (
            <p className="mt-5 text-[12px] text-fg-subtle font-mono uppercase tracking-[0.18em]">
              Free during public beta · No credit card · Self-host the same binary anytime
            </p>
          ) : null}
        </div>

        <aside className="md:col-span-4 md:pt-32 hidden md:block">
          <Stamp parts={['ABSTRACT']} variant="inline" />
          <p className="mt-3 font-sans italic text-[16px] leading-[1.55] text-fg-muted">
            Existing vaults — HashiCorp, Doppler, 1Password — were built for an era when{' '}
            <RedactedText mode="hover">developers</RedactedText> typed the commands.
          </p>
          <p className="mt-3 font-sans italic text-[16px] leading-[1.55] text-fg-muted">
            keynv assumes the agent is already in the room.
          </p>
          <hr className="mt-6 border-t border-fg/30 w-12" />
          <div className="mt-4">
            <Transcript />
          </div>
        </aside>
      </div>
    </section>
  );
}

function Transcript() {
  const lines = [
    { no: '01', kind: 'cmd', body: '$ keynv exec -- mysql -p @billing.prod.db_password' },
    { no: '02', kind: 'comment', body: '   resolved in subprocess; agent sees only the alias' },
    { no: '03', kind: 'blank', body: '' },
    { no: '04', kind: 'cmd', body: '$ ps aux | grep mysql' },
    { no: '05', kind: 'output', body: '   mysql -p ████████ -h ████████' },
  ];
  return (
    <figure className="border border-fg/80 bg-bg-overlay p-0 shadow-[6px_6px_0_0_var(--color-redact)]">
      <figcaption className="px-3 py-2 border-b border-fg/30 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
        <span>TRANSCRIPT — ~/billing-app</span>
        <HashChip hash="a3f5912cb74e0d61" length={6} />
      </figcaption>
      <pre className="font-mono text-[12.5px] leading-[1.7] p-3 overflow-x-auto whitespace-pre">
        {lines.map((l) => (
          <span key={l.no} className="block">
            <span className="text-fg-subtle inline-block w-7 select-none">{l.no}</span>
            {l.kind === 'cmd' ? (
              <span className="text-fg">{l.body}</span>
            ) : l.kind === 'comment' ? (
              <span className="text-fg-subtle">{l.body}</span>
            ) : l.kind === 'output' ? (
              <span className="text-fg-muted">{l.body}</span>
            ) : (
              <span> </span>
            )}
          </span>
        ))}
      </pre>
    </figure>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* PROBLEM — inverted spread                                              */
/* ────────────────────────────────────────────────────────────────────── */

function Problem() {
  return (
    <section className="newsprint-inverted border-y-2 border-fg">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-28 grid gap-10 md:grid-cols-12 items-start">
        <header className="md:col-span-5">
          <Stamp parts={['§ I · DIAGNOSIS', 'OPENED 2024']} />
          <h2 className="font-display tracking-[-0.015em] text-[clamp(2.25rem,5vw,3.75rem)] leading-[0.98] mt-6 font-medium">
            AI coding agents made the secret-leak problem an{' '}
            <em className="font-display italic">order of magnitude</em> worse.
          </h2>
        </header>

        <div className="md:col-span-6 md:col-start-7 relative">
          <p className="font-sans text-[18px] leading-[1.65] text-fg-muted">
            Developers leak credentials constantly —{' '}
            <code className="font-mono text-fg bg-bg-elevated border border-border px-1 py-0.5 rounded-sm text-[0.92em]">
              .env
            </code>{' '}
            files committed to repos, keys left in shell history, tokens in tool outputs.
          </p>
          <p className="font-sans text-[18px] leading-[1.65] text-fg-muted mt-4">
            AI agents permanently residing in your terminal made it worse: every command, every
            file, every diff is shipped to a vendor&rsquo;s logs. Existing vaults are mature — and
            none were designed around an agent being there.
          </p>
          <MarginNote label="CF.">
            See <span className="underline">/docs/threat-model</span> for the full adversary model.
          </MarginNote>
        </div>

        <div className="md:col-span-12 grid gap-px bg-fg/30 sm:grid-cols-3 mt-6 border border-fg/30">
          <Statistic
            value="23.7M"
            label="hardcoded secrets pushed to GitHub in 2024"
            cite="GitGuardian · State of Secrets Sprawl 2024"
          />
          <Statistic
            value="every diff"
            label="visible to your AI agent’s vendor and their logs"
            cite="observed behaviour · Claude Code, Cursor, Copilot"
          />
          <Statistic
            value="alias only"
            label="resolution happens in a process the agent cannot read"
            cite="keynv — keynv exec(8)"
          />
        </div>
      </div>
    </section>
  );
}

function Statistic({ value, label, cite }: { value: string; label: string; cite: string }) {
  return (
    <div className="bg-bg p-6">
      <div className="font-display text-[56px] leading-[0.95] font-medium tracking-[-0.02em] text-fg">
        {value}
      </div>
      <div className="font-sans text-[15px] leading-[1.5] text-fg-muted mt-3 max-w-[28ch]">
        {label}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle mt-5">
        {cite}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* EXHIBITS                                                               */
/* ────────────────────────────────────────────────────────────────────── */

function Exhibits() {
  return (
    <section id="pillars" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto">
          <Stamp parts={['§ II · FILES', 'EXHIBITS A–C']} className="justify-center" />
          <h2 className="font-display tracking-[-0.015em] text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.0] mt-5 font-medium">
            Three products. One file cabinet.
          </h2>
        </div>

        <div className="mt-14 grid gap-px bg-fg/30 sm:grid-cols-3 border border-fg/30">
          <Exhibit
            tag="EXHIBIT A"
            title="A self-hosted vault"
            body="SQLite + Litestream, one file with real-time S3 backup. Envelope encryption via libsodium: KEK in OS keychain, a per-project DEK on top. RBAC across owner / admin / developer / reader, with project-scoped overrides."
            footnotes={[
              'XSalsa20-Poly1305 via libsodium',
              'Postgres adapter is Phase 6',
              'No phone-home, no telemetry',
            ]}
          />
          <Exhibit
            tag="EXHIBIT B"
            title="The AI-safety layer"
            body={
              <>
                Aliases like <code className="font-mono text-fg">@project.env.key</code> are the
                only strings an agent sees. <code className="font-mono text-fg">keynv exec</code>{' '}
                spawns a subprocess your agent can&rsquo;t read; the MCP server returns single-use
                refs, never values; tool outputs are passed through the redactor.
              </>
            }
            footnotes={[
              'Regex + entropy scanner',
              'Per-agent installers',
              'Subprocess argv is masked',
            ]}
          />
          <Exhibit
            tag="EXHIBIT C"
            title="A tamper-evident ledger"
            body={
              <>
                Every read, write, rotation, role change is appended to a hash-chained audit log.
                SHA-256 prev-hash links each row to the one before it; the chain can be walked
                end-to-end any time.
              </>
            }
            footnotes={[
              <span key="tail" className="inline-flex items-center gap-2">
                tail
                <HashChip hash="a3f5912cb74e0d61" length={6} />
              </span>,
              'Verifiable any time',
              'Filter by actor, alias, range',
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function Exhibit({
  tag,
  title,
  body,
  footnotes,
}: {
  tag: string;
  title: string;
  body: React.ReactNode;
  footnotes: React.ReactNode[];
}) {
  return (
    <article className="bg-bg p-7 flex flex-col">
      <Stamp parts={[tag]} />
      <h3 className="font-display text-[28px] leading-[1.05] tracking-[-0.01em] mt-3 font-medium text-fg">
        {title}
      </h3>
      <p className="font-sans text-[15.5px] leading-[1.6] text-fg-muted mt-3">{body}</p>
      <ul className="mt-6 pt-4 border-t border-fg/15 space-y-1.5 font-mono text-[11px] text-fg-subtle uppercase tracking-[0.18em]">
        {footnotes.map((fn, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static layout
          <li key={i} className="flex items-baseline gap-2">
            <span aria-hidden className="text-fg-subtle">
              ¹
            </span>
            <span>{fn}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* PROCEDURE — How it works                                               */
/* ────────────────────────────────────────────────────────────────────── */

function Procedure() {
  return (
    <section id="how-it-works" className="border-b border-border">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <Stamp parts={['§ III · PROCEDURE']} />
          <h2 className="font-display tracking-[-0.015em] text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.0] mt-5 font-medium">
            Aliases in code. Resolution in a process the agent can&rsquo;t see.
          </h2>
        </div>

        <ol className="mt-14 space-y-px bg-fg/30 border border-fg/30">
          <Step
            no="01"
            title="Store"
            body={
              <>
                Add secrets through the CLI or the web dashboard. Values are encrypted with a
                per-project DEK; the master KEK lives in the OS keychain or your HSM.
              </>
            }
            cmd="keynv secret set @billing.prod.db_password"
          />
          <Step
            no="02"
            title="Reference"
            body={
              <>
                In code, configs, and shell commands you type{' '}
                <code className="font-mono text-fg bg-bg-elevated border border-border px-1 py-0.5 rounded-sm text-[0.9em]">
                  @billing.prod.db_password
                </code>
                . That alias is the only string the AI agent ever sees.
              </>
            }
            cmd='echo "DB=@billing.prod.db_password" >> .envrc'
          />
          <Step
            no="03"
            title="Resolve safely"
            body={
              <>
                <code className="font-mono text-fg bg-bg-elevated border border-border px-1 py-0.5 rounded-sm text-[0.9em]">
                  keynv exec
                </code>{' '}
                spawns a subprocess with the real value injected via stdin or a temp file. The
                agent&rsquo;s process tree, env, and tool output are scrubbed.
              </>
            }
            cmd="keynv exec -- pnpm dev"
          />
        </ol>
      </div>
    </section>
  );
}

function Step({
  no,
  title,
  body,
  cmd,
}: {
  no: string;
  title: string;
  body: React.ReactNode;
  cmd: string;
}) {
  return (
    <li className="bg-bg p-7 grid gap-6 md:grid-cols-12 items-start">
      <div className="md:col-span-1">
        <span className="font-display text-[44px] leading-[0.9] font-medium tracking-[-0.02em] text-fg">
          {no}
        </span>
      </div>
      <div className="md:col-span-6">
        <h3 className="font-display text-[26px] leading-[1.1] tracking-[-0.01em] font-medium">
          {title}
        </h3>
        <p className="font-sans text-[16px] leading-[1.6] text-fg-muted mt-2">{body}</p>
      </div>
      <div className="md:col-span-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle mb-2">
          Sample
        </div>
        <code className="block font-mono text-[12.5px] leading-[1.5] bg-bg-overlay border border-border-strong px-3 py-3 text-fg overflow-x-auto whitespace-pre">
          <span className="text-fg-subtle">$ </span>
          {cmd}
        </code>
      </div>
    </li>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* INSTALL                                                                */
/* ────────────────────────────────────────────────────────────────────── */

function Install() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-16 md:py-20">
        <div className="max-w-3xl">
          <Stamp parts={['§ IV · INSTALLATION']} />
        </div>
        <InstallTabs />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* CLOSING CTA — inverted                                                  */
/* ────────────────────────────────────────────────────────────────────── */

function ClosingCta({ ctx }: { ctx: CtaContext }) {
  return (
    <section className="newsprint-inverted border-y-2 border-fg">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-20 md:py-28 text-center">
        <Stamp parts={['§ V · CLOSING']} className="justify-center" />
        <h2 className="font-display tracking-[-0.015em] text-[clamp(2.5rem,6vw,5rem)] leading-[0.98] mt-5 font-medium">
          Ready to stop <RedactedText mode="hover">leaking</RedactedText>?
        </h2>
        <p className="font-sans text-[18px] leading-[1.55] text-fg-muted mt-5 max-w-2xl mx-auto">
          Fifteen-minute self-host on Coolify. Single binary CLI. Source-available now, MIT when
          Phase 5 ships.
        </p>
        <div className="mt-9 flex items-center justify-center gap-4 flex-wrap">
          <CtaCluster ctx={ctx} />
          <Link href={{ pathname: '/docs/quickstart' }}>
            <Button
              variant="secondary"
              className="rounded-none border border-fg bg-transparent text-fg hover:bg-fg/10"
            >
              Quickstart guide
            </Button>
          </Link>
        </div>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
          FILED {FILED} · CASE {CASE_NUMBER} · keynv.dev
        </p>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* COLOPHON / FOOTER                                                       */
/* ────────────────────────────────────────────────────────────────────── */

function Colophon() {
  return (
    <footer className="border-t border-fg/40">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-baseline gap-3">
              <Logomark />
              <span className="font-display text-2xl font-medium tracking-tight">keynv</span>
            </div>
            <p className="mt-5 font-sans text-[14px] leading-[1.6] text-fg-muted max-w-sm">
              Self-hosted, source-available secrets manager built for the AI-coding era. Phase 4 in
              progress; treat as not-yet-OSI-licensed until Phase 5 ships.
            </p>
            <div className="mt-5">
              <StatusPill />
            </div>
          </div>

          <FooterColumn title="Product">
            <FooterLink href="/docs">Documentation</FooterLink>
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

        <div className="mt-12 pt-6 border-t border-fg/25 flex flex-col md:flex-row md:items-center md:justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
          <span>
            PUBLIC BETA · SOC2 READINESS H2 2026 ·{' '}
            <Link href={{ pathname: '/docs/threat-model' }} className="text-fg-muted hover:text-fg">
              today’s defence
            </Link>
          </span>
          <span>© {new Date().getFullYear()} keynv labs</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-subtle">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5 font-sans text-[14px]">{children}</ul>
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
          className="hover:underline transition-colors duration-fast ease-snap"
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
        className="hover:underline transition-colors duration-fast ease-snap"
      >
        {children}
      </Link>
    </li>
  );
}
