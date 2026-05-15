'use client';

import { Logomark } from '@/components/brand/logomark';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SidebarContent } from './sidebar';

interface Props {
  email: string;
  role: string;
  orgId: string;
  activeOrgId: string;
  activeOrgName: string;
  orgs: Array<{ id: string; name: string }>;
}

export function MobileTopBar({ email, role, orgId, activeOrgId, activeOrgName, orgs }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on path change is the intent
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-3 border-b border-border bg-bg-elevated/80 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
        >
          <Menu size={18} strokeWidth={2} />
        </button>
        <Link href={{ pathname: '/dashboard' }} className="flex items-center">
          <Logomark size={22} />
        </Link>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent
            email={email}
            role={role}
            orgId={orgId}
            activeOrgId={activeOrgId}
            activeOrgName={activeOrgName}
            orgs={orgs}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
