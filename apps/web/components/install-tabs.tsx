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
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-16 md:py-20">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle text-center">
          Install the CLI
        </div>
        <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-center max-w-2xl mx-auto">
          One command. The CLI does the rest.
        </h2>

        <div
          className="mt-8 rounded-xl border border-border bg-bg-elevated overflow-hidden"
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
                  'flex-1 px-3 py-2.5 text-sm font-medium transition-colors duration-fast ease-snap border-b-2',
                  t.id === active
                    ? 'text-fg border-accent bg-bg-elevated-hover'
                    : 'text-fg-muted border-transparent hover:text-fg hover:bg-bg-elevated-hover',
                )}
              >
                {t.label}
                {mounted && t.os !== 'any' && t.id === active ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-fg-subtle">
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
            className="p-5 space-y-4"
          >
            <CommandRow label="Install" command={tab.install} primary />
            <CommandRow label="Verify" command={tab.verify} />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          See the{' '}
          <a className="text-fg hover:underline" href="/docs/quickstart">
            quickstart
          </a>{' '}
          for the full first-run walkthrough.
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
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">
        {label}
      </div>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg border bg-bg px-3 py-2.5',
          primary ? 'border-border-strong' : 'border-border',
        )}
      >
        <Terminal size={13} strokeWidth={2} className="shrink-0 text-fg-subtle" />
        <code className="flex-1 font-mono text-sm text-fg overflow-x-auto whitespace-nowrap">
          {command}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : `Copy ${label.toLowerCase()} command`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
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
