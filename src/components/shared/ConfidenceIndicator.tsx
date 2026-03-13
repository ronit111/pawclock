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
  size = 'sm',
}: ConfidenceIndicatorProps) {
  const pct = Math.max(0, Math.min(1, confidence));
  const color = getColor(pct);
  const label = getLabel(pct);
  const isSmall = size === 'sm';

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
      style={{ background: 'rgba(127,100,76,0.06)' }}
      role="status"
      aria-label={`Model confidence: ${label}, ${Math.round(pct * 100)}%`}
    >
      <div
        className="shrink-0 rounded-full"
        style={{
          width: isSmall ? 6 : 8,
          height: isSmall ? 6 : 8,
          background: color,
        }}
      />
      <span className="text-xs font-semibold" style={{ color }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
});

export default ConfidenceIndicator;
