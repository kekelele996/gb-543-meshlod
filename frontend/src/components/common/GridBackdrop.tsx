/** 纸蓝底 + 8px 网格线（透明度 ≤ 0.06）+ 四角定位标记。 */
export default function GridBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 grid-backdrop ${className}`} aria-hidden>
      <span className="absolute left-4 top-4 h-3 w-3 border-l border-t rule-line" />
      <span className="absolute right-4 top-4 h-3 w-3 border-r border-t rule-line" />
      <span className="absolute bottom-4 left-4 h-3 w-3 border-b border-l rule-line" />
      <span className="absolute bottom-4 right-4 h-3 w-3 border-b border-r rule-line" />
    </div>
  );
}
