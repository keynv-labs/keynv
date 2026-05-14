import { type AuditEntry, AuditTimeline } from '@/components/audit/audit-timeline';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api';

interface AuditResponse {
  entries: AuditEntry[];
  next_cursor: number | null;
}

interface Project {
  id: string;
  name: string;
}

export default async function GlobalAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ event_type?: string; limit?: string; project_id?: string }>;
}) {
  const sp = await searchParams;
  const [audit, projectsData] = await Promise.all([
    api<AuditResponse>('/v1/audit', {
      query: {
        event_type: sp.event_type,
        project_id: sp.project_id,
        limit: sp.limit ?? 20,
      },
    }),
    api<{ projects: Project[] }>('/v1/projects').catch(() => ({ projects: [] })),
  ]);

  return (
    <div className="space-y-7">
      <Breadcrumb segments={[{ label: 'Audit log' }]} />

      <PageHeader
        eyebrow="audit"
        title="Audit log"
        description="Every operation, hash-chained."
      />

      <AuditTimeline
        entries={audit.entries}
        nextCursor={audit.next_cursor}
        projects={projectsData.projects}
        initialProject={sp.project_id ?? null}
      />
    </div>
  );
}
