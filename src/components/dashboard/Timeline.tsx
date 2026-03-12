import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CyclePrediction, EventType, PetEvent, PetPrediction } from '../../types';

interface TimelineProps {
  prediction: PetPrediction;
  events: PetEvent[];
  visibleTypes: Set<EventType>;
  currentTime?: Date;
}

const HOURS_SHOWN = 24;
const PX_PER_HOUR = 68;
const TIMELINE_HEIGHT = HOURS_SHOWN * PX_PER_HOUR;
const LEFT_GUTTER = 52;
const RIGHT_PAD = 18;
const LANE_GAP = 12;
const BINS = 288;
const BIN_DURATION_MS = 5 * 60_000;

interface Lane {
  type: EventType;
  label: string;
  cssColor: string;
  tint: string;
  rgb: string;
  glowRgb: string;
}

const LANES: Lane[] = [
  {
    type: 'sleep_start',
    label: 'Sleep',
    cssColor: 'var(--color-sleep)',
    tint: 'var(--color-sleep-soft)',
    rgb: '110,147,165',
    glowRgb: '110,147,165',
  },
  {
    type: 'pee',
    label: 'Pee',
    cssColor: 'var(--color-pee)',
    tint: 'var(--color-pee-soft)',
    rgb: '217,164,75',
    glowRgb: '217,164,75',
  },
  {
    type: 'poop',
    label: 'Poop',
    cssColor: 'var(--color-poop)',
    tint: 'var(--color-poop-soft)',
    rgb: '145,99,68',
    glowRgb: '145,99,68',
  },
];

function hourToY(hour: number): number {
  return hour * PX_PER_HOUR;
}

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

  let maxDensity = 0;
  for (let index = 0; index < density.length; index += 1) {
    if (density[index] > maxDensity) maxDensity = density[index];
  }
  if (maxDensity === 0) return null;

  const maxExtend = laneWidth * 0.78;
  const centerX = laneX + laneWidth / 2;
  const points: Array<{ y: number; halfW: number; opacity: number }> = [];

  for (let index = 0; index < BINS; index += 1) {
    const binTime = startMs + index * BIN_DURATION_MS;
    const hourOffset = (binTime - dayStartMs) / 3_600_000;
    if (hourOffset < 0 || hourOffset >= 24) continue;

    const y = hourToY(hourOffset);
    const normalized = density[index] / maxDensity;
    const intensity = Math.pow(normalized, 0.72);
    const halfW = (intensity * maxExtend) / 2;
    const opacity = intensity * 0.58;

    points.push({ y, halfW, opacity });
  }

  if (points.length === 0) return null;

  const glowRight: string[] = [];
  const glowLeft: string[] = [];
  const coreRight: string[] = [];
  const coreLeft: string[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const glowHalfW = point.halfW * 1.65 + 8;
    glowRight.push(index === 0 ? `M${centerX + glowHalfW},${point.y}` : `L${centerX + glowHalfW},${point.y}`);
    coreRight.push(index === 0 ? `M${centerX + point.halfW},${point.y}` : `L${centerX + point.halfW},${point.y}`);
  }

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    const glowHalfW = point.halfW * 1.65 + 8;
    glowLeft.push(`L${centerX - glowHalfW},${point.y}`);
    coreLeft.push(`L${centerX - point.halfW},${point.y}`);
  }

  glowLeft.push('Z');
  coreLeft.push('Z');

  const glowPath = `${glowRight.join(' ')} ${glowLeft.join(' ')}`;
  const corePath = `${coreRight.join(' ')} ${coreLeft.join(' ')}`;
  const gradId = `density-grad-${rgb.replace(/,/g, '')}`;
  const step = Math.max(1, Math.floor(points.length / 56));

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          {points.filter((_, index) => index % step === 0).map((point, index) => (
            <stop
              key={index}
              offset={`${(point.y / TIMELINE_HEIGHT) * 100}%`}
              stopColor={`rgb(${rgb})`}
              stopOpacity={point.opacity}
            />
          ))}
        </linearGradient>
      </defs>

      <path d={glowPath} fill={`rgba(${glowRgb}, 0.12)`} filter={`url(#${filterId})`} />
      <path d={corePath} fill={`url(#${gradId})`} opacity={0.88} />
      <path
        d={corePath}
        fill={`rgba(${rgb}, 0.08)`}
        style={{ transform: `scaleX(0.52)`, transformOrigin: `${centerX}px 0px` }}
      />
    </g>
  );
}

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
      <circle cx={cx} cy={y} r={10} fill={color} opacity={0.08} />
      <circle cx={cx} cy={y} r={7} fill="white" opacity={0.92} />
      <circle cx={cx} cy={y} r={4.25} fill={color} />
      <circle cx={cx - 1.2} cy={y - 1.4} r={1.4} fill="rgba(255,255,255,0.78)" />
    </g>
  );
}

function WindowLabel({
  window,
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
  const peakHour = (window.peakTime - dayStartMs) / 3_600_000;
  const y = hourToY(peakHour);
  const label = `${Math.round(window.confidence * 100)}%`;
  const width = label.length * 5.6 + 16;

  if (window.confidence < 0.35) return null;

  return (
    <g aria-hidden="true">
      <rect
        x={laneX + laneWidth - width / 2}
        y={y - 11}
        width={width}
        height={18}
        rx={9}
        fill="rgba(255,255,255,0.88)"
        stroke="rgba(127,100,76,0.12)"
      />
      <text
        x={laneX + laneWidth / 2}
        y={y + 1.5}
        textAnchor="middle"
        fontSize={8.5}
        fill={color}
        fontFamily="var(--font-body)"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
}

const Timeline = memo(function Timeline({
  prediction,
  events,
  visibleTypes,
  currentTime = new Date(),
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const measureWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    measureWidth();
    const observer = new ResizeObserver(measureWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [measureWidth]);

  const dayStart = useMemo(() => {
    const date = new Date(currentTime);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [currentTime]);

  const currentHour = (currentTime.getTime() - dayStart) / 3_600_000;
  const nowY = hourToY(currentHour);

  useEffect(() => {
    if (!scrollRef.current) return;
    const containerHeight = scrollRef.current.clientHeight;
    scrollRef.current.scrollTop = Math.max(0, nowY - containerHeight * 0.35);
  }, [nowY]);

  const svgWidth = containerWidth > 0 ? containerWidth - 16 : 390;
  const lanesAreaWidth = svgWidth - LEFT_GUTTER - RIGHT_PAD - LANE_GAP * (LANES.length - 1);
  const laneWidth = Math.floor(lanesAreaWidth / LANES.length);

  function laneX(index: number): number {
    return LEFT_GUTTER + index * (laneWidth + LANE_GAP);
  }

  function cyclePrediction(type: EventType): CyclePrediction {
    if (type === 'sleep_start') return prediction.sleepStart;
    if (type === 'pee') return prediction.pee;
    return prediction.poop;
  }

  const todayEvents = useMemo(
    () => events.filter((event) => event.timestamp >= dayStart && event.timestamp < dayStart + 86_400_000),
    [events, dayStart],
  );

  const hours = Array.from({ length: 25 }, (_, index) => index);

  return (
    <div ref={containerRef} className="surface-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'rgba(127,100,76,0.08)' }}>
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Probability river
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Scroll through the next 24 hours
          </div>
        </div>
        <div className="info-pill" style={{ color: 'var(--color-accent)' }}>
          {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3">
        {LANES.map((lane) => (
          <div
            key={lane.type}
            className="flex-1 rounded-full px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              background: visibleTypes.has(lane.type) ? lane.tint : 'rgba(255,255,255,0.6)',
              color: visibleTypes.has(lane.type) ? lane.cssColor : 'var(--color-text-muted)',
              opacity: visibleTypes.has(lane.type) ? 1 : 0.7,
            }}
          >
            {lane.label}
          </div>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="hide-scrollbar overflow-y-auto px-2 pb-2"
        style={{ height: 430, WebkitOverflowScrolling: 'touch' as never }}
        role="img"
        aria-label="24-hour probability timeline"
      >
        <svg
          width={svgWidth}
          height={TIMELINE_HEIGHT}
          viewBox={`0 0 ${svgWidth} ${TIMELINE_HEIGHT}`}
          style={{ display: 'block' }}
        >
          <defs>
            <filter id="timeline-glow-soft" x="-50%" y="-2%" width="200%" height="104%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <filter id="timeline-glow-medium" x="-30%" y="-2%" width="160%" height="104%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {LANES.map((lane, index) => (
            <g key={`${lane.type}-bg`} aria-hidden="true">
              <rect
                x={laneX(index)}
                y={0}
                width={laneWidth}
                height={TIMELINE_HEIGHT}
                rx={laneWidth / 2}
                fill={lane.tint}
                opacity={visibleTypes.has(lane.type) ? 0.62 : 0.2}
              />
              <line
                x1={laneX(index) + laneWidth / 2}
                y1={0}
                x2={laneX(index) + laneWidth / 2}
                y2={TIMELINE_HEIGHT}
                stroke="rgba(127,100,76,0.08)"
                strokeDasharray="2 9"
              />
            </g>
          ))}

          {hours.map((hour) => {
            if (hour >= 24) return null;
            const y = hourToY(hour);
            const label = hour === 0 ? '12 AM'
              : hour < 12 ? `${hour} AM`
              : hour === 12 ? '12 PM'
              : `${hour - 12} PM`;

            return (
              <g key={hour} aria-hidden="true">
                <line
                  x1={LEFT_GUTTER}
                  y1={y}
                  x2={svgWidth - RIGHT_PAD / 2}
                  y2={y}
                  stroke="rgba(127,100,76,0.08)"
                  strokeWidth={1}
                />
                <text
                  x={LEFT_GUTTER - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={9.5}
                  fill="var(--color-text-muted)"
                  fontFamily="var(--font-body)"
                  opacity={0.85}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {LANES.map((lane, index) => {
            if (!visibleTypes.has(lane.type)) return null;
            return (
              <DensityRiver
                key={lane.type}
                prediction={cyclePrediction(lane.type)}
                dayStartMs={dayStart}
                laneX={laneX(index)}
                laneWidth={laneWidth}
                rgb={lane.rgb}
                glowRgb={lane.glowRgb}
                filterId="timeline-glow-soft"
              />
            );
          })}

          {LANES.map((lane, index) => {
            if (!visibleTypes.has(lane.type)) return null;
            return cyclePrediction(lane.type).windows.map((window, windowIndex) => (
              <WindowLabel
                key={`${lane.type}-label-${windowIndex}`}
                window={window}
                dayStartMs={dayStart}
                laneX={laneX(index)}
                laneWidth={laneWidth}
                color={lane.cssColor}
              />
            ));
          })}

          {todayEvents.map((event) => {
            const lane = LANES.find(
              (item) =>
                item.type === event.type ||
                (item.type === 'sleep_start' && (event.type === 'sleep_start' || event.type === 'sleep_end')),
            );
            if (!lane || !visibleTypes.has(lane.type)) return null;
            return (
              <EventDot
                key={event.id}
                ts={event.timestamp}
                dayStartMs={dayStart}
                laneX={laneX(LANES.indexOf(lane))}
                laneWidth={laneWidth}
                color={lane.cssColor}
              />
            );
          })}

          <g aria-hidden="true">
            <line
              x1={LEFT_GUTTER - 6}
              y1={nowY}
              x2={svgWidth - RIGHT_PAD / 2}
              y2={nowY}
              stroke="var(--color-accent)"
              strokeWidth={7}
              opacity={0.14}
              filter="url(#timeline-glow-medium)"
            />
            <line
              x1={LEFT_GUTTER - 6}
              y1={nowY}
              x2={svgWidth - RIGHT_PAD / 2}
              y2={nowY}
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              opacity={0.9}
            />
            <rect
              x={2}
              y={nowY - 10}
              width={36}
              height={20}
              rx={10}
              fill="rgba(235,125,98,0.16)"
              stroke="rgba(235,125,98,0.28)"
            />
            <text
              x={20}
              y={nowY + 4}
              textAnchor="middle"
              fontSize={8.5}
              fill="var(--color-accent)"
              fontFamily="var(--font-body)"
              fontWeight="700"
              letterSpacing="0.12em"
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
