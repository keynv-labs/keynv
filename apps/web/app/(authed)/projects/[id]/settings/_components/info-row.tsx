export function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-fg ${mono ? 'font-mono tabular text-[13px]' : ''} break-all`}
      >
        {value}
      </dd>
    </div>
  );
}
