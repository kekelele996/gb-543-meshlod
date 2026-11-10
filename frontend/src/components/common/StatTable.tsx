/** 可配置列的统计表：数值列右对齐并强制 tabular-nums。 */
import type { ReactNode } from 'react';

export interface StatColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  mono?: boolean;
  width?: string;
  render?: (row: T, index: number) => ReactNode;
}

interface StatTableProps<T> {
  columns: StatColumn<T>[];
  rows: T[];
  rowHeight?: number;
  getRowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  highlightIndex?: number;
  emptyText?: string;
}

export default function StatTable<T>({
  columns,
  rows,
  rowHeight = 36,
  getRowKey,
  onRowClick,
  highlightIndex,
  emptyText = '暂无数据',
}: StatTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b rule-line">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ width: column.width }}
                className={`label whitespace-nowrap pb-1.5 font-normal ${
                  column.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-6 text-center text-[12px] text-ink/50">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={getRowKey ? getRowKey(row, index) : index}
                onClick={() => onRowClick?.(row)}
                style={{ height: rowHeight }}
                className={`border-b hairline ${
                  onRowClick ? 'cursor-pointer hover:bg-paper-2' : ''
                } ${highlightIndex === index ? 'bg-[var(--blue-wash)]' : ''}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`${column.align === 'right' ? 'text-right' : 'text-left'} ${
                      column.mono ? 'num' : ''
                    } px-1`}
                  >
                    {column.render ? column.render(row, index) : String((row as Record<string, unknown>)[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
