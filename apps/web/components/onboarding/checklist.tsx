'use client';

import { dismissOnboardingAction } from '@/app/(authed)/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  ONBOARDING_STEPS,
  type OnboardingStatus,
  completedStepCount,
  isOnboardingComplete,
} from '@/lib/onboarding';
import { notify } from '@/lib/toast';
import { ArrowRight, Check, CheckCircle2, Circle, Copy, Terminal, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Props {
  initialStatus: OnboardingStatus;
  /** Compact form for "almost done" rendering above the projects list. */
  compact?: boolean;
}

type StepState = 'done' | 'current' | 'pending';

interface StepDef {
  id: keyof OnboardingStatus;
  title: string;
  body: (state: StepState) => React.ReactNode;
}

export function OnboardingChecklist({ initialStatus, compact = false }: Props) {
  const [status] = useState(initialStatus);
  const [dismissed, setDismissed] = useState<boolean>(initialStatus.dismissed);

  const completed = completedStepCount(status);
  const allDone = isOnboardingComplete(status);

  if (dismissed || allDone) return null;

  async function handleDismiss() {
    setDismissed(true);
    notify.info('Hidden. You can re-enable from Settings if you change your mind.');
    await dismissOnboardingAction();
  }

  const steps = buildSteps();
  const firstPendingIdx = steps.findIndex((s) => !status[s.id]);

  return (
    <section
      className={cn(
        'relative rounded-xl border border-accent-soft-border bg-bg-elevated overflow-hidden',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent before:to-transparent',
        compact ? 'mb-6' : '',
      )}
      aria-label="Get started checklist"
    >
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-accent-soft/40">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="display text-base tracking-tight text-fg flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-amber-pulse" aria-hidden />
            Get started
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle tabular">
            <span className="text-accent">{completed}</span> / {ONBOARDING_STEPS}
          </span>
          <ProgressBar completed={completed} />
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Hide checklist"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </header>

      <ol className="divide-y divide-border">
        {steps.map((step, idx) => {
          const isDone = status[step.id];
          const isCurrent = !isDone && idx === firstPendingIdx;
          const state: StepState = isDone ? 'done' : isCurrent ? 'current' : 'pending';
          return (
            <li
              key={step.id}
              className={cn(
                'flex items-start gap-3 px-5 py-4 transition-colors duration-fast ease-snap',
                isCurrent ? 'bg-accent-soft/30' : '',
              )}
            >
              <StepIcon state={state} />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm font-medium flex items-center gap-2',
                    isDone ? 'text-fg-subtle line-through' : 'text-fg',
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle no-underline tabular">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {step.title}
                </div>
                {!isDone ? <div className="mt-2.5 text-sm">{step.body(state)}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-success" />;
  }
  if (state === 'current') {
    return (
      <span className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Circle size={10} strokeWidth={3} fill="currentColor" />
      </span>
    );
  }
  return <Circle size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-fg-subtle" />;
}

function ProgressBar({ completed }: { completed: number }) {
  const pct = (completed / ONBOARDING_STEPS) * 100;
  return (
    <div aria-hidden className="hidden sm:block h-1 w-32 rounded-full bg-border overflow-hidden">
      <div
        className="h-full bg-accent transition-all duration-base ease-snap"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function buildSteps(): StepDef[] {
  return [
    {
      id: 'project_created',
      title: 'Create your first project',
      body: () => (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-fg-muted">
            A project is a namespace for related secrets. Pick a short kebab-case name like{' '}
            <code className="font-mono text-accent bg-bg-inset border border-border rounded px-1.5 py-px text-[0.88em]">
              billing
            </code>{' '}
            or{' '}
            <code className="font-mono text-accent bg-bg-inset border border-border rounded px-1.5 py-px text-[0.88em]">
              api
            </code>
            .
          </p>
          <Link href={{ pathname: '/projects/new' }}>
            <Button size="sm" className="gap-1.5">
              New project
              <ArrowRight size={12} strokeWidth={2.25} />
            </Button>
          </Link>
        </div>
      ),
    },
    {
      id: 'secret_added',
      title: 'Add a secret to it',
      body: () => (
        <div className="space-y-2.5">
          <p className="text-fg-muted">
            Secrets live under{' '}
            <code className="font-mono text-accent bg-bg-inset border border-border rounded px-1.5 py-px text-[0.88em]">
              @project.env.key
            </code>{' '}
            aliases. Add one from the project page, or run:
          </p>
          <CommandSnippet command="keynv secret set @yourproject.dev.api_key" />
        </div>
      ),
    },
    {
      id: 'cli_authenticated',
      title: 'Sign in from your CLI',
      body: () => (
        <div className="space-y-2.5">
          <p className="text-fg-muted">
            The CLI lives on your laptop and talks to this server. Install + log in:
          </p>
          <CommandSnippet command="npm install -g @keynv/cli" />
          <CommandSnippet command="keynv login --server https://api.keynv.dev" />
        </div>
      ),
    },
    {
      id: 'integration_installed',
      title: 'Onboard your AI agents',
      body: () => (
        <div className="space-y-2.5">
          <p className="text-fg-muted">
            Run{' '}
            <code className="font-mono text-accent bg-bg-inset border border-border rounded px-1.5 py-px text-[0.88em]">
              keynv init
            </code>{' '}
            in your project root. It scans existing
            <code className="font-mono text-accent bg-bg-inset border border-border rounded px-1.5 py-px text-[0.88em]">
              .env
            </code>{' '}
            files, migrates secrets to the vault, and writes a
            <code className="font-mono text-accent bg-bg-inset border border-border rounded px-1.5 py-px text-[0.88em]">
              .keynv.env
            </code>{' '}
            that maps alias names — safe to commit.
          </p>
          <CommandSnippet command="keynv init" />
        </div>
      ),
    },
  ];
}

function CommandSnippet({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
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
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-bg-inset px-3 py-2.5 max-w-full">
      <Terminal size={12} strokeWidth={2} className="shrink-0 text-accent" />
      <code className="flex-1 font-mono text-xs text-fg overflow-x-auto whitespace-nowrap tabular">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
      >
        {copied ? (
          <Check size={11} strokeWidth={2.25} className="text-success" />
        ) : (
          <Copy size={11} strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
