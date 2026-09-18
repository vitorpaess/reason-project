import type { ReactNode } from "react";

export function StatCard({
  label,
  children,
  detail,
}: {
  label: string;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-2">{children}</div>
      {detail && <div className="mt-2 text-sm leading-snug text-ink-secondary">{detail}</div>}
    </div>
  );
}
