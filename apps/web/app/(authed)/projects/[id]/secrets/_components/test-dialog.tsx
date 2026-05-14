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
import { Select, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useActionState } from 'react';
import { type TestActionState, runTestAction } from '../_actions/test-actions';

type TesterType = 'postgres' | 'mysql' | 'redis' | 'ssh' | 'http';

const TESTER_LABELS: Record<TesterType, string> = {
  postgres: 'Postgres',
  mysql: 'MySQL',
  redis: 'Redis',
  ssh: 'SSH',
  http: 'HTTP',
};

interface Props {
  projectId: string;
  env: string;
  keyName: string;
  alias: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestSecretDialog({ projectId, env, keyName, alias, open, onOpenChange }: Props) {
  const [tester, setTester] = useState<TesterType>('postgres');
  const [state, action, pending] = useActionState<TestActionState, FormData>(runTestAction, {});
  const result = state.result;

  useEffect(() => {
    if (!open) {
      setTester('postgres');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          Test{' '}
          <span className="font-mono text-fg tabular">
            <span className="text-accent">@</span>
            {alias.replace(/^@/, '')}
          </span>
        </DialogTitle>
        <DialogDescription>
          Pick a tester type and target. The secret value is decrypted server-side only for the
          duration of this call. Result is sanitised before it returns — no value will appear here.
        </DialogDescription>

        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="env" value={env} />
          <input type="hidden" name="key" value={keyName} />

          <Field label="Tester type">
            <Select name="tester" value={tester} onValueChange={(v) => setTester(v as TesterType)}>
              {(['postgres', 'mysql', 'redis', 'ssh', 'http'] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {TESTER_LABELS[t]}
                </SelectItem>
              ))}
            </Select>
          </Field>

          <TargetForm tester={tester} />

          {state.error ? <ErrorBlock message={state.error} /> : null}

          {result ? <ResultBlock result={result} /> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Testing…
                </>
              ) : (
                'Run test'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TargetForm({ tester }: { tester: TesterType }) {
  switch (tester) {
    case 'postgres':
    case 'mysql':
      return <DbForm tester={tester} defaultPort={tester === 'postgres' ? 5432 : 3306} />;
    case 'redis':
      return <RedisForm />;
    case 'ssh':
      return <SshForm />;
    case 'http':
      return <HttpForm />;
  }
}

function DbForm({ tester, defaultPort }: { tester: 'postgres' | 'mysql'; defaultPort: number }) {
  return (
    <BuildJson
      fields={[
        { name: 'host', label: 'Host', placeholder: 'db.example.com', required: true },
        {
          name: 'port',
          label: 'Port',
          type: 'number',
          defaultValue: String(defaultPort),
          required: true,
        },
        { name: 'database', label: 'Database', placeholder: 'mydb', required: true },
        {
          name: 'user',
          label: 'Username',
          placeholder: tester === 'postgres' ? 'postgres' : 'root',
          required: true,
        },
        { name: 'ssl', label: 'Use SSL', type: 'checkbox' },
      ]}
    />
  );
}

function RedisForm() {
  return (
    <BuildJson
      fields={[
        { name: 'host', label: 'Host', placeholder: 'redis.example.com', required: true },
        { name: 'port', label: 'Port', type: 'number', defaultValue: '6379', required: true },
        { name: 'username', label: 'Username (optional)', placeholder: 'default' },
        { name: 'tls', label: 'Use TLS', type: 'checkbox' },
      ]}
    />
  );
}

function SshForm() {
  return (
    <BuildJson
      fields={[
        { name: 'host', label: 'Host', placeholder: 'host.example.com', required: true },
        { name: 'port', label: 'Port', type: 'number', defaultValue: '22', required: true },
        { name: 'username', label: 'Username', placeholder: 'deploy', required: true },
      ]}
    />
  );
}

function HttpForm() {
  return (
    <BuildJson
      fields={[
        {
          name: 'url',
          label: 'URL',
          placeholder: 'https://api.example.com/health',
          required: true,
        },
        { name: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'HEAD'] },
        {
          name: 'auth',
          label: 'Auth style',
          type: 'select',
          options: ['bearer', 'basic', 'header'],
          required: true,
        },
        { name: 'user', label: 'Username (basic only)' },
        { name: 'header_name', label: 'Header name (header only)', placeholder: 'X-API-Key' },
        {
          name: 'expect_status_min',
          label: 'Expect status ≥',
          type: 'number',
          defaultValue: '200',
        },
        {
          name: 'expect_status_max',
          label: 'Expect status ≤',
          type: 'number',
          defaultValue: '299',
        },
      ]}
    />
  );
}

interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'select';
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  options?: string[];
}

function BuildJson({ fields }: { fields: FieldDef[] }) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of fields) {
      if (f.type === 'checkbox') init[f.name] = false;
      else init[f.name] = f.defaultValue ?? '';
    }
    return init;
  });

  const targetJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(values).filter(([, v]) => {
        if (typeof v === 'string') return v.length > 0;
        return true;
      }),
    ),
  );

  function setField(name: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <>
      <input type="hidden" name="target_json" value={targetJson} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.name} label={f.label}>
            {f.type === 'checkbox' ? (
              <label className="inline-flex items-center gap-2 text-sm text-fg h-9">
                <Checkbox
                  checked={Boolean(values[f.name])}
                  onCheckedChange={(v) => setField(f.name, v === true)}
                />
                <span className="text-fg-muted text-xs">enable</span>
              </label>
            ) : f.type === 'select' ? (
              <Select
                value={String(values[f.name] ?? '')}
                onValueChange={(v) => setField(f.name, v)}
              >
                <SelectItem value="">—</SelectItem>
                {f.options?.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </Select>
            ) : (
              <Input
                type={f.type === 'number' ? 'number' : 'text'}
                value={String(values[f.name] ?? '')}
                onChange={(e) => setField(f.name, e.target.value)}
                placeholder={f.placeholder}
                required={f.required}
                autoComplete="off"
              />
            )}
          </Field>
        ))}
      </div>
    </>
  );
}

function ResultBlock({
  result,
}: {
  result: { ok: boolean; latency_ms: number; error?: string; info?: Record<string, unknown> };
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-sm',
        result.ok
          ? 'border-success-soft-border bg-success-soft'
          : 'border-danger-soft-border bg-danger-soft',
      )}
    >
      <div className="flex items-center gap-2">
        {result.ok ? (
          <CheckCircle2 size={14} className="text-success shrink-0" strokeWidth={2.25} />
        ) : (
          <XCircle size={14} className="text-danger shrink-0" strokeWidth={2.25} />
        )}
        <span className="font-medium">{result.ok ? 'Connected' : 'Failed'}</span>
        <span className="ml-auto font-mono text-xs text-fg-muted tabular">
          {result.latency_ms}ms
        </span>
      </div>
      {result.error ? (
        <div className="mt-2 font-mono text-[12px] text-danger break-all">{result.error}</div>
      ) : null}
      {result.info && Object.keys(result.info).length > 0 ? (
        <pre className="mt-2 font-mono text-[11px] text-fg-muted whitespace-pre-wrap break-all">
          {JSON.stringify(result.info, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}
