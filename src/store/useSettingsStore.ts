/**
 * Settings store — separate from the pet store for isolation.
 * Hydrates from IndexedDB on mount and writes through on every update.
 */

import { create } from 'zustand';
import type { AppSettings } from './db';
import { getSettings, saveSettings } from './db';

interface SettingsStore {
  settings: AppSettings;
  /** Hydrate from IndexedDB. Call once alongside usePetStore.initialize(). */
  initialize(): Promise<void>;
  /** Apply a partial update; merges with current settings and persists. */
  updateSettings(updates: Partial<AppSettings>): Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  activePetId: null,
  notificationsEnabled: false,
  notifyMinutesBefore: 15,
  theme: 'dark',
  onboardingComplete: false,
};

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },

  async initialize() {
    try {
      const stored = await getSettings();
      set({ settings: stored });
    } catch (error) {
      console.error('[PawClock] Settings initialization failed:', error);
    }
  },

  async updateSettings(updates: Partial<AppSettings>) {
    const current = get().settings;
    const merged: AppSettings = { ...current, ...updates };

    try {
      await saveSettings(merged);
      set({ settings: merged });
    } catch (error) {
      console.error('[PawClock] Failed to persist settings update:', error);
      throw error;
    }
  },
}));

// ─── Selectors ────────────────────────────────────────────────

export const selectSettings = (state: SettingsStore) => state.settings;
export const selectNotificationsEnabled = (state: SettingsStore) =>
  state.settings.notificationsEnabled;
export const selectNotifyMinutesBefore = (state: SettingsStore) =>
  state.settings.notifyMinutesBefore;
export const selectOnboardingComplete = (state: SettingsStore) =>
  state.settings.onboardingComplete;
