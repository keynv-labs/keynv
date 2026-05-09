import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { Users } from 'lucide-react';
import { AddMemberDialog, RemoveMemberAction } from './forms';

interface Member {
  user_id: string;
  email: string;
  role: string;
  granted_at: string;
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const roleTone = (role: string): 'success' | 'warn' | 'neutral' => {
  if (role === 'lead') return 'warn';
  if (role === 'reader') return 'neutral';
  return 'success';
};

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { members } = await api<{ members: Member[] }>(`/v1/projects/${id}/members`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <AddMemberDialog projectId={id} />
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center">
          <Users size={20} className="mx-auto mb-3 text-fg-subtle" strokeWidth={1.75} aria-hidden />
          <p className="text-sm text-fg-muted">No members on this project yet.</p>
          <p className="text-xs text-fg-subtle mt-1">
            Add a teammate to grant them access. Roles control what they can read or write.
          </p>
        </div>
      ) : (
        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
            >
              <span
                aria-hidden
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-elevated-hover text-[12px] font-semibold text-fg"
              >
                {m.email.slice(0, 2).toUpperCase()}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg truncate">{m.email}</div>
                <div className="text-[11px] text-fg-subtle mt-0.5">
                  Joined {formatRelative(m.granted_at)}
                </div>
              </div>

              <Badge tone={roleTone(m.role)}>{m.role}</Badge>

              <RemoveMemberAction projectId={id} userId={m.user_id} email={m.email} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
