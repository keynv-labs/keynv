import { SectionHeader } from '@/components/layout/page-header';
import { ArrowUpRight, KeyRound, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  return (
    <div>
      <SectionHeader title="quick actions" />
      <div className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
        <ActionLink
          href="/projects/new"
          icon={<Plus size={14} strokeWidth={2.25} className="text-accent" />}
          title="New project"
          subtitle="Spin up a new namespace"
        />
        <ActionLink
          href="/audit"
          icon={<ShieldCheck size={14} strokeWidth={2} className="text-success" />}
          title="Verify audit chain"
          subtitle="Recompute hash integrity"
        />
        <ActionLink
          href="/settings/account/cli-tokens"
          icon={<KeyRound size={14} strokeWidth={2} className="text-fg-muted" />}
          title="Issue CLI token"
          subtitle="For headless agents and CI"
        />
      </div>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap"
    >
      <span
        aria-hidden
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-inset"
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-fg truncate">{title}</div>
        <div className="mt-0.5 text-[11px] text-fg-subtle">{subtitle}</div>
      </div>
      <ArrowUpRight
        size={13}
        strokeWidth={2}
        className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors"
      />
    </Link>
  );
}
