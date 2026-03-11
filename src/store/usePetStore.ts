/**
 * Primary reactive store for PawClock.
 *
 * Zustand is the session-level reactive layer; IndexedDB is the source of
 * truth. On mount, `initialize()` hydrates Zustand from IDB. All mutations
 * write to IDB first, then update Zustand state.
 *
 * Engine integration is stubbed pending the engine agent's output.
 * Replace the TODO stubs with real imports once `src/engine/` is ready.
 */

import { create } from 'zustand';
import type { PetProfile, PetEvent, EventType, PetModelState, PetPrediction } from '../types';
import {
  savePet,
  getAllPets,
  deletePet,
  saveEvent,
  getEvents,
  deleteEvent as dbDeleteEvent,
  saveModelState,
  getModelState,
  savePredictions,
  getPredictions,
  getSettings,
  saveSettings,
  generateId,
} from './db';
import { startOfToday } from '../utils/time';
import { initializeModelState, updateModel } from '../engine/model';
import { generateAllPredictions } from '../engine/predictor';

// ─── Store Interface ──────────────────────────────────────────

interface PetStore {
  // ── State ────────────────────────────────────────────────────
  pets: PetProfile[];
  activePetId: string | null;
  /** Derived from pets + activePetId — always in sync */
  activePet: PetProfile | null;
  /** Events for the active pet, covering the last 30 days */
  events: PetEvent[];
  /** Current Bayesian model state for the active pet */
  modelState: PetModelState | null;
  /** Latest prediction output for the active pet */
  predictions: PetPrediction | null;
  isLoading: boolean;
  isOnboarded: boolean;

  // ── Actions ───────────────────────────────────────────────────
  /** Hydrate store from IndexedDB. Call once on app mount. */
  initialize(): Promise<void>;
  /** Switch the active pet and load its data. */
  setActivePet(petId: string): Promise<void>;
  /** Create a new pet profile; returns the generated petId. */
  addPet(pet: Omit<PetProfile, 'id' | 'createdAt'>): Promise<string>;
  /** Partially update a pet profile. */
  updatePet(petId: string, updates: Partial<PetProfile>): Promise<void>;
  /** Delete a pet and all associated data. */
  removePet(petId: string): Promise<void>;
  /** Log a biological event, update the model, and refresh predictions. */
  logEvent(
    type: EventType,
    metadata?: Partial<Omit<PetEvent, 'id' | 'petId' | 'type' | 'createdAt'>>,
  ): Promise<void>;
  /** Remove a logged event by ID. */
  deleteEvent(eventId: string): Promise<void>;
  /** Recompute predictions from current model state. */
  refreshPredictions(): Promise<void>;
  /** Mark onboarding as complete in settings. */
  completeOnboarding(): Promise<void>;
}

// ─── 30-Day Window Constant ───────────────────────────────────

const RECENT_EVENTS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Store Implementation ─────────────────────────────────────

export const usePetStore = create<PetStore>()((set, get) => ({
  pets: [],
  activePetId: null,
  activePet: null,
  events: [],
  modelState: null,
  predictions: null,
  isLoading: false,
  isOnboarded: false,

  // ── initialize ───────────────────────────────────────────────
  async initialize() {
    set({ isLoading: true });

    try {
      const [allPets, settings] = await Promise.all([
        getAllPets(),
        getSettings(),
      ]);

      // Determine which pet to show first
      const resolvedActivePetId =
        settings.activePetId && allPets.some((p) => p.id === settings.activePetId)
          ? settings.activePetId
          : (allPets[0]?.id ?? null);

      const activePet =
        allPets.find((p) => p.id === resolvedActivePetId) ?? null;

      // Load active pet data
      const since = Date.now() - RECENT_EVENTS_WINDOW_MS;
      const [recentEvents, modelState, predictions] = resolvedActivePetId
        ? await Promise.all([
            getEvents(resolvedActivePetId, since),
            getModelState(resolvedActivePetId),
            getPredictions(resolvedActivePetId),
          ])
        : [[], undefined, undefined];

      set({
        pets: allPets,
        activePetId: resolvedActivePetId,
        activePet,
        events: recentEvents,
        modelState: modelState ?? null,
        predictions: predictions ?? null,
        isOnboarded: settings.onboardingComplete,
        isLoading: false,
      });
    } catch (error) {
      console.error('[PawClock] Store initialization failed:', error);
      set({ isLoading: false });
    }
  },

  // ── setActivePet ─────────────────────────────────────────────
  async setActivePet(petId: string) {
    const { pets } = get();
    const pet = pets.find((p) => p.id === petId) ?? null;

    if (!pet) {
      console.warn(`[PawClock] setActivePet: pet ${petId} not found`);
      return;
    }

    set({ isLoading: true });

    try {
      const since = Date.now() - RECENT_EVENTS_WINDOW_MS;
      const [recentEvents, modelState, predictions] = await Promise.all([
        getEvents(petId, since),
        getModelState(petId),
        getPredictions(petId),
      ]);

      // Persist active pet preference
      const settings = await getSettings();
      await saveSettings({ ...settings, activePetId: petId });

      set({
        activePetId: petId,
        activePet: pet,
        events: recentEvents,
        modelState: modelState ?? null,
        predictions: predictions ?? null,
        isLoading: false,
      });
    } catch (error) {
      console.error(`[PawClock] setActivePet failed for ${petId}:`, error);
      set({ isLoading: false });
    }
  },

  // ── addPet ───────────────────────────────────────────────────
  async addPet(petData) {
    const petId = generateId();
    const now = Date.now();

    const pet: PetProfile = {
      ...petData,
      id: petId,
      createdAt: now,
    };

    await savePet(pet);

    // Initialize model state from population priors
    const initialModelState = initializeModelState(pet);
    await saveModelState(initialModelState);

    const { pets } = get();
    const updatedPets = [...pets, pet];

    // If this is the first pet, auto-select it
    const { activePetId } = get();
    const shouldActivate = activePetId === null;

    if (shouldActivate) {
      const settings = await getSettings();
      await saveSettings({ ...settings, activePetId: petId });

      set({
        pets: updatedPets,
        activePetId: petId,
        activePet: pet,
        events: [],
        modelState: initialModelState,
        predictions: null,
      });
    } else {
      set({ pets: updatedPets });
    }

    return petId;
  },

  // ── updatePet ────────────────────────────────────────────────
  async updatePet(petId, updates) {
    const { pets, activePet } = get();
    const existingPet = pets.find((p) => p.id === petId);

    if (!existingPet) {
      console.warn(`[PawClock] updatePet: pet ${petId} not found`);
      return;
    }

    const updatedPet: PetProfile = { ...existingPet, ...updates };
    await savePet(updatedPet);

    const updatedPets = pets.map((p) => (p.id === petId ? updatedPet : p));
    const updatedActivePet =
      activePet?.id === petId ? updatedPet : activePet;

    set({ pets: updatedPets, activePet: updatedActivePet });
  },

  // ── removePet ────────────────────────────────────────────────
  async removePet(petId) {
    await deletePet(petId);

    const { pets, activePetId } = get();
    const remainingPets = pets.filter((p) => p.id !== petId);

    // If the removed pet was active, fall back to first remaining pet
    if (activePetId === petId) {
      const nextPet = remainingPets[0] ?? null;

      if (nextPet) {
        const since = Date.now() - RECENT_EVENTS_WINDOW_MS;
        const [recentEvents, modelState, predictions] = await Promise.all([
          getEvents(nextPet.id, since),
          getModelState(nextPet.id),
          getPredictions(nextPet.id),
        ]);

        const settings = await getSettings();
        await saveSettings({ ...settings, activePetId: nextPet.id });

        set({
          pets: remainingPets,
          activePetId: nextPet.id,
          activePet: nextPet,
          events: recentEvents,
          modelState: modelState ?? null,
          predictions: predictions ?? null,
        });
      } else {
        const settings = await getSettings();
        await saveSettings({ ...settings, activePetId: null });

        set({
          pets: [],
          activePetId: null,
          activePet: null,
          events: [],
          modelState: null,
          predictions: null,
        });
      }
    } else {
      set({ pets: remainingPets });
    }
  },

  // ── logEvent ─────────────────────────────────────────────────
  async logEvent(type, metadata = {}) {
    const { activePetId, activePet, modelState, events } = get();

    if (!activePetId || !activePet) {
      console.warn('[PawClock] logEvent called with no active pet');
      return;
    }

    const now = Date.now();

    // Build the correctly-typed event discriminated union
    const baseFields = {
      id: generateId(),
      petId: activePetId,
      type,
      timestamp: (metadata as { timestamp?: number }).timestamp ?? now,
      createdAt: now,
    };

    let newEvent: PetEvent;

    if (type === 'pee') {
      const { volume, color, unusualLocation } = metadata as {
        volume?: PetEvent extends { type: 'pee' } ? PetEvent['volume'] : never;
        color?: PetEvent extends { type: 'pee' } ? PetEvent['color'] : never;
        unusualLocation?: boolean;
      };
      newEvent = { ...baseFields, type: 'pee', volume, color, unusualLocation };
    } else if (type === 'poop') {
      const { consistencyScore, size, notes } = metadata as {
        consistencyScore?: number;
        size?: PetEvent extends { type: 'poop' } ? PetEvent['size'] : never;
        notes?: string;
      };
      newEvent = { ...baseFields, type: 'poop', consistencyScore, size, notes };
    } else if (type === 'sleep_start') {
      newEvent = { ...baseFields, type: 'sleep_start' };
    } else {
      newEvent = { ...baseFields, type: 'sleep_end' };
    }

    // 1. Persist event to IDB
    await saveEvent(newEvent);

    // 2. Update Bayesian model state with the engine
    const currentModelState = modelState ?? initializeModelState(activePet);
    const cycleKey = type === 'sleep_start' ? 'sleepStart' : type === 'sleep_end' ? 'sleepEnd' : type;
    const prevTimestamp = currentModelState[cycleKey].lastEventTimestamp;
    const updatedCycle = updateModel(currentModelState[cycleKey], newEvent, prevTimestamp);
    const updatedModelState: PetModelState = {
      ...currentModelState,
      [cycleKey]: updatedCycle,
      updatedAt: Date.now(),
    };
    await saveModelState(updatedModelState);

    // 3. Refresh predictions with updated model
    const freshPredictions = generateAllPredictions(
      updatedModelState,
      Date.now(),
      activePet,
    );
    await savePredictions(freshPredictions);

    // 4. Update Zustand state reactively
    const cutoff = Date.now() - RECENT_EVENTS_WINDOW_MS;
    const updatedEvents = [...events, newEvent].filter(
      (e) => e.timestamp >= cutoff,
    );

    set({
      events: updatedEvents,
      modelState: updatedModelState,
      predictions: freshPredictions,
    });
  },

  // ── deleteEvent ──────────────────────────────────────────────
  async deleteEvent(eventId: string) {
    const { activePetId, events } = get();

    if (!activePetId) {
      console.warn('[PawClock] deleteEvent called with no active pet');
      return;
    }

    await dbDeleteEvent(eventId, activePetId);

    const updatedEvents = events.filter((e) => e.id !== eventId);
    set({ events: updatedEvents });

    // Recompute predictions after removing an event
    await get().refreshPredictions();
  },

  // ── refreshPredictions ───────────────────────────────────────
  async refreshPredictions() {
    const { activePetId, activePet, modelState } = get();

    if (!activePetId || !activePet || !modelState) return;

    const freshPredictions = generateAllPredictions(
      modelState,
      Date.now(),
      activePet,
    );
    await savePredictions(freshPredictions);
    set({ predictions: freshPredictions });
  },

  // ── completeOnboarding ───────────────────────────────────────
  async completeOnboarding() {
    const settings = await getSettings();
    const updatedSettings = { ...settings, onboardingComplete: true };
    await saveSettings(updatedSettings);
    set({ isOnboarded: true });
  },
}));

// ─── Derived Selectors ────────────────────────────────────────
// Convenience selectors to avoid re-rendering on unrelated state slices.

export const selectActivePet = (state: PetStore) => state.activePet;
export const selectPredictions = (state: PetStore) => state.predictions;
export const selectEvents = (state: PetStore) => state.events;
export const selectModelState = (state: PetStore) => state.modelState;
export const selectIsLoading = (state: PetStore) => state.isLoading;
export const selectIsOnboarded = (state: PetStore) => state.isOnboarded;

// ─── Synthetic today-only event selector ─────────────────────

/** Returns only events from today for the active pet. */
export function selectTodaysEvents(state: PetStore): PetEvent[] {
  const todayStart = startOfToday();
  return state.events.filter((e) => e.timestamp >= todayStart);
}
