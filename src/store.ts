import { load, Store } from '@tauri-apps/plugin-store';

export interface DeckButtonData {
  id: string; // Format: "x,y" (e.g. "0,0")
  label: string;
  color: string;
}

export interface DeckProfile {
  id: string;
  name: string;
  rows: number;
  columns: number;
  buttons: Record<string, DeckButtonData>; // Mapping of coordinate ID to button data
}

// A default 3x3 profile if nothing exists
export const DEFAULT_PROFILE: DeckProfile = {
  id: 'default',
  name: 'Default Numpad',
  rows: 3,
  columns: 3,
  buttons: {}
};

let storeInstance: Store | null = null;

export async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load('profiles.json', { autoSave: false });
  }
  return storeInstance;
}

export async function loadActiveProfile(): Promise<DeckProfile> {
  const store = await getStore();
  // Force a reload from disk to ensure cross-window sync
  try { await store.reload(); } catch (e) {}
  const profile = await store.get<DeckProfile>('activeProfile');
  return profile || DEFAULT_PROFILE;
}

export async function saveActiveProfile(profile: DeckProfile) {
  const store = await getStore();
  await store.set('activeProfile', profile);
  await store.save();
}
