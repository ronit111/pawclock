import React, { useState, useRef, useCallback, memo } from 'react';
import type { PeeVolume, PeeColor, PoopSize, EventType } from '../../types';

interface QuickLogPanelProps {
  petId: string;
  /** Currently sleeping (for sleep toggle logic) */
  isSleeping: boolean;
  /** Called with (eventType, metadata) — parent handles persistence + model update */
  onLog?: (type: EventType, metadata?: Record<string, unknown>) => Promise<void>;
  /** Currently logged event counts for today */
  todayCounts?: { pee: number; poop: number; sleep: number };
}

type SheetState = 'collapsed' | 'peek' | 'expanded';
type ActiveEventType = 'sleep' | 'pee' | 'poop' | null;

// ─── Icons ────────────────────────────────────────────────────

const SleepIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M22 15A9 9 0 1114 6a6.5 6.5 0 108 9z"
      fill="currentColor"
      opacity="0.9"
    />
    <circle cx="20" cy="7" r="1.5" fill="currentColor" />
    <circle cx="23" cy="10.5" r="1" fill="currentColor" />
    <circle cx="17.5" cy="4.5" r="0.8" fill="currentColor" />
  </svg>
);

const PeeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M14 3C14 3 8 11 8 17a6 6 0 0012 0C20 11 14 3 14 3z"
      fill="currentColor"
      opacity="0.9"
    />
    <circle cx="14" cy="17" r="2.5" fill="var(--color-surface)" opacity="0.3" />
  </svg>
);

const PoopIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <ellipse cx="14" cy="21" rx="7.5" ry="3.5" fill="currentColor" opacity="0.65" />
    <ellipse cx="14" cy="18" rx="6" ry="2.8" fill="currentColor" opacity="0.78" />
    <ellipse cx="14" cy="15.2" rx="4.5" ry="2.5" fill="currentColor" opacity="0.88" />
    <ellipse cx="14" cy="12.8" rx="3.2" ry="2" fill="currentColor" />
    <path d="M13 10.5C13 9 15 8 14 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12.5" cy="11.8" r="0.8" fill="var(--color-surface)" opacity="0.4" />
    <circle cx="15.5" cy="12.8" r="0.6" fill="var(--color-surface)" opacity="0.4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 10l5 5 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// ─── Pill selector ────────────────────────────────────────────

function PillSelector<T extends string>({
  label,
  options,
  value,
  onChange,
  colorActive,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
  colorActive: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
      >
        {label}
      </span>
      <div className="flex gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                minHeight: 44,
                background: active ? `${colorActive}25` : 'var(--color-surface)',
                color: active ? colorActive : 'var(--color-text-secondary)',
                border: `1px solid ${active ? colorActive + '50' : 'rgba(245,240,232,0.08)'}`,
                fontFamily: 'var(--font-body)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Consistency scale (Bristol 1-7) ─────────────────────────

const CONSISTENCY_LABELS = ['', 'Hard', 'Lumpy', 'Cracked', 'Smooth', 'Soft', 'Mushy', 'Liquid'];
const CONSISTENCY_COLORS = ['', '#6B4226', '#7D5535', '#8B6B4A', '#9A7A5A', '#C4956A', '#D4A07A', '#E0A87A'];

function ConsistencyScale({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
        >
          Consistency
        </span>
        {value !== undefined && (
          <span
            className="text-xs"
            style={{ color: 'var(--color-poop)', fontFamily: 'var(--font-body)' }}
          >
            {CONSISTENCY_LABELS[value]} ({value}/7)
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-label={`Consistency ${n}: ${CONSISTENCY_LABELS[n]}`}
            aria-pressed={value === n}
            className="flex-1 rounded-lg transition-all duration-150"
            style={{
              minHeight: 44,
              background: value === n ? CONSISTENCY_COLORS[n] : 'var(--color-surface)',
              border: `1px solid ${value === n ? CONSISTENCY_COLORS[n] : 'rgba(245,240,232,0.08)'}`,
              color: value === n ? 'white' : 'var(--color-text-muted)',
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-0.5">
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Hard</span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Liquid</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

const QuickLogPanel = memo(function QuickLogPanel({
  petId: _petId,
  isSleeping,
  onLog,
  todayCounts = { pee: 0, poop: 0, sleep: 0 },
}: QuickLogPanelProps) {
  const [sheetState, setSheetState] = useState<SheetState>('peek');
  const [activeType, setActiveType] = useState<ActiveEventType>(null);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customTimestamp, setCustomTimestamp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  // Pee fields
  const [peeVolume, setPeeVolume] = useState<PeeVolume | undefined>(undefined);
  const [peeColor, setPeeColor] = useState<PeeColor | undefined>(undefined);
  const [peeUnusualLocation, setPeeUnusualLocation] = useState(false);

  // Poop fields
  const [poopConsistency, setPoopConsistency] = useState<number | undefined>(undefined);
  const [poopSize, setPoopSize] = useState<PoopSize | undefined>(undefined);
  const [poopNotes, setPoopNotes] = useState('');

  const sheetRef = useRef<HTMLDivElement>(null);

  function resetFields() {
    setPeeVolume(undefined);
    setPeeColor(undefined);
    setPeeUnusualLocation(false);
    setPoopConsistency(undefined);
    setPoopSize(undefined);
    setPoopNotes('');
    setUseCustomTime(false);
    setCustomTimestamp('');
  }

  function selectType(type: ActiveEventType) {
    setActiveType(type);
    setSheetState('expanded');
    resetFields();
  }

  function haptic() {
    if ('vibrate' in navigator) navigator.vibrate(10);
  }

  const handleLog = useCallback(async () => {
    if (!activeType) return;
    haptic();
    setIsSubmitting(true);

    const ts = useCustomTime && customTimestamp
      ? new Date(customTimestamp).getTime()
      : Date.now();

    // Determine event type
    let eventType: EventType;
    const metadata: Record<string, unknown> = { timestamp: ts };

    if (activeType === 'pee') {
      eventType = 'pee';
      if (peeVolume) metadata.volume = peeVolume;
      if (peeColor) metadata.color = peeColor;
      if (peeUnusualLocation) metadata.unusualLocation = true;
    } else if (activeType === 'poop') {
      eventType = 'poop';
      if (poopConsistency) metadata.consistencyScore = poopConsistency;
      if (poopSize) metadata.size = poopSize;
      if (poopNotes) metadata.notes = poopNotes;
    } else {
      eventType = isSleeping ? 'sleep_end' : 'sleep_start';
    }

    // Delegate to store — handles IDB persistence, model update, and prediction refresh
    await onLog?.(eventType, metadata);

    setIsSubmitting(false);
    setJustLogged(true);

    setTimeout(() => {
      setJustLogged(false);
      setActiveType(null);
      setSheetState('peek');
      resetFields();
    }, 1400);
  }, [activeType, _petId, isSleeping, useCustomTime, customTimestamp, peeVolume, peeColor, peeUnusualLocation, poopConsistency, poopSize, poopNotes, onLog]);

  // Heights for different states
  const peekHeight = 164;
  const expandedHeight = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.72, 560) : 520;

  const sheetHeight = sheetState === 'expanded' ? expandedHeight : sheetState === 'peek' ? peekHeight : 0;

  const getButtonStyle = (type: ActiveEventType): React.CSSProperties => {
    const isActive = activeType === type;
    const isSleepActive = type === 'sleep' && isSleeping && !isActive;
    const colorMap = { sleep: 'var(--color-sleep)', pee: 'var(--color-pee)', poop: 'var(--color-poop)' };
    const color = type ? colorMap[type] : 'transparent';

    return {
      background: isActive
        ? `linear-gradient(145deg, ${color}25 0%, ${color}10 100%)`
        : isSleepActive
        ? `linear-gradient(145deg, ${color}12 0%, ${color}06 100%)`
        : 'var(--color-surface)',
      border: `1.5px solid ${isActive ? color : isSleepActive ? `${color}30` : 'rgba(245,240,232,0.06)'}`,
      color: isActive || isSleepActive ? color : 'var(--color-text-secondary)',
      boxShadow: isActive
        ? `0 0 20px ${color}25, inset 0 1px 0 rgba(255,255,255,0.04)`
        : isSleepActive
        ? `0 0 12px ${color}15`
        : 'inset 0 1px 0 rgba(255,255,255,0.02)',
      transform: isActive ? 'scale(1.03)' : 'scale(1)',
      transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  };

  const sleepLabel = isSleeping ? 'Wake' : 'Sleep';

  const logButtonColor = activeType === 'sleep'
    ? 'var(--color-sleep)'
    : activeType === 'pee'
    ? 'var(--color-pee)'
    : activeType === 'poop'
    ? 'var(--color-poop)'
    : 'var(--color-accent)';

  const logButtonLabel = justLogged ? 'Logged!' : isSubmitting ? 'Logging...' : `Log ${
    activeType === 'sleep' ? (isSleeping ? 'Wake' : 'Sleep') : activeType === 'pee' ? 'Pee' : activeType === 'poop' ? 'Poop' : ''
  }`;

  return (
    <>
      {/* Backdrop when expanded */}
      {sheetState === 'expanded' && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => { setSheetState('peek'); setActiveType(null); }}
          aria-hidden="true"
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`${
          sheetState === 'expanded'
            ? 'fixed left-0 right-0 z-50'
            : 'shrink-0'
        } flex flex-col`}
        style={{
          ...(sheetState === 'expanded'
            ? { bottom: 'env(safe-area-inset-bottom, 0px)', marginBottom: 60 }
            : {}),
          height: sheetHeight,
          background: 'rgba(26, 24, 22, 0.97)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid rgba(245,240,232,0.1)',
          transition: 'height 280ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-label="Quick log panel"
        aria-modal={sheetState === 'expanded'}
      >
        {/* Drag handle */}
        <button
          className="flex items-center justify-center w-full py-3 shrink-0"
          onClick={() => setSheetState(sheetState === 'expanded' ? 'peek' : 'expanded')}
          aria-label={sheetState === 'expanded' ? 'Collapse log panel' : 'Expand log panel'}
        >
          <div
            className="rounded-full"
            style={{ width: 36, height: 4, background: 'rgba(245,240,232,0.2)' }}
          />
        </button>

        {/* Event type buttons */}
        <div className="flex gap-3 px-5 shrink-0">
          {(['sleep', 'pee', 'poop'] as const).map((type) => {
            const colorMap = { sleep: 'var(--color-sleep)', pee: 'var(--color-pee)', poop: 'var(--color-poop)' };
            const labelMap = { sleep: sleepLabel, pee: 'Pee', poop: 'Poop' };

            return (
              <button
                key={type}
                onClick={() => { haptic(); selectType(type); }}
                aria-label={`Log ${labelMap[type]}`}
                className="btn-tactile flex-1 flex flex-col items-center justify-center gap-2 rounded-2xl"
                style={{ height: 88, ...getButtonStyle(type) }}
              >
                <span style={{ color: colorMap[type] }}>
                  {type === 'sleep' ? <SleepIcon /> : type === 'pee' ? <PeeIcon /> : <PoopIcon />}
                </span>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {labelMap[type]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Today summary */}
        {sheetState === 'peek' && (
          <div
            className="px-5 mt-3 text-xs"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
          >
            Today: {todayCounts.pee} pee · {todayCounts.poop} poop · {todayCounts.sleep} sleep
          </div>
        )}

        {/* Expanded detail panel */}
        {sheetState === 'expanded' && activeType && (
          <div
            className="flex flex-col gap-4 px-5 mt-4 overflow-y-auto flex-1"
            style={{ WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}
          >
            {/* Sleep */}
            {activeType === 'sleep' && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--color-surface)', border: '1px solid rgba(245,240,232,0.06)' }}
              >
                <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
                  {isSleeping
                    ? "Log wake: end the current sleep session."
                    : "Log sleep start: begin tracking a sleep session."}
                </p>
              </div>
            )}

            {/* Pee details */}
            {activeType === 'pee' && (
              <>
                <PillSelector
                  label="Volume"
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'large', label: 'Large' },
                  ]}
                  value={peeVolume}
                  onChange={setPeeVolume}
                  colorActive="var(--color-pee)"
                />
                <PillSelector
                  label="Color"
                  options={[
                    { value: 'clear', label: 'Clear' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                  value={peeColor}
                  onChange={setPeeColor}
                  colorActive="var(--color-pee)"
                />
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                  >
                    Unusual location?
                  </span>
                  <button
                    onClick={() => setPeeUnusualLocation((v) => !v)}
                    aria-pressed={peeUnusualLocation}
                    aria-label="Toggle unusual location"
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: 48,
                      height: 28,
                      background: peeUnusualLocation ? 'var(--color-pee)' : 'var(--color-surface)',
                      border: '1px solid rgba(245,240,232,0.12)',
                      position: 'relative',
                    }}
                  >
                    <span
                      className="absolute rounded-full transition-all duration-200"
                      style={{
                        width: 20,
                        height: 20,
                        background: 'white',
                        top: 3,
                        left: peeUnusualLocation ? 25 : 3,
                      }}
                    />
                  </button>
                </div>
              </>
            )}

            {/* Poop details */}
            {activeType === 'poop' && (
              <>
                <ConsistencyScale value={poopConsistency} onChange={setPoopConsistency} />
                <PillSelector
                  label="Size"
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'large', label: 'Large' },
                  ]}
                  value={poopSize}
                  onChange={setPoopSize}
                  colorActive="var(--color-poop)"
                />
                <div className="flex flex-col gap-1">
                  <span
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
                  >
                    Notes (optional)
                  </span>
                  <textarea
                    value={poopNotes}
                    onChange={(e) => setPoopNotes(e.target.value)}
                    placeholder="Any observations..."
                    rows={2}
                    className="rounded-xl px-3 py-2 text-sm resize-none outline-none"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid rgba(245,240,232,0.08)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-body)',
                    }}
                    aria-label="Poop notes"
                  />
                </div>
              </>
            )}

            {/* Timestamp */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
                >
                  Time
                </span>
                <button
                  onClick={() => setUseCustomTime((v) => !v)}
                  className="text-xs underline"
                  style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                  aria-label="Toggle time adjustment"
                >
                  {useCustomTime ? 'Use Now' : 'Adjust time'}
                </button>
              </div>
              {useCustomTime ? (
                <input
                  type="datetime-local"
                  value={customTimestamp}
                  onChange={(e) => setCustomTimestamp(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid rgba(245,240,232,0.08)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                    colorScheme: 'dark',
                    minHeight: 44,
                  }}
                  aria-label="Custom event time"
                />
              ) : (
                <div
                  className="px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                  }}
                  aria-live="polite"
                >
                  Now ({new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})
                </div>
              )}
            </div>

            {/* Log button */}
            <button
              onClick={handleLog}
              disabled={isSubmitting || justLogged}
              className="w-full rounded-2xl font-semibold text-base transition-all duration-200"
              style={{
                minHeight: 52,
                background: justLogged
                  ? 'var(--color-success)'
                  : logButtonColor,
                color: 'var(--color-surface)',
                fontFamily: 'var(--font-body)',
                opacity: isSubmitting ? 0.7 : 1,
                transform: isSubmitting ? 'scale(0.98)' : 'scale(1)',
                boxShadow: justLogged
                  ? `0 0 24px var(--color-success), 0 0 8px var(--color-success)`
                  : `0 0 20px ${logButtonColor}40`,
              }}
              aria-live="polite"
              aria-label={logButtonLabel}
            >
              <span className="flex items-center justify-center gap-2">
                {justLogged && <CheckIcon />}
                {logButtonLabel}
              </span>
            </button>

            <div style={{ height: 8 }} />
          </div>
        )}
      </div>

      {/* FAB when collapsed */}
      {sheetState === 'collapsed' && (
        <button
          className="absolute z-50 flex items-center justify-center rounded-full shadow-xl transition-all duration-200 active:scale-95"
          style={{
            right: 20,
            bottom: `calc(env(safe-area-inset-bottom, 0px) + 80px)`,
            width: 56,
            height: 56,
            background: 'var(--color-accent)',
            color: 'var(--color-surface)',
            boxShadow: '0 0 24px var(--color-accent-dim)',
          }}
          onClick={() => { haptic(); setSheetState('peek'); }}
          aria-label="Open quick log"
        >
          <PlusIcon />
        </button>
      )}
    </>
  );
});

export default QuickLogPanel;
