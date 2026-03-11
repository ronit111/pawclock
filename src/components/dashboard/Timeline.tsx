import { memo, useRef, useEffect, useMemo } from 'react';
import type { PetPrediction, PetEvent, EventType, CyclePrediction } from '../../types';

interface TimelineProps {
  prediction: PetPrediction;
  events: PetEvent[];
  visibleTypes: Set<EventType>;
  currentTime?: Date;
}

// Layout
const HOURS_SHOWN = 24;
const PX_PER_HOUR = 72;
const TIMELINE_HEIGHT = HOURS_SHOWN * PX_PER_HOUR;
const LEFT_GUTTER = 48;
const RIGHT_PAD = 12;
const BINS = 288;
const BIN_DURATION_MS = 5 * 60_000;

interface Lane {
  type: EventType;
  label: string;
  cssColor: string;
  rgb: string;
  glowRgb: string;
}

const LANES: Lane[] = [
  { type: 'sleep_start', label: 'Sleep', cssColor: 'var(--color-sleep)', rgb: '91,138,138', glowRgb: '91,138,138' },
  { type: 'pee', label: 'Pee', cssColor: 'var(--color-pee)', rgb: '212,168,67', glowRgb: '232,168,73' },
  { type: 'poop', label: 'Poop', cssColor: 'var(--color-poop)', rgb: '139,107,74', glowRgb: '160,120,80' },
];

function hourToY(hour: number): number {
  return hour * PX_PER_HOUR;
}

/**
 * Renders the actual probability density as a continuous river of color.
 * Each 5-min bin maps to a horizontal stripe whose opacity = density value.
 * A wider, blurred "glow" layer sits behind for organic softness.
 */
function DensityRiver({
  prediction,
  dayStartMs,
  laneX,
  laneWidth,
  rgb,
  glowRgb,
  filterId,
}: {
  prediction: CyclePrediction;
  dayStartMs: number;
  laneX: number;
  laneWidth: number;
  rgb: string;
  glowRgb: string;
  filterId: string;
}) {
  const density = prediction.density.density;
  const startMs = prediction.density.startTime;

  // Find max density for normalization
  let maxDensity = 0;
  for (let i = 0; i < density.length; i++) {
    if (density[i] > maxDensity) maxDensity = density[i];
  }
  if (maxDensity === 0) return null;

  // Build path data for the density shape — a filled area chart
  // Left edge follows the lane left boundary, right edge follows density curve
  const binH = TIMELINE_HEIGHT / BINS;
  const maxExtend = laneWidth * 0.85; // max width of density fill

  // Create smooth density curve using the centerline
  const centerX = laneX + laneWidth / 2;
  const points: Array<{ y: number; halfW: number; opacity: number }> = [];

  for (let i = 0; i < BINS; i++) {
    const binTime = startMs + i * BIN_DURATION_MS;
    const hourOffset = (binTime - dayStartMs) / 3_600_000;
    if (hourOffset < 0 || hourOffset >= 24) continue;

    const y = hourToY(hourOffset);
    const normalizedDensity = density[i] / maxDensity;

    // Apply a power curve for more contrast — makes peaks punchier
    const intensity = Math.pow(normalizedDensity, 0.7);
    const halfW = (intensity * maxExtend) / 2;
    const opacity = intensity * 0.55;

    points.push({ y, halfW, opacity });
  }

  if (points.length === 0) return null;

  // Build SVG path for the glow (outer) shape
  const glowPathRight: string[] = [];
  const glowPathLeft: string[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const glowHalfW = p.halfW * 1.6 + 8; // wider for glow
    const x = centerX + glowHalfW;
    glowPathRight.push(i === 0 ? `M${x},${p.y}` : `L${x},${p.y}`);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    const glowHalfW = p.halfW * 1.6 + 8;
    const x = centerX - glowHalfW;
    glowPathLeft.push(`L${x},${p.y}`);
  }
  glowPathLeft.push('Z');
  const glowPath = glowPathRight.join(' ') + ' ' + glowPathLeft.join(' ');

  // Build SVG path for the core (sharp) shape
  const corePathRight: string[] = [];
  const corePathLeft: string[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = centerX + p.halfW;
    corePathRight.push(i === 0 ? `M${x},${p.y}` : `L${x},${p.y}`);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    const x = centerX - p.halfW;
    corePathLeft.push(`L${x},${p.y}`);
  }
  corePathLeft.push('Z');
  const corePath = corePathRight.join(' ') + ' ' + corePathLeft.join(' ');

  // Build gradient stops from density peaks
  const gradientStops: Array<{ offset: number; opacity: number }> = [];
  const step = Math.max(1, Math.floor(points.length / 60));
  for (let i = 0; i < points.length; i += step) {
    const frac = points[i].y / TIMELINE_HEIGHT;
    gradientStops.push({ offset: frac * 100, opacity: points[i].opacity });
  }

  const gradId = `density-grad-${rgb.replace(/,/g, '')}`;

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          {gradientStops.map((s, i) => (
            <stop
              key={i}
              offset={`${s.offset}%`}
              stopColor={`rgb(${rgb})`}
              stopOpacity={s.opacity}
            />
          ))}
        </linearGradient>
      </defs>

      {/* Outer glow layer — wide, heavily blurred */}
      <path
        d={glowPath}
        fill={`rgba(${glowRgb}, 0.12)`}
        filter={`url(#${filterId})`}
      />

      {/* Core density shape with gradient opacity */}
      <path
        d={corePath}
        fill={`url(#${gradId})`}
        opacity={0.85}
      />

      {/* Inner bright core — narrower, brighter at peaks */}
      <path
        d={corePath}
        fill={`rgba(${rgb}, 0.08)`}
        style={{ transform: `scaleX(0.5)`, transformOrigin: `${centerX}px 0px` }}
      />
    </g>
  );
}

/** Logged event dot with subtle pulse ring */
function EventDot({
  ts,
  dayStartMs,
  laneX,
  laneWidth,
  color,
}: {
  ts: number;
  dayStartMs: number;
  laneX: number;
  laneWidth: number;
  color: string;
}) {
  const hour = (ts - dayStartMs) / 3_600_000;
  const y = hourToY(hour);
  const cx = laneX + laneWidth / 2;

  return (
    <g aria-hidden="true">
      {/* Outer ring */}
      <circle cx={cx} cy={y} r={8} fill="none" stroke={color} strokeWidth={0.5} opacity={0.3} />
      {/* Core dot */}
      <circle cx={cx} cy={y} r={4} fill={color} />
      {/* Inner highlight */}
      <circle cx={cx - 1} cy={y - 1} r={1.5} fill="rgba(255,255,255,0.3)" />
    </g>
  );
}

/** Prediction window label */
function WindowLabel({
  window: w,
  dayStartMs,
  laneX,
  laneWidth,
  color,
}: {
  window: { startTime: number; endTime: number; confidence: number; peakTime: number };
  dayStartMs: number;
  laneX: number;
  laneWidth: number;
  color: string;
}) {
  const peakHour = (w.peakTime - dayStartMs) / 3_600_000;
  const y = hourToY(peakHour);
  const x = laneX + laneWidth + 6;
  const conf = Math.round(w.confidence * 100);

  // Only show label for windows with decent confidence
  if (conf < 30) return null;

  return (
    <text
      x={x}
      y={y + 3}
      fontSize={8}
      fill={color}
      fontFamily="var(--font-body)"
      opacity={0.5}
      aria-hidden="true"
    >
      ~{conf}%
    </text>
  );
}

const Timeline = memo(function Timeline({
  prediction,
  events,
  visibleTypes,
  currentTime = new Date(),
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayStart = useMemo(() => {
    const d = new Date(currentTime);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [currentTime]);

  const currentHour = (currentTime.getTime() - dayStart) / 3_600_000;
  const nowY = hourToY(currentHour);

  useEffect(() => {
    if (scrollRef.current) {
      const containerH = scrollRef.current.clientHeight;
      scrollRef.current.scrollTop = Math.max(0, nowY - containerH * 0.35);
    }
  }, [nowY]);

  const svgWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth, 430) : 390;
  const lanesAreaWidth = svgWidth - LEFT_GUTTER - RIGHT_PAD;
  const laneWidth = Math.floor(lanesAreaWidth / LANES.length) - 6;

  function getLaneX(i: number): number {
    return LEFT_GUTTER + i * (laneWidth + 6);
  }

  // Map event types to predictions
  function getCyclePrediction(type: EventType): CyclePrediction {
    if (type === 'sleep_start') return prediction.sleepStart;
    if (type === 'pee') return prediction.pee;
    return prediction.poop;
  }

  const todayEvents = useMemo(
    () => events.filter((e) => e.timestamp >= dayStart && e.timestamp < dayStart + 86_400_000),
    [events, dayStart],
  );

  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div
      className="flex flex-col"
      style={{ background: 'var(--color-surface-raised)', borderRadius: '16px', overflow: 'hidden' }}
    >
      {/* Lane headers */}
      <div
        className="flex"
        style={{ paddingLeft: LEFT_GUTTER, paddingTop: 10, paddingBottom: 6, borderBottom: '1px solid rgba(245,240,232,0.04)' }}
      >
        {LANES.map((lane, i) => (
          <div
            key={lane.type}
            className="text-center text-[9px] font-semibold uppercase tracking-[0.15em]"
            style={{
              width: laneWidth,
              marginLeft: i === 0 ? 0 : 6,
              color: visibleTypes.has(lane.type) ? lane.cssColor : 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
              opacity: visibleTypes.has(lane.type) ? 0.7 : 0.3,
            }}
          >
            {lane.label}
          </div>
        ))}
      </div>

      {/* Scrollable timeline */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ height: 420, WebkitOverflowScrolling: 'touch' as never }}
        role="img"
        aria-label="24-hour probability timeline"
      >
        <svg
          width={svgWidth}
          height={TIMELINE_HEIGHT}
          viewBox={`0 0 ${svgWidth} ${TIMELINE_HEIGHT}`}
          style={{ display: 'block' }}
        >
          {/* Shared filters */}
          <defs>
            <filter id="glow-soft" x="-50%" y="-2%" width="200%" height="104%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <filter id="glow-medium" x="-30%" y="-1%" width="160%" height="102%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* Hour grid */}
          {hours.map((h) => {
            if (h >= 24) return null;
            const y = hourToY(h);
            const label = h === 0 ? '12 AM'
              : h < 12 ? `${h} AM`
              : h === 12 ? '12 PM'
              : `${h - 12} PM`;

            return (
              <g key={h} aria-hidden="true">
                <line
                  x1={LEFT_GUTTER}
                  y1={y}
                  x2={svgWidth}
                  y2={y}
                  stroke="rgba(245,240,232,0.04)"
                  strokeWidth={0.5}
                />
                <text
                  x={LEFT_GUTTER - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--color-text-muted)"
                  fontFamily="var(--font-body)"
                  opacity={0.6}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Density rivers — the main visualization */}
          {LANES.map((lane, i) => {
            if (!visibleTypes.has(lane.type)) return null;
            const cyclePred = getCyclePrediction(lane.type);
            return (
              <DensityRiver
                key={lane.type}
                prediction={cyclePred}
                dayStartMs={dayStart}
                laneX={getLaneX(i)}
                laneWidth={laneWidth}
                rgb={lane.rgb}
                glowRgb={lane.glowRgb}
                filterId="glow-soft"
              />
            );
          })}

          {/* Window confidence labels */}
          {LANES.map((lane, i) => {
            if (!visibleTypes.has(lane.type)) return null;
            const cyclePred = getCyclePrediction(lane.type);
            return cyclePred.windows.map((w, wi) => (
              <WindowLabel
                key={`${lane.type}-label-${wi}`}
                window={w}
                dayStartMs={dayStart}
                laneX={getLaneX(i)}
                laneWidth={laneWidth}
                color={lane.cssColor}
              />
            ));
          })}

          {/* Logged event dots */}
          {todayEvents.map((evt) => {
            const lane = LANES.find(
              (l) => l.type === evt.type || (l.type === 'sleep_start' && (evt.type === 'sleep_start' || evt.type === 'sleep_end')),
            );
            if (!lane || !visibleTypes.has(lane.type)) return null;
            return (
              <EventDot
                key={evt.id}
                ts={evt.timestamp}
                dayStartMs={dayStart}
                laneX={getLaneX(LANES.indexOf(lane))}
                laneWidth={laneWidth}
                color={lane.cssColor}
              />
            );
          })}

          {/* NOW indicator */}
          <g aria-hidden="true">
            {/* Ambient glow behind the line */}
            <line
              x1={LEFT_GUTTER}
              y1={nowY}
              x2={svgWidth}
              y2={nowY}
              stroke="var(--color-accent)"
              strokeWidth={6}
              opacity={0.1}
              filter="url(#glow-medium)"
            />
            {/* Sharp line */}
            <line
              x1={LEFT_GUTTER - 4}
              y1={nowY}
              x2={svgWidth}
              y2={nowY}
              stroke="var(--color-accent)"
              strokeWidth={1}
              opacity={0.8}
            />
            {/* Diamond marker */}
            <polygon
              points={`${LEFT_GUTTER - 4},${nowY} ${LEFT_GUTTER - 10},${nowY - 4} ${LEFT_GUTTER - 16},${nowY} ${LEFT_GUTTER - 10},${nowY + 4}`}
              fill="var(--color-accent)"
            />
            <text
              x={LEFT_GUTTER - 20}
              y={nowY - 8}
              textAnchor="end"
              fontSize={8}
              fill="var(--color-accent)"
              fontFamily="var(--font-body)"
              fontWeight="700"
              letterSpacing="0.08em"
              opacity={0.9}
            >
              NOW
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
});

export default Timeline;
