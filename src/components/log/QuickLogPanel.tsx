import React, { memo, useCallback, useRef, useState, type CSSProperties } from 'react';
import type { EventType, PeeColor, PeeVolume, PoopSize } from '../../types';

interface QuickLogPanelProps {
  petId: string;
  isSleeping: boolean;
  onLog?: (type: EventType, metadata?: Record<string, unknown>) => Promise<void>;
  todayCounts?: { pee: number; poop: number; sleep: number };
}

type SheetState = 'collapsed' | 'peek' | 'expanded';
type ActiveEventType = 'sleep' | 'pee' | 'poop' | null;

const SleepIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M22 15A9 9 0 1114 6a6.5 6.5 0 108 9z" fill="currentColor" opacity="0.92" />
    <circle cx="20" cy="7" r="1.5" fill="currentColor" />
    <circle cx="23" cy="10.5" r="1" fill="currentColor" />
    <circle cx="17.5" cy="4.5" r="0.8" fill="currentColor" />
  </svg>
);

const PeeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M14 3C14 3 8 11 8 17a6 6 0 0012 0C20 11 14 3 14 3z" fill="currentColor" opacity="0.94" />
    <circle cx="14" cy="17" r="2.5" fill="white" opacity="0.45" />
  </svg>
);

const PoopIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <ellipse cx="14" cy="21" rx="7.5" ry="3.5" fill="currentColor" opacity="0.68" />
    <ellipse cx="14" cy="18" rx="6" ry="2.8" fill="currentColor" opacity="0.8" />
    <ellipse cx="14" cy="15.2" rx="4.5" ry="2.5" fill="currentColor" opacity="0.9" />
    <ellipse cx="14" cy="12.8" rx="3.2" ry="2" fill="currentColor" />
    <path d="M13 10.5C13 9 15 8 14 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function eventTypeCopy(type: ActiveEventType, isSleeping: boolean) {
  if (type === 'sleep') {
    return {
      title: isSleeping ? 'Wake event' : 'Sleep event',
      description: isSleeping
        ? 'End the current sleep session when your pet gets up.'
        : 'Start a new sleep session when your pet settles in.',
      color: 'var(--color-sleep)',
      tint: 'var(--color-sleep-soft)',
    };
  }

  if (type === 'pee') {
    return {
      title: 'Pee event',
      description: 'Optional notes make patterns easier to interpret later.',
      color: 'var(--color-pee)',
      tint: 'var(--color-pee-soft)',
    };
  }

  if (type === 'poop') {
    return {
      title: 'Poop event',
      description: 'Capture size, consistency, or notes if something looks off.',
      color: 'var(--color-poop)',
      tint: 'var(--color-poop-soft)',
    };
  }

  return {
    title: 'Quick log',
    description: 'Choose an event to add a new timestamp in a couple of taps.',
    color: 'var(--color-accent)',
    tint: 'var(--color-accent-dim)',
  };
}

function PillSelector<T extends string>({
  label,
  options,
  value,
  onChange,
  color,
  tint,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (value: T) => void;
  color: string;
  tint: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="metric-label">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
              aria-pressed={active}
              className="btn-tactile rounded-[16px] px-3 py-3 text-sm font-semibold"
              style={{
                background: active ? tint : 'rgba(255,255,255,0.82)',
                color: active ? color : 'var(--color-text-secondary)',
                border: `1px solid ${active ? `${color}30` : 'rgba(127,100,76,0.12)'}`,
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CONSISTENCY_LABELS = ['', 'Hard', 'Lumpy', 'Cracked', 'Smooth', 'Soft', 'Mushy', 'Liquid'];
const CONSISTENCY_COLORS = ['', '#8A6244', '#976D49', '#A77750', '#B7865B', '#CB9B70', '#D9A77B', '#E4B691'];

function ConsistencyScale({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="metric-label">Consistency</span>
        {value !== undefined ? (
          <span className="text-xs font-semibold" style={{ color: 'var(--color-poop)' }}>
            {CONSISTENCY_LABELS[value]} ({value}/7)
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((score) => {
          const active = value === score;
          return (
            <button
              key={score}
              onClick={() => onChange(score)}
              type="button"
              aria-label={`Consistency ${score}: ${CONSISTENCY_LABELS[score]}`}
              aria-pressed={active}
              className="btn-tactile rounded-[14px] py-3 text-xs font-semibold"
              style={{
                background: active ? CONSISTENCY_COLORS[score] : 'rgba(255,255,255,0.84)',
                border: `1px solid ${active ? CONSISTENCY_COLORS[score] : 'rgba(127,100,76,0.12)'}`,
                color: active ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              {score}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span>Hard</span>
        <span>Liquid</span>
      </div>
    </div>
  );
}

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

  const [peeVolume, setPeeVolume] = useState<PeeVolume | undefined>(undefined);
  const [peeColor, setPeeColor] = useState<PeeColor | undefined>(undefined);
  const [peeUnusualLocation, setPeeUnusualLocation] = useState(false);

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

    const timestamp =
      useCustomTime && customTimestamp ? new Date(customTimestamp).getTime() : Date.now();

    let eventType: EventType;
    const metadata: Record<string, unknown> = { timestamp };

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

    await onLog?.(eventType, metadata);

    setIsSubmitting(false);
    setJustLogged(true);

    setTimeout(() => {
      setJustLogged(false);
      setActiveType(null);
      setSheetState('peek');
      resetFields();
    }, 1400);
  }, [
    _petId,
    activeType,
    customTimestamp,
    isSleeping,
    onLog,
    peeColor,
    peeUnusualLocation,
    peeVolume,
    poopConsistency,
    poopNotes,
    poopSize,
    useCustomTime,
  ]);

  const peekHeight = 168;
  const expandedHeight = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.72, 580) : 540;
  const sheetHeight = sheetState === 'expanded' ? expandedHeight : sheetState === 'peek' ? peekHeight : 0;

  const sleepLabel = isSleeping ? 'Wake' : 'Sleep';
  const activeCopy = eventTypeCopy(activeType, isSleeping);

  const logButtonColor = activeType === 'sleep'
    ? 'var(--color-sleep)'
    : activeType === 'pee'
      ? 'var(--color-pee)'
      : activeType === 'poop'
        ? 'var(--color-poop)'
        : 'var(--color-accent)';

  const logButtonLabel = justLogged
    ? 'Logged'
    : isSubmitting
      ? 'Logging...'
      : `Log ${activeType === 'sleep' ? sleepLabel : activeType === 'pee' ? 'Pee' : activeType === 'poop' ? 'Poop' : ''}`;

  const typeCards: Array<{
    type: Exclude<ActiveEventType, null>;
    label: string;
    sublabel: string;
    color: string;
    tint: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    {
      type: 'sleep',
      label: sleepLabel,
      sublabel: isSleeping ? 'End current rest' : 'Start rest',
      color: 'var(--color-sleep)',
      tint: 'var(--color-sleep-soft)',
      count: todayCounts.sleep,
      icon: <SleepIcon />,
    },
    {
      type: 'pee',
      label: 'Pee',
      sublabel: 'Bathroom event',
      color: 'var(--color-pee)',
      tint: 'var(--color-pee-soft)',
      count: todayCounts.pee,
      icon: <PeeIcon />,
    },
    {
      type: 'poop',
      label: 'Poop',
      sublabel: 'Digestive event',
      color: 'var(--color-poop)',
      tint: 'var(--color-poop-soft)',
      count: todayCounts.poop,
      icon: <PoopIcon />,
    },
  ];

  return (
    <>
      {sheetState === 'expanded' ? (
        <div
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(48,33,21,0.18)', backdropFilter: 'blur(6px)' }}
          onClick={() => {
            setSheetState('peek');
            setActiveType(null);
          }}
          aria-hidden="true"
        />
      ) : null}

      <div
        ref={sheetRef}
        className={`${sheetState === 'expanded' ? 'fixed z-50' : 'shrink-0'} flex flex-col`}
        style={{
          ...(sheetState === 'expanded'
            ? {
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(1000px, calc(100% - 32px))',
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
              }
            : {
                maxWidth: 'min(1000px, calc(100% - 32px))',
                margin: '0 auto 8px',
              }),
          height: sheetHeight,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(249,244,238,0.98) 100%)',
          border: '1px solid rgba(127,100,76,0.1)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          transition: 'height 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        role="dialog"
        aria-label="Quick log panel"
        aria-modal={sheetState === 'expanded'}
      >
        <button
          className="flex w-full items-center justify-center px-4 pb-2 pt-3"
          onClick={() => setSheetState(sheetState === 'expanded' ? 'peek' : 'expanded')}
          type="button"
          aria-label={sheetState === 'expanded' ? 'Collapse log panel' : 'Expand log panel'}
        >
          <span className="h-1.5 w-11 rounded-full" style={{ background: 'rgba(127,100,76,0.22)' }} />
        </button>

        <div className="px-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {activeCopy.title}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {activeCopy.description}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4">
          {typeCards.map((card) => {
            const active = activeType === card.type;
            const sleepingGlow = card.type === 'sleep' && isSleeping && !active;
            return (
              <button
                key={card.type}
                onClick={() => {
                  haptic();
                  selectType(card.type);
                }}
                type="button"
                aria-label={`Log ${card.label}`}
                className="btn-tactile flex flex-col items-start gap-2 rounded-[16px] px-3 py-3 text-left"
                style={{
                  background: active
                    ? `linear-gradient(180deg, ${card.tint} 0%, rgba(255,255,255,0.96) 100%)`
                    : sleepingGlow
                      ? `linear-gradient(180deg, ${card.tint} 0%, rgba(255,255,255,0.88) 100%)`
                      : 'rgba(255,255,255,0.78)',
                  border: `1px solid ${active ? `${card.color}30` : 'rgba(127,100,76,0.12)'}`,
                  boxShadow: active ? 'var(--shadow-md)' : sleepingGlow ? 'var(--shadow-sm)' : 'none',
                  transform: active ? 'translateY(-1px)' : 'none',
                }}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="icon-badge" style={{ background: card.tint, color: card.color }}>
                    {card.icon}
                  </div>
                  <div
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.84)', color: 'var(--color-text-secondary)' }}
                  >
                    {card.count}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {card.label}
                  </span>
                  <span className="text-xs leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                    {card.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {sheetState === 'peek' ? <div className="pb-2" /> : null}

        {sheetState === 'expanded' ? (
          <div
            className="hide-scrollbar mt-3 flex-1 overflow-y-auto px-4 pb-4"
            style={{ WebkitOverflowScrolling: 'touch' } as CSSProperties}
          >
            <div className="flex flex-col gap-4">
              {activeType ? (
                <div
                  className="surface-card-inset p-4"
                  style={{ background: `linear-gradient(180deg, ${activeCopy.tint} 0%, rgba(255,255,255,0.94) 100%)` }}
                >
                  <div className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                    {activeCopy.description}
                  </div>
                </div>
              ) : (
                <div className="surface-card-inset p-4 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                  Pick an event type above to reveal optional notes and time controls.
                </div>
              )}

              {activeType === 'pee' ? (
                <div className="surface-card flex flex-col gap-4 p-4">
                  <PillSelector
                    label="Volume"
                    options={[
                      { value: 'small', label: 'Small' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'large', label: 'Large' },
                    ]}
                    value={peeVolume}
                    onChange={setPeeVolume}
                    color="var(--color-pee)"
                    tint="var(--color-pee-soft)"
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
                    color="var(--color-pee)"
                    tint="var(--color-pee-soft)"
                  />

                  <div className="surface-card-inset flex items-center justify-between gap-4 px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Unusual location
                      </span>
                      <span className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                        Mark if the event happened somewhere unexpected.
                      </span>
                    </div>
                    <button
                      onClick={() => setPeeUnusualLocation((value) => !value)}
                      type="button"
                      aria-pressed={peeUnusualLocation}
                      aria-label="Toggle unusual location"
                      className="toggle-switch btn-tactile shrink-0"
                      data-active={peeUnusualLocation}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                </div>
              ) : null}

              {activeType === 'poop' ? (
                <div className="surface-card flex flex-col gap-4 p-4">
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
                    color="var(--color-poop)"
                    tint="var(--color-poop-soft)"
                  />
                  <div className="flex flex-col gap-3">
                    <span className="metric-label">Notes</span>
                    <textarea
                      value={poopNotes}
                      onChange={(e) => setPoopNotes(e.target.value)}
                      placeholder="Any observation worth remembering?"
                      rows={3}
                      className="control-textarea text-sm"
                      aria-label="Poop notes"
                    />
                  </div>
                </div>
              ) : null}

              <div className="surface-card flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="metric-label">Time</span>
                    <span className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                      Log this event now or backdate it.
                    </span>
                  </div>
                  <button
                    onClick={() => setUseCustomTime((value) => !value)}
                    type="button"
                    className="info-pill btn-tactile"
                    aria-label="Toggle time adjustment"
                  >
                    {useCustomTime ? 'Use current time' : 'Adjust time'}
                  </button>
                </div>

                {useCustomTime ? (
                  <input
                    type="datetime-local"
                    value={customTimestamp}
                    onChange={(e) => setCustomTimestamp(e.target.value)}
                    className="control-input text-sm"
                    style={{ colorScheme: 'light' }}
                    aria-label="Custom event time"
                  />
                ) : (
                  <div className="surface-card-inset px-4 py-3 text-sm" aria-live="polite" style={{ color: 'var(--color-text-secondary)' }}>
                    Now ({new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})
                  </div>
                )}
              </div>

              {activeType ? (
                <button
                  onClick={handleLog}
                  disabled={isSubmitting || justLogged}
                  type="button"
                  className="btn-tactile flex w-full items-center justify-center gap-2 rounded-[20px] px-5 py-4 text-base font-semibold"
                  style={{
                    background: justLogged
                      ? 'linear-gradient(135deg, var(--color-success) 0%, #5f7b66 100%)'
                      : `linear-gradient(135deg, ${logButtonColor} 0%, ${logButtonColor}dd 100%)`,
                    color: '#fffaf6',
                    opacity: isSubmitting ? 0.8 : 1,
                    boxShadow: justLogged
                      ? '0 18px 34px rgba(111,143,119,0.28)'
                      : `0 18px 34px ${logButtonColor}33`,
                  }}
                  aria-live="polite"
                  aria-label={logButtonLabel}
                >
                  {justLogged ? <CheckIcon /> : null}
                  {logButtonLabel}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {sheetState === 'collapsed' ? (
        <button
          className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            right: 'max(20px, calc(50% - 480px))',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)',
            background: 'var(--color-accent)',
            color: '#fff8f4',
            boxShadow: '0 4px 12px rgba(217,102,76,0.24)',
          }}
          onClick={() => {
            haptic();
            setSheetState('peek');
          }}
          type="button"
          aria-label="Open quick log"
        >
          <PlusIcon />
        </button>
      ) : null}
    </>
  );
});

export default QuickLogPanel;
