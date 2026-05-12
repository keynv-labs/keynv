'use client';

import { Logomark } from '@/components/dossier/logomark';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SidebarContent } from './sidebar';

interface Props {
  email: string;
  role: string;
}

export function MobileTopBar({ email, role }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the path changes. The effect body
  // doesn't read `pathname` directly — we list it as a dep purely to
  // re-run the close on each navigation. Biome's exhaustive-deps rule
  // doesn't have a way to express that intent, so it's ignored here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on path change is the intent
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-3 border-b border-border bg-bg-elevated">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
        >
          <Menu size={18} strokeWidth={2} />
        </button>
        <Link
          href={{ pathname: '/projects' }}
          className="flex items-baseline gap-2.5 font-display text-fg"
        >
          <Logomark size="sm" />
          <span className="text-xl font-medium tracking-tight leading-none">keynv</span>
        </Link>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent email={email} role={role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
