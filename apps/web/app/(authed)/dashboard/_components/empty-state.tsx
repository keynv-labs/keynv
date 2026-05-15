import { NewProjectButton } from '../../projects/new-project-button';

export function FirstRunEmpty() {
  return (
    <div className="relative rounded-xl border border-border bg-bg-elevated p-10 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="relative mx-auto max-w-md text-center">
        <h2 className="display text-xl tracking-tight text-fg">No projects yet</h2>
        <p className="text-sm text-fg-muted mt-3 leading-relaxed">
          Activity shows up here once you create your first project. Each project is a namespace for
          secrets your AI agents will reference by alias.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2">
          <NewProjectButton label="Create first project" />
        </div>
      </div>
    </div>
  );
}
