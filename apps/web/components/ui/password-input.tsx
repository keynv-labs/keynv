'use client';

import { cn } from '@/lib/cn';
import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, type KeyboardEvent, useId, useState } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  capsLockWarning?: boolean;
}

/**
 * Password input with a show/hide toggle and optional caps-lock
 * warning. `capsLockWarning` defaults to true since for password
 * fields the help vastly outweighs the screen-real-estate cost.
 */
export function PasswordInput({ className, capsLockWarning = true, onKeyDown, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const warningId = useId();

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (capsLockWarning) {
      const isOn = e.getModifierState?.('CapsLock') ?? false;
      setCapsOn(isOn);
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        onKeyDown={handleKeyDown}
        aria-describedby={capsLockWarning && capsOn ? warningId : undefined}
        className={cn(
          'h-8 w-full rounded-md border border-border bg-bg pl-2.5 pr-9 text-sm text-fg',
          'placeholder:text-fg-subtle',
          'transition-colors duration-fast ease-snap',
          'hover:border-border-strong',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
        tabIndex={-1}
      >
        {visible ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
      </button>
      {capsLockWarning && capsOn ? (
        <output id={warningId} className="mt-1 block text-[11px] text-warn" aria-live="polite">
          Caps Lock is on
        </output>
      ) : null}
    </div>
  );
}
