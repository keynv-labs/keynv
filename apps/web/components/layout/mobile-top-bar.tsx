'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SidebarContent } from './sidebar';

interface Props {
  email: string;
  role: string;
}

export function MobileTopBar({ email, role }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on navigation (path change).
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
          className="flex items-center gap-2 font-semibold tracking-tight text-fg"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-fg-on-accent text-[11px] font-bold">
            k
          </span>
          <span>keynv</span>
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
