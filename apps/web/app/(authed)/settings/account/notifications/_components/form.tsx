'use client';

import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ErrorBlock, SuccessBlock } from '@/components/ui/error-block';
import { useCallback, useState } from 'react';
import { type Preferences, savePreferences } from './actions';

interface Props {
  prefs: Preferences;
}

export function NotificationsForm({ prefs: initial }: Props) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const hasChanges = JSON.stringify(prefs) !== JSON.stringify(initial);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      await savePreferences(prefs);
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <CardTitle>Email notifications</CardTitle>
        <p className="text-sm text-fg-subtle">
          Control which activities generate notifications. Sending is not yet implemented — these
          preferences will be used once a transport is configured.
        </p>

        <ToggleRow
          label="Approval requests"
          description="When someone requests access to a production secret"
          checked={prefs.approval_requests}
          onChange={(v) => setPrefs((p) => ({ ...p, approval_requests: v }))}
        />
        <ToggleRow
          label="Secret changes"
          description="When a secret is created, rotated, or deleted"
          checked={prefs.secret_changes}
          onChange={(v) => setPrefs((p) => ({ ...p, secret_changes: v }))}
        />
        <ToggleRow
          label="Member changes"
          description="When team members are added or removed"
          checked={prefs.member_changes}
          onChange={(v) => setPrefs((p) => ({ ...p, member_changes: v }))}
        />
      </Card>

      <Card className="p-5 space-y-4">
        <CardTitle>Activity digest</CardTitle>
        <p className="text-sm text-fg-subtle">How often to receive a summary of org activity.</p>

        <div className="flex gap-3">
          {(['daily', 'weekly', 'never'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setPrefs((p) => ({ ...p, activity_digest: d }))}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                prefs.activity_digest === d
                  ? 'border-accent bg-accent-bg text-accent-fg'
                  : 'border-border text-fg-subtle hover:border-border-strong'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </Card>

      {error && <ErrorBlock message={error} />}
      {ok && <SuccessBlock message="Preferences saved." />}

      <Button variant="primary" disabled={!hasChanges || saving} onClick={save}>
        {saving ? 'Saving…' : hasChanges ? 'Save changes' : 'Saved'}
      </Button>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent"
      />
      <div>
        <div className="text-sm font-medium text-fg group-hover:text-accent-fg transition-colors">
          {label}
        </div>
        <div className="text-xs text-fg-subtle">{description}</div>
      </div>
    </label>
  );
}
