/** 右侧检查器：图纸标注式（小号标签 + 数值 + 细横线）。 */
import type { ReactNode } from 'react';

interface InspectorPanelProps {
  children: ReactNode;
  width?: number;
}

export default function InspectorPanel({ children, width = 348 }: InspectorPanelProps) {
  return (
    <aside
      className="h-full shrink-0 overflow-y-auto border-l rule-line bg-paper"
      style={{ width }}
    >
      <div className="flex flex-col gap-5 px-5 py-4">{children}</div>
    </aside>
  );
}

export function InspectorSection({
  title,
  hint,
  children,
  className = '',
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 border-b rule-line pb-1">
        <h2 className="label whitespace-nowrap">{title}</h2>
        {hint ? <span className="num max-w-[62%] truncate text-right text-[9px] text-ink/40">{hint}</span> : null}
      </div>
      <div className="pt-2">{children}</div>
    </section>
  );
}

export function InspectorRow({
  label,
  value,
  mono = true,
  tone,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: 'error' | 'warn' | 'blue';
}) {
  const toneClass =
    tone === 'error' ? 'text-engineering' : tone === 'warn' ? 'text-[var(--amber)]' : tone === 'blue' ? 'text-blueprint' : '';
  return (
    <div className="flex items-baseline justify-between gap-3 border-b hairline py-1.5">
      <span className="text-[11px] text-ink/55">{label}</span>
      <span className={`${mono ? 'num' : ''} text-[12px] ${toneClass}`}>{value}</span>
    </div>
  );
}
