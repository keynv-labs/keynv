export function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
