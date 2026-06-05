import { useState, useRef, useCallback } from 'react';
import { ItemData } from '../types';

const DDRAGON_VERSION = '16.11.1';
const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

function itemImageUrl(id: number) {
  return `${DDRAGON_BASE}/cdn/${DDRAGON_VERSION}/img/item/${id}.png`;
}

type TooltipState = {
  item: ItemData;
  x: number;
  y: number;
};

type Props = {
  itemId: number;
  itemMap: Map<number, ItemData>;
};

export default function ItemTooltip({ itemId, itemMap }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgErr, setImgErr] = useState(false);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const item = itemMap.get(itemId);
      if (!item) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      setTooltip({ item, x: rect.left, y: rect.top });
    },
    [itemId, itemMap],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const src = itemImageUrl(itemId);

  return (
    <div
      ref={containerRef}
      className="item-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {imgErr ? (
        <div className="pd-item-icon img-placeholder">?</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Item ${itemId}`}
          className="pd-item-icon"
          onError={() => setImgErr(true)}
        />
      )}

      {tooltip && (
        <div
          className="item-tooltip"
          style={{
            '--tooltip-anchor-x': `${tooltip.x}px`,
            '--tooltip-anchor-y': `${tooltip.y}px`,
          } as React.CSSProperties}
        >
          {/* Header */}
          <div className="it-header">
            {!imgErr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={tooltip.item.name} className="it-icon" onError={() => {}} />
            )}
            <span className="it-name">{tooltip.item.name}</span>
          </div>

          {/* Stats */}
          {tooltip.item.stats && tooltip.item.stats.length > 0 && (
            <ul className="it-stats">
              {tooltip.item.stats.map((s) => (
                <li key={s.label}>
                  <span className="it-stat-value">{s.value}</span>
                  <span className="it-stat-label"> {s.label}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Description */}
          {tooltip.item.description && (
            <p className="it-description">{tooltip.item.description}</p>
          )}
        </div>
      )}
    </div>
  );
}
