import { Breadcrumb } from '@/components/layout/breadcrumb';
import { PageHeader } from '@/components/layout/page-header';
import { CreateProjectForm } from './form';

export default function NewProjectPage() {
  return (
    <div className="space-y-7 max-w-xl">
      <Breadcrumb segments={[{ label: 'Projects', href: '/projects' }, { label: 'New project' }]} />

      <PageHeader
        eyebrow="vault · provision"
        title="New project"
        description="A project is a namespace for secrets. Each environment in the project gets its own encrypted DEK."
      />

      <div className="rounded-xl border border-border bg-bg-elevated p-6">
        <CreateProjectForm />
      </div>
    </div>
  );
}
