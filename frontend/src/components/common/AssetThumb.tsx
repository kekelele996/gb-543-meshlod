/** 缩略图 + 名称 + 三角面数；/runs 使用 compact 模式。 */
import { useEffect, useState } from 'react';
import { assetThumbUrl } from '../../api/assets';
import { readToken } from '../../utils/request';
import { compactNumber } from '../../utils/formatNumber';
import type { MeshAsset } from '../../types/meshAsset';

const blobCache = new Map<string, string>();

interface AssetThumbProps {
  asset: Pick<MeshAsset, 'id' | 'name' | 'triangle_count' | 'source_format'>;
  compact?: boolean;
  size?: number;
}

export default function AssetThumb({ asset, compact = false, size = 56 }: AssetThumbProps) {
  const [src, setSrc] = useState<string | null>(() => blobCache.get(asset.id) ?? null);

  useEffect(() => {
    if (blobCache.has(asset.id)) {
      setSrc(blobCache.get(asset.id) ?? null);
      return;
    }
    let cancelled = false;
    const token = readToken();
    fetch(assetThumbUrl(asset.id), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('thumb'))))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        blobCache.set(asset.id, url);
        if (!cancelled) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <div
        className="relative flex shrink-0 items-center justify-center border hairline bg-paper"
        style={{ width: size, height: size * 0.75 }}
      >
        {src ? (
          <img src={src} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <span className="num text-[9px] uppercase text-ink/40">{asset.source_format}</span>
        )}
        <span className="absolute bottom-0 left-0 h-[1px] w-3 bg-rule" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] leading-tight" title={asset.name}>
          {asset.name}
        </p>
        <p className="num text-[10px] text-ink/55">
          {compactNumber(asset.triangle_count)} tris · {asset.source_format.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
