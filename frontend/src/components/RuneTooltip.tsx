import { useState, useCallback } from 'react';
import { ResolvedRune } from '../types';

type Props = {
  rune: ResolvedRune;
  className?: string;
  small?: boolean;
};

export default function RuneTooltip({ rune, className, small }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const [imgErr, setImgErr] = useState(false);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    setTooltip({ x: rect.left, y: rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div
      className="item-tooltip-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {imgErr ? (
        <div className={`img-placeholder ${className ?? ''}`}>{rune.name[0]}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rune.iconUrl}
          alt={rune.name}
          className={className}
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
          <div className="it-header">
            {!imgErr && !small && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rune.iconUrl} alt={rune.name} className="it-icon" onError={() => {}} />
            )}
            <span className="it-name">{rune.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}
