import { Breadcrumb } from '@/components/layout/breadcrumb';
import { CreateProjectForm } from './form';

export default function NewProjectPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <Breadcrumb segments={[{ label: 'Projects', href: '/projects' }, { label: 'New project' }]} />

      <header>
        <h1 className="text-[22px] font-semibold tracking-tight">New project</h1>
        <p className="text-sm text-fg-muted mt-1">
          A project is a namespace for secrets. Each environment in the project gets its own
          encrypted DEK.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-bg-elevated p-5">
        <CreateProjectForm />
      </div>
    </div>
  );
}
