'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { verifyChainAction, type VerifyState } from './actions';

export function VerifyChainButton() {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyChainAction, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? 'Verifying…' : 'Verify chain'}
      </Button>
      {state.ok === true ? (
        <span className="text-xs text-[var(--color-success)]">
          ✓ chain verified ({state.checked} entries)
        </span>
      ) : state.ok === false ? (
        <span className="text-xs text-[var(--color-danger)]">
          ✗ broken at id {state.broken_at_id} ({state.reason})
        </span>
      ) : null}
    </form>
  );
}
