import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { type RouteTab, RouteTabs } from '@/components/ui/route-tabs';
import type { ReactNode } from 'react';

export default function AccountLayout({ children }: { children: ReactNode }) {
  const tabs: RouteTab[] = [
    { href: '/settings/account', label: 'Profile' },
    { href: '/settings/account/cli-tokens', label: 'CLI tokens', nested: true },
    { href: '/settings/org', label: 'Organization' },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb segments={[{ label: 'Settings' }, { label: 'Account' }]} />

      <PageHeader eyebrow="workspace · account" title="Account" />

      <RouteTabs tabs={tabs} />

      <div>{children}</div>
    </div>
  );
}
