/** 错误态：可恢复——给出重试按钮与失败原因。 */
interface ErrorPanelProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
}

export default function ErrorPanel({ title = '操作未完成', message, code, onRetry }: ErrorPanelProps) {
  return (
    <div className="border border-engineering/60 bg-[var(--red-wash)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-[13px] tracking-tight text-engineering">{title}</p>
        {code ? <span className="num text-[10px] text-engineering/80">{code}</span> : null}
      </div>
      <p className="mt-1 text-[12px] leading-5 text-ink/80">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-danger mt-3" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  );
}
