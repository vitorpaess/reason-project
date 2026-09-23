export function StatusPill({
  label,
  color,
  title,
}: {
  label: string;
  color: string;
  /** Tooltip nativo (hover) — usado quando o rótulo sozinho não deixa claro
   * o que o selo mede (ex: sobre qual janela de tempo). */
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
