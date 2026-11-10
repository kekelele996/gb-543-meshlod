/** 48px 工具条：资产名 + checksum 短哈希 + 主操作（每屏最多一个实心 primary）。 */
import type { ReactNode } from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: ReactNode;
  breadcrumb?: string;
}

export default function TopBar({ title, subtitle, meta, actions, breadcrumb }: TopBarProps) {
  return (
    <header
      className="flex shrink-0 items-center justify-between gap-4 border-b rule-line bg-paper px-5"
      style={{ height: 'var(--toolbar-h)' }}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        {breadcrumb ? (
          <span className="num text-[10px] uppercase tracking-[0.16em] text-ink/40">{breadcrumb}</span>
        ) : null}
        <h1 className="truncate font-display text-[15px] font-bold leading-none tracking-tight">{title}</h1>
        {subtitle ? <span className="truncate text-[11px] text-ink/55">{subtitle}</span> : null}
        {meta ? <span className="num hidden text-[10px] text-ink/40 lg:inline">{meta}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}
