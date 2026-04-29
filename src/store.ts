import { load, Store } from '@tauri-apps/plugin-store';

export type ActionType = 'none' | 'open_url';

export interface DeckButtonAction {
  type: ActionType;
  payload: string;
}

export interface DeckButtonData {
  id: string; // Format: "x,y" (e.g. "0,0")
  label: string;
  color: string;
  action?: DeckButtonAction;
}

export interface DeckProfile {
  id: string;
  name: string;
  rows: number;
  columns: number;
  buttons: Record<string, DeckButtonData>; // Mapping of coordinate ID to button data
}

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

// MULTI-PROFILE STORAGE API
export async function loadProfiles(): Promise<Record<string, DeckProfile>> {
  const store = await getStore();
  try { await store.reload(); } catch (e) {} // Ensure fresh read
  const profiles = await store.get<Record<string, DeckProfile>>('profiles');
  
  if (!profiles || Object.keys(profiles).length === 0) {
    return { 'default': DEFAULT_PROFILE };
  }
  return profiles;
}

export async function saveProfiles(profiles: Record<string, DeckProfile>) {
  const store = await getStore();
  await store.set('profiles', profiles);
  await store.save();
}

export async function loadEquippedProfileId(): Promise<string> {
  const store = await getStore();
  try { await store.reload(); } catch (e) {}
  const equippedId = await store.get<string>('equippedProfileId');
  return equippedId || 'default';
}

export async function saveEquippedProfileId(id: string) {
  const store = await getStore();
  await store.set('equippedProfileId', id);
  await store.save();
}
