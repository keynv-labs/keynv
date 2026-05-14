'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadMoreButton } from '@/components/ui/load-more-button';
import { formatRelative } from '@/lib/time';
import { Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { loadMoreUsersAction } from '../_actions/actions';
import { InviteUserDialog } from './invite-dialog';
import { UserRowMenu } from './user-row-menu';

interface OrgUser {
  id: string;
  email: string;
  org_role: string;
  created_at: string;
}

const roleTone = (role: string) => {
  if (role === 'owner') return 'accent' as const;
  if (role === 'admin') return 'success' as const;
  if (role === 'reader') return 'neutral' as const;
  return 'neutral' as const;
};

export function UsersClient({
  users: initialUsers,
  nextCursor: initialCursor,
  currentUserId,
  orgs,
  activeOrgId,
}: {
  users: OrgUser[];
  nextCursor: string | null;
  currentUserId: string;
  orgs: Array<{ id: string; name: string }>;
  activeOrgId: string;
}) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<OrgUser[]>(initialUsers);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadMoreUsersAction(cursor);
      setUsers((prev) => [...prev, ...result.users]);
      setCursor(result.next_cursor);
    } catch {
      // silent fail
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.org_role.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by email or role…"
            className="pl-8"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            <span className="text-fg tabular">{filtered.length}</span> of{' '}
            <span className="tabular">{users.length}</span>
          </span>
          <InviteUserDialog orgs={orgs} activeOrgId={activeOrgId} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center text-sm text-fg-muted">
          {users.length === 0 ? 'No users yet.' : 'No users match that filter.'}
        </div>
      ) : (
        <ul className="rounded-lg border border-border bg-bg-elevated divide-y divide-border overflow-hidden">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated-hover transition-colors duration-fast ease-snap animate-list-enter"
            >
              <span
                aria-hidden
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-strong bg-bg-inset font-mono text-[12px] font-semibold text-fg"
              >
                {u.email.slice(0, 2).toUpperCase()}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg truncate">
                  {u.email}
                  {u.id === currentUserId ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                      · you
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-fg-subtle mt-0.5 font-mono tabular">
                  joined {formatRelative(u.created_at)}
                </div>
              </div>

              <Badge tone={roleTone(u.org_role)}>{u.org_role}</Badge>

              <UserRowMenu user={u} disabled={u.id === currentUserId || u.org_role === 'owner'} />
            </li>
          ))}
        </ul>
      )}

      {cursor !== null && !search ? (
        <LoadMoreButton loading={loadingMore} onClick={loadMore} />
      ) : null}
    </div>
  );
}


