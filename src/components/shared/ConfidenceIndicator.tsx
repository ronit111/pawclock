import { memo } from 'react';

interface ConfidenceIndicatorProps {
  /** 0 to 1 confidence value */
  confidence: number;
  /** Days of data the model has learned from */
  effectiveDays?: number;
  size?: 'sm' | 'md';
}

function getLabel(confidence: number): string {
  if (confidence < 0.3) return 'Learning...';
  if (confidence < 0.7) return 'Getting better';
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
  const isSm = size === 'sm';
  const radius = isSm ? 14 : 20;
  const stroke = isSm ? 2.5 : 3;
  const svgSize = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);
  const color = getColor(pct);
  const label = getLabel(pct);

  return (
    <div
      className="flex items-center gap-2"
      role="status"
      aria-label={`Model confidence: ${label}, ${Math.round(pct * 100)}%`}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="rgba(245,240,232,0.08)"
          strokeWidth={stroke}
        />
        {/* Progress */}
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
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.25, 0.1, 0.25, 1)' }}
        />
      </svg>

      <div className="flex flex-col">
        <span
          className="text-xs font-medium"
          style={{ color, fontFamily: 'var(--font-body)' }}
        >
          {label}
        </span>
        {effectiveDays !== undefined && (
          <span
            className="text-[10px]"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
          >
            {effectiveDays < 1 ? 'Just started' : `${Math.round(effectiveDays)}d data`}
          </span>
        )}
      </div>
    </div>
  );
});

export default ConfidenceIndicator;
