import type { ReactNode } from 'react';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { type RouteTab, RouteTabs } from '@/components/ui/route-tabs';

export default function AccountLayout({ children }: { children: ReactNode }) {
  const tabs: RouteTab[] = [
    { href: '/settings/account', label: 'Profile' },
    { href: '/settings/account/cli-tokens', label: 'CLI tokens', nested: true },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb segments={[{ label: 'Settings' }, { label: 'Account' }]} />
        <header className="mt-3">
          <h1 className="text-[22px] font-semibold tracking-tight">Account</h1>
        </header>
      </div>

      <RouteTabs tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
