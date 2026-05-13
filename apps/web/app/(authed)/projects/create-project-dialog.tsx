'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorBlock } from '@/components/ui/error-block';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { type CreateProjectState, createProjectAction } from './new/actions';

interface EnvRow {
  id: string;
  name: string;
  tier: 'production' | 'non-production';
  approval: boolean;
}

function makeRow(overrides: Partial<EnvRow> = {}): EnvRow {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    tier: 'non-production',
    approval: false,
    ...overrides,
  };
}

const DEFAULT_ENVS: EnvRow[] = [
  makeRow({ name: 'dev', tier: 'non-production' }),
  makeRow({ name: 'prod', tier: 'production' }),
];

function serializeEnvs(rows: EnvRow[]): string {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => {
      if (r.tier === 'non-production' && !r.approval) return r.name;
      if (r.tier === 'production' && !r.approval) return `${r.name}:production`;
      return `${r.name}:${r.tier}:approval`;
    })
    .join(',');
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(
    createProjectAction,
    {},
  );
  const [envRows, setEnvRows] = useState<EnvRow[]>(() => DEFAULT_ENVS.map((r) => ({ ...r })));

  useEffect(() => {
    if (state.projectId) router.push(`/projects/${state.projectId}`);
  }, [state.projectId, router]);

  useEffect(() => {
    if (open) setEnvRows(DEFAULT_ENVS.map((r) => ({ ...r })));
  }, [open]);

  function updateRow(id: string, patch: Partial<EnvRow>) {
    setEnvRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>
          A project is a namespace for secrets. Each environment gets its own encryption key.
        </DialogDescription>

        <form action={action} className="mt-4 space-y-5">
          <input type="hidden" name="environments" value={serializeEnvs(envRows)} />

          <Field
            label="Name"
            hint={
              <>
                Lowercase kebab-case — appears in{' '}
                <code className="font-mono text-fg-muted">@name.env.key</code> references.
              </>
            }
          >
            <Input
              name="name"
              required
              placeholder="billing"
              pattern="^[a-z0-9][a-z0-9-]*$"
              minLength={1}
              maxLength={48}
              autoFocus
              autoComplete="off"
            />
          </Field>

          <div>
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-1.5">
              Environments
            </div>
            <p className="text-xs text-fg-muted mb-3">
              Mark as <span className="font-mono text-env-prod-fg">Prod</span> to apply production
              security policies. Enable <span className="font-medium text-fg">Approval</span> to
              require a lead to grant access before developers can read secrets.
            </p>

            <div className="space-y-2">
              {envRows.map((row) => (
                <EnvRowEditor
                  key={row.id}
                  row={row}
                  canRemove={envRows.length > 1}
                  onChange={(patch) => updateRow(row.id, patch)}
                  onRemove={() => setEnvRows((rows) => rows.filter((r) => r.id !== row.id))}
                />
              ))}
            </div>

            {envRows.length < 8 ? (
              <button
                type="button"
                onClick={() => setEnvRows((rows) => [...rows, makeRow()])}
                className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-fast ease-snap"
              >
                <Plus size={11} strokeWidth={2.5} />
                Add environment
              </button>
            ) : null}
          </div>

          {state.error ? <ErrorBlock message={state.error} /> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EnvRowEditor({
  row,
  canRemove,
  onChange,
  onRemove,
}: {
  row: EnvRow;
  canRemove: boolean;
  onChange: (patch: Partial<EnvRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-bg-inset">
      <div className="w-24 shrink-0">
        <Input
          value={row.name}
          onChange={(e) =>
            onChange({ name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
          }
          placeholder="name"
          required
          className="h-7 text-[12px] font-mono"
          autoComplete="off"
        />
      </div>

      <div className="flex divide-x divide-border rounded-md border border-border overflow-hidden shrink-0">
        <TierButton
          label="Dev"
          active={row.tier === 'non-production'}
          tone="dev"
          onClick={() => onChange({ tier: 'non-production' })}
        />
        <TierButton
          label="Prod"
          active={row.tier === 'production'}
          tone="prod"
          onClick={() => onChange({ tier: 'production' })}
        />
      </div>

      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <Checkbox
          checked={row.approval}
          onCheckedChange={(v) => onChange({ approval: v === true })}
        />
        <span className="text-[11px] text-fg-muted whitespace-nowrap">Approval</span>
      </label>

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove ${row.name || 'environment'}`}
        className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-subtle hover:text-danger hover:bg-danger-soft transition-colors duration-fast ease-snap disabled:invisible"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

function TierButton({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: 'dev' | 'prod';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 h-7 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-fast ease-snap',
        active
          ? tone === 'prod'
            ? 'bg-env-prod-bg text-env-prod-fg'
            : 'bg-env-dev-bg text-env-dev-fg'
          : 'bg-bg-inset text-fg-subtle hover:text-fg',
      )}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
        {label}
      </span>
      {children}
      {hint ? <span className="block mt-1.5 text-xs text-fg-muted">{hint}</span> : null}
    </label>
  );
}
