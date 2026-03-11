import { memo } from 'react';

interface ConfidenceIndicatorProps {
  confidence: number;
  effectiveDays?: number;
  size?: 'sm' | 'md';
}

function getLabel(confidence: number): string {
  if (confidence < 0.3) return 'Learning';
  if (confidence < 0.7) return 'Improving';
  return 'Confident';
}

function getColor(confidence: number): string {
  if (confidence < 0.3) return 'var(--color-text-muted)';
  if (confidence < 0.7) return 'var(--color-pee)';
  return 'var(--color-success)';
}

const ConfidenceIndicator = memo(function ConfidenceIndicator({
  confidence,
  effectiveDays,
  size = 'sm',
}: ConfidenceIndicatorProps) {
  const pct = Math.max(0, Math.min(1, confidence));
  const isSmall = size === 'sm';
  const radius = isSmall ? 14 : 19;
  const stroke = isSmall ? 3 : 3.5;
  const svgSize = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const color = getColor(pct);
  const label = getLabel(pct);

  return (
    <div
      className="surface-card-soft flex items-center gap-3 rounded-[18px] px-3 py-2.5"
      role="status"
      aria-label={`Model confidence: ${label}, ${Math.round(pct * 100)}%`}
    >
      <div className="relative shrink-0">
        <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} aria-hidden="true">
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="rgba(127,100,76,0.12)"
            strokeWidth={stroke}
          />
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>
        <div
          className="absolute inset-[7px] rounded-full"
          style={{ background: 'rgba(255,255,255,0.74)' }}
        />
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {effectiveDays !== undefined
            ? effectiveDays < 1
              ? 'Just started'
              : `${Math.round(effectiveDays)}d of data`
            : `${Math.round(pct * 100)}% confidence`}
        </span>
      </div>
    </div>
  );
});

export default ConfidenceIndicator;
