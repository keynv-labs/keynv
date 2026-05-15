'use client';

import { notify } from '@/lib/toast';
import { TOAST_FLASH_REGISTRY, type ToastFlashKey } from '@/lib/toast-flash';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Client-side bridge that turns `?toast=<key>` into an actual toast
 * and strips the param so refresh doesn't re-fire. Mount once per
 * route group that needs it (login, register, dashboard root).
 *
 * See lib/toast-flash.ts for the convention.
 */
export function ToastFlashHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const key = params.get('toast') as ToastFlashKey | null;
    if (!key) return;

    const fingerprint = `${pathname}?${params.toString()}`;
    if (firedRef.current === fingerprint) return;
    firedRef.current = fingerprint;

    if (key === 'custom') {
      const msg = params.get('toastMsg');
      const level = (params.get('toastLevel') ?? 'info') as 'success' | 'info' | 'error';
      if (msg) {
        const sanitized = msg.replace(/[<>&]/g, '').slice(0, 200);
        notify[level](sanitized);
      }
    } else {
      const entry = TOAST_FLASH_REGISTRY[key];
      if (entry) {
        notify[entry.level](
          entry.message,
          entry.description ? { description: entry.description } : undefined,
        );
      }
    }

    const next = new URLSearchParams(params);
    next.delete('toast');
    next.delete('toastMsg');
    next.delete('toastLevel');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname, router]);

  return null;
}
