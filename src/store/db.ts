/**
 * IndexedDB persistence layer via idb-keyval.
 *
 * Key schema:
 *   pets:{petId}           → PetProfile
 *   events:{petId}         → PetEvent[] (sorted by timestamp asc)
 *   model:{petId}          → PetModelState
 *   predictions:{petId}    → PetPrediction
 *   settings               → AppSettings
 */

import { get, set, del, keys } from 'idb-keyval';
import type {
  PetProfile,
  PetEvent,
  EventType,
  PetModelState,
  PetPrediction,
} from '../types';

// ─── AppSettings ─────────────────────────────────────────────

export interface AppSettings {
  activePetId: string | null;
  notificationsEnabled: boolean;
  /** Minutes before predicted event to fire a notification */
  notifyMinutesBefore: number;
  theme: 'dark';
  onboardingComplete: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  activePetId: null,
  notificationsEnabled: false,
  notifyMinutesBefore: 15,
  theme: 'dark',
  onboardingComplete: false,
};

// ─── ID Generation ────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID();
}

// ─── Key Helpers ──────────────────────────────────────────────

function petKey(petId: string): string {
  return `pets:${petId}`;
}

function eventsKey(petId: string): string {
  return `events:${petId}`;
}

function modelKey(petId: string): string {
  return `model:${petId}`;
}

function predictionsKey(petId: string): string {
  return `predictions:${petId}`;
}

// ─── Pets ─────────────────────────────────────────────────────

export async function savePet(pet: PetProfile): Promise<void> {
  await set(petKey(pet.id), pet);
}

export async function getPet(petId: string): Promise<PetProfile | undefined> {
  return get<PetProfile>(petKey(petId));
}

export async function getAllPets(): Promise<PetProfile[]> {
  const allKeys = await keys<string>();
  const petKeys = allKeys.filter((k) => k.startsWith('pets:'));

  const petPromises = petKeys.map((k) => get<PetProfile>(k));
  const pets = await Promise.all(petPromises);

  return pets
    .filter((p): p is PetProfile => p !== undefined)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function deletePet(petId: string): Promise<void> {
  // Remove all data associated with this pet atomically via Promise.all
  await Promise.all([
    del(petKey(petId)),
    del(eventsKey(petId)),
    del(modelKey(petId)),
    del(predictionsKey(petId)),
  ]);
}

// ─── Events ───────────────────────────────────────────────────

/**
 * Reads the current event array for a pet, appends the new event,
 * re-sorts by timestamp, and writes back atomically.
 */
export async function saveEvent(event: PetEvent): Promise<void> {
  const existing = await get<PetEvent[]>(eventsKey(event.petId));
  const events = existing ?? [];

  // Replace event if it already exists (idempotent upsert)
  const filtered = events.filter((e) => e.id !== event.id);
  filtered.push(event);
  filtered.sort((a, b) => a.timestamp - b.timestamp);

  await set(eventsKey(event.petId), filtered);
}

export async function getEvents(
  petId: string,
  since?: number,
): Promise<PetEvent[]> {
  const events = (await get<PetEvent[]>(eventsKey(petId))) ?? [];
  if (since === undefined) return events;
  return events.filter((e) => e.timestamp >= since);
}

export async function getEventsByType(
  petId: string,
  type: EventType,
  since?: number,
): Promise<PetEvent[]> {
  const events = await getEvents(petId, since);
  return events.filter((e) => e.type === type);
}

export async function getLastEvent(
  petId: string,
  type: EventType,
): Promise<PetEvent | undefined> {
  const events = await getEventsByType(petId, type);
  // Events are sorted ascending; last element is most recent
  return events.length > 0 ? events[events.length - 1] : undefined;
}

export async function getAllEvents(petId: string): Promise<PetEvent[]> {
  return getEvents(petId);
}

export async function deleteEvent(
  eventId: string,
  petId: string,
): Promise<void> {
  const events = (await get<PetEvent[]>(eventsKey(petId))) ?? [];
  const updated = events.filter((e) => e.id !== eventId);
  await set(eventsKey(petId), updated);
}

// ─── Model State ──────────────────────────────────────────────

export async function saveModelState(state: PetModelState): Promise<void> {
  await set(modelKey(state.petId), state);
}

export async function getModelState(
  petId: string,
): Promise<PetModelState | undefined> {
  return get<PetModelState>(modelKey(petId));
}

// ─── Predictions Cache ────────────────────────────────────────

export async function savePredictions(
  predictions: PetPrediction,
): Promise<void> {
  await set(predictionsKey(predictions.petId), predictions);
}

export async function getPredictions(
  petId: string,
): Promise<PetPrediction | undefined> {
  return get<PetPrediction>(predictionsKey(petId));
}

// ─── Settings ─────────────────────────────────────────────────

export async function saveSettings(settings: AppSettings): Promise<void> {
  await set('settings', settings);
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await get<AppSettings>('settings');
  if (!stored) return { ...DEFAULT_SETTINGS };
  // Merge with defaults to handle schema additions across app versions
  return { ...DEFAULT_SETTINGS, ...stored };
}
