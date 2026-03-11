import { useEffect, useCallback, useMemo, useState } from 'react';
import type { PetProfile, EventType } from './types';
import { usePetStore } from './store/usePetStore';

import BottomNav from './components/shared/BottomNav';
import type { NavTab } from './components/shared/BottomNav';
import Dashboard from './components/dashboard/Dashboard';
import History from './components/history/History';
import Settings from './components/settings/Settings';
import Onboarding from './components/onboarding/Onboarding';
import QuickLogPanel from './components/log/QuickLogPanel';
import { useSettingsStore } from './store/useSettingsStore';

export default function App() {
  const [tab, setTab] = useState<NavTab>('dashboard');

  // ── Store subscriptions ──────────────────────────────────────
  const initialize = usePetStore((s) => s.initialize);
  const isLoading = usePetStore((s) => s.isLoading);
  const isOnboarded = usePetStore((s) => s.isOnboarded);
  const activePet = usePetStore((s) => s.activePet);
  const events = usePetStore((s) => s.events);
  const predictions = usePetStore((s) => s.predictions);
  const modelState = usePetStore((s) => s.modelState);
  const addPet = usePetStore((s) => s.addPet);
  const logEvent = usePetStore((s) => s.logEvent);
  const completeOnboarding = usePetStore((s) => s.completeOnboarding);
  const refreshPredictions = usePetStore((s) => s.refreshPredictions);
  const removePet = usePetStore((s) => s.removePet);

  const initSettings = useSettingsStore((s) => s.initialize);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // ── Initialize on mount ──────────────────────────────────────
  useEffect(() => {
    initialize();
    initSettings();
  }, [initialize, initSettings]);

  // ── Generate predictions on first load if model exists but no predictions ──
  useEffect(() => {
    if (modelState && !predictions && activePet) {
      refreshPredictions();
    }
  }, [modelState, predictions, activePet, refreshPredictions]);

  // ── Onboarding complete → add pet, init model, generate predictions ──
  const handleOnboardingComplete = useCallback(async (pet: PetProfile) => {
    // The onboarding component builds a full PetProfile (with id + createdAt)
    // but our store's addPet generates its own id. We need to adapt.
    const petId = await addPet({
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      sizeClass: pet.sizeClass,
      ageMonths: pet.ageMonths,
      weightKg: pet.weightKg,
      neutered: pet.neutered,
      indoor: pet.indoor,
      brachycephalic: pet.brachycephalic,
      dietType: pet.dietType,
      mealTimes: pet.mealTimes,
    });
    await completeOnboarding();
    // addPet auto-selects the first pet, and initializes the model.
    // Now generate initial predictions from population priors.
    await refreshPredictions();
    void petId; // used by store internally
  }, [addPet, completeOnboarding, refreshPredictions]);

  // ── Quick log handler → store.logEvent (persists, updates model, refreshes predictions) ──
  const handleLog = useCallback(async (type: EventType, metadata?: Record<string, unknown>) => {
    await logEvent(type, metadata);
  }, [logEvent]);

  // ── Reset handler ──
  const handleResetData = useCallback(async () => {
    if (activePet) {
      await removePet(activePet.id);
    }
  }, [activePet, removePet]);

  // ── Derived state ──
  const isSleeping = useMemo(() => {
    const sleepEvents = events
      .filter((e) => e.type === 'sleep_start' || e.type === 'sleep_end')
      .sort((a, b) => b.timestamp - a.timestamp);
    return sleepEvents[0]?.type === 'sleep_start';
  }, [events]);

  const todayCounts = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    return {
      pee: events.filter((e) => e.type === 'pee' && e.timestamp >= ts).length,
      poop: events.filter((e) => e.type === 'poop' && e.timestamp >= ts).length,
      sleep: events.filter((e) => e.type === 'sleep_start' && e.timestamp >= ts).length,
    };
  }, [events]);

  // ─── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-dvh"
        style={{ background: 'var(--color-surface)' }}
        aria-label="Loading PawClock"
        role="status"
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="animate-pulse rounded-2xl flex items-center justify-center"
            style={{ width: 64, height: 64, background: 'var(--color-surface-raised)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="10" stroke="var(--color-accent)" strokeWidth="1.5" fill="none" opacity="0.4" />
              <circle cx="16" cy="16" r="4" fill="var(--color-accent)" opacity="0.6" />
            </svg>
          </div>
          <span
            className="text-sm"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
          >
            PawClock
          </span>
        </div>
      </div>
    );
  }

  // ─── Onboarding ───────────────────────────────────────────────
  if (!isOnboarded || !activePet) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <Onboarding onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  // ─── Main App ─────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <div className="app-frame">
        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {tab === 'dashboard' && predictions && (
            <Dashboard
              pet={activePet}
              prediction={predictions}
              events={events}
            />
          )}
          {tab === 'dashboard' && !predictions && (
            <div className="flex items-center justify-center h-64">
              <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                Generating predictions...
              </p>
            </div>
          )}
          {tab === 'history' && (
            <History events={events} petName={activePet.name} />
          )}
          {tab === 'settings' && (
            <Settings
              pet={activePet}
              settings={settings}
              onSettingsChange={updateSettings}
              onResetData={handleResetData}
            />
          )}
        </main>

        <QuickLogPanel
          petId={activePet.id}
          isSleeping={isSleeping}
          onLog={handleLog}
          todayCounts={todayCounts}
        />

        <BottomNav activeTab={tab} onTabChange={setTab} />
      </div>
    </div>
  );
}
