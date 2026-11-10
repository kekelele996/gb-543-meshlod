/** LOD 阶梯：纵向排列，每级一行（级号 / 比例 / 三角面 / SSE）；切换 120ms debounce。 */
import { useEffect, useRef } from 'react';
import type { LodLevel } from '../../types/lodLevel';
import { compactNumber, formatSse } from '../../utils/formatNumber';

interface LodSliderProps {
  levels: LodLevel[];
  value: number;
  onChange: (levelIndex: number) => void;
  baseFaces?: number;
  debounceMs?: number;
}

export default function LodSlider({ levels, value, onChange, baseFaces, debounceMs = 120 }: LodSliderProps) {
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const select = (index: number) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(index), debounceMs);
  };

  if (!levels.length) {
    return <p className="text-[11px] text-ink/50">尚无 LOD 层级</p>;
  }

  return (
    <div>
      <ul className="border-t hairline">
        {levels.map((level) => {
          const active = level.level_index === value;
          const reduction = baseFaces ? Math.max(0, 1 - level.triangle_count / baseFaces) : level.reduction_pct / 100;
          return (
            <li key={level.id}>
              <button
                type="button"
                onClick={() => select(level.level_index)}
                className={`flex w-full items-baseline gap-3 border-b hairline px-1 py-2 text-left transition-colors duration-150 ease-draw hover:bg-paper ${
                  active ? 'bg-[var(--blue-wash)]' : ''
                }`}
              >
                <span className={`num w-7 text-[11px] ${active ? 'text-blueprint' : 'text-ink/60'}`}>
                  L{level.level_index}
                </span>
                <span className="num w-10 text-[11px] text-ink/80">{Math.round(level.ratio * 100)}%</span>
                <span className="num flex-1 text-right text-[11px]">{compactNumber(level.triangle_count)}</span>
                <span className="num w-14 text-right text-[11px] text-ink/70">
                  {formatSse(level.screen_space_error)}px
                </span>
                <span className="num w-12 text-right text-[10px] text-ink/45">
                  -{Math.round(reduction * 100)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2 md:hidden">
        <span className="num text-[10px] text-ink/50">L{value}</span>
        <input
          type="range"
          min={0}
          max={Math.max(levels.length - 1, 0)}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="flex-1 accent-[var(--blue)]"
        />
      </div>
    </div>
  );
}
