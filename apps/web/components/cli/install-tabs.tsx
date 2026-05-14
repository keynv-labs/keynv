'use client';

import { cn } from '@/lib/cn';
import { notify } from '@/lib/toast';
import { Check, Copy, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';

type TabId = 'npm' | 'brew' | 'curl' | 'scoop';

interface Tab {
  id: TabId;
  label: string;
  os: 'mac' | 'linux' | 'windows' | 'any';
  install: string;
  verify: string;
}

const TABS: Tab[] = [
  {
    id: 'npm',
    label: 'npm',
    os: 'any',
    install: 'npm install -g @keynv/cli',
    verify: 'keynv --version',
  },
  {
    id: 'brew',
    label: 'Homebrew',
    os: 'mac',
    install: 'brew install keynv-labs/tap/keynv',
    verify: 'keynv --version',
  },
  {
    id: 'curl',
    label: 'curl | sh',
    os: 'linux',
    install: 'curl -fsSL https://keynv.dev/install.sh | sh',
    verify: 'keynv --version',
  },
  {
    id: 'scoop',
    label: 'Scoop',
    os: 'windows',
    install: 'scoop install keynv',
    verify: 'keynv --version',
  },
];

function detectInitialTab(): TabId {
  if (typeof navigator === 'undefined') return 'npm';
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() ?? '';
  if (platform.includes('mac') || ua.includes('mac os')) return 'brew';
  if (platform.includes('win') || ua.includes('windows')) return 'scoop';
  if (platform.includes('linux') || ua.includes('linux')) return 'curl';
  return 'npm';
}

export function InstallTabs() {
  // Hydration safety: start with a stable value, then refine after mount.
  const [active, setActive] = useState<TabId>('npm');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setActive(detectInitialTab());
    setMounted(true);
  }, []);

  const tab = TABS.find((t) => t.id === active) ?? TABS[0];
  if (!tab) return null;

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-20 md:py-24">
        <div className="display-eyebrow text-center">04 · install the CLI</div>
        <h2 className="display mt-3 text-3xl md:text-[42px] leading-[1.05] text-center max-w-2xl mx-auto">
          One command. <span className="text-fg-muted">The CLI does the rest.</span>
        </h2>

        <div
          className="mt-10 rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-[0_24px_64px_-24px_rgba(0,0,0,0.5)]"
          suppressHydrationWarning
        >
          <div role="tablist" aria-label="Install commands" className="flex border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={t.id === active}
                aria-controls={`install-panel-${t.id}`}
                id={`install-tab-${t.id}`}
                onClick={() => setActive(t.id)}
                className={cn(
                  'flex-1 px-3 py-3 text-sm font-medium transition-colors duration-fast ease-snap border-b-2',
                  t.id === active
                    ? 'text-fg border-accent bg-bg-elevated-hover'
                    : 'text-fg-muted border-transparent hover:text-fg hover:bg-bg-elevated-hover',
                )}
              >
                {t.label}
                {mounted && t.os !== 'any' && t.id === active ? (
                  <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.18em] text-accent">
                    detected
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`install-panel-${tab.id}`}
            aria-labelledby={`install-tab-${tab.id}`}
            className="p-6 space-y-5"
          >
            <CommandRow label="Install" command={tab.install} primary />
            <CommandRow label="Verify" command={tab.verify} />
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-fg-subtle font-mono uppercase tracking-[0.14em]">
          full first-run walkthrough →{' '}
          <a className="text-accent hover:underline normal-case font-sans" href="/docs/quickstart">
            quickstart
          </a>
        </p>
      </div>
    </section>
  );
}

function CommandRow({
  label,
  command,
  primary = false,
}: {
  label: string;
  command: string;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      notify.success('Copied to clipboard');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Couldn't copy — your browser blocked clipboard access");
    }
  }

  return (
    <div>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-fg-subtle mb-2">
        {label}
      </div>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg border bg-bg-inset px-3.5 py-3',
          primary ? 'border-accent-soft-border' : 'border-border',
        )}
      >
        <Terminal
          size={13}
          strokeWidth={2}
          className={cn('shrink-0', primary ? 'text-accent' : 'text-fg-subtle')}
        />
        <code className="flex-1 font-mono text-sm text-fg overflow-x-auto whitespace-nowrap">
          {command}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : `Copy ${label.toLowerCase()} command`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
        >
          {copied ? (
            <Check size={13} strokeWidth={2.25} className="text-success" />
          ) : (
            <Copy size={13} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
