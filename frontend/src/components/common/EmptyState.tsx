/** 空态：必须带下一步动作链接（不做图标堆叠）。 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  actions?: ReactNode;
  hint?: string;
}

export default function EmptyState({ title, description, actions, hint }: EmptyStateProps) {
  return (
    <div className="relative border rule-line bg-paper px-8 py-10">
      <span className="absolute -top-[1px] left-0 h-[1px] w-16 bg-ink/70" />
      <p className="label">EMPTY / 下一步</p>
      <h3 className="mt-2 font-display text-[clamp(1.5rem,2.2vw,2.25rem)] font-bold leading-none tracking-tight">
        {title}
      </h3>
      <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink/75">{description}</p>
      {hint ? <p className="num mt-2 text-[11px] text-ink/50">{hint}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
