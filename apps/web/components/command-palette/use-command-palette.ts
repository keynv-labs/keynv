import { useCallback, useEffect, useRef, useState } from 'react';

export function useCommandPalette(onNavigate: (path: string) => void) {
  const [open, setOpen] = useState(false);
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);
  const prefixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function isInTextField(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      if (open) return;
      if (isInTextField(e.target)) return;

      if (pendingPrefix === 'g') {
        const navMap: Record<string, string> = {
          h: '/dashboard',
          p: '/projects',
          i: '/inbox',
          f: '/search',
          a: '/audit',
          s: '/settings/account',
          u: '/admin/users',
        };
        const route = navMap[e.key];
        if (route) {
          e.preventDefault();
          onNavigateRef.current(route);
        }
        setPendingPrefix(null);
        if (prefixTimeoutRef.current) clearTimeout(prefixTimeoutRef.current);
        return;
      }

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setPendingPrefix('g');
        if (prefixTimeoutRef.current) clearTimeout(prefixTimeoutRef.current);
        prefixTimeoutRef.current = setTimeout(() => {
          setPendingPrefix((curr) => (curr === 'g' ? null : curr));
        }, 1500);
      }
    }

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (prefixTimeoutRef.current) clearTimeout(prefixTimeoutRef.current);
    };
  }, [open, pendingPrefix]);

  return { open, setOpen, pendingPrefix, close };
}
