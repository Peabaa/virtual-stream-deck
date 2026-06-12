import OBSWebSocket from 'obs-websocket-js';
import { getStore } from './store';

export const obs = new OBSWebSocket();

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

class OBSService {
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];

  constructor() {
    obs.on('ConnectionOpened', () => this.setStatus('connected'));
    obs.on('ConnectionClosed', () => this.setStatus('disconnected'));
    obs.on('ConnectionError', () => this.setStatus('disconnected'));
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach(listener => listener(newStatus));
    }
  }

  public getStatus() {
    return this.status;
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void) {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  public async loadSettings() {
    const store = await getStore();
    try { await store.reload(); } catch (e) {}
    const settings = await store.get<{ url?: string; password?: string }>('obsSettings');
    return settings || { url: 'ws://127.0.0.1:4455', password: '' };
  }

  public async saveSettings(url: string, password?: string) {
    const store = await getStore();
    await store.set('obsSettings', { url, password });
    await store.save();
  }

  public async connect() {
    if (this.status === 'connected') return;
    this.setStatus('connecting');
    try {
      const settings = await this.loadSettings();
      const url = settings.url || 'ws://127.0.0.1:4455';
      await obs.connect(url, settings.password || undefined);
    } catch (e) {
      this.setStatus('disconnected');
      console.error('Failed to connect to OBS:', e);
      throw e;
    }
  }

  public async disconnect() {
    if (this.status === 'disconnected') return;
    try {
      await obs.disconnect();
    } catch (e) {
      console.error('Failed to disconnect from OBS:', e);
    }
    this.setStatus('disconnected');
  }

  // --- Actions ---

  public async switchScene(sceneName: string) {
    if (this.status !== 'connected' || !sceneName) return;
    await obs.call('SetCurrentProgramScene', { sceneName });
  }

  public async toggleMute(inputName: string) {
    if (this.status !== 'connected' || !inputName) return;
    await obs.call('ToggleInputMute', { inputName });
  }

  public async toggleSource(sceneName: string | undefined, sourceName: string) {
    if (this.status !== 'connected' || !sourceName) return;
    
    let targetScene = sceneName;
    if (!targetScene) {
      const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
      targetScene = currentProgramSceneName;
    }

    try {
      // Need to get scene item id first
      const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: targetScene });
      const item = sceneItems.find((i: any) => i.sourceName === sourceName);
      
      if (item) {
        const itemId = item.sceneItemId as number;
        const { sceneItemEnabled } = await obs.call('GetSceneItemEnabled', { sceneName: targetScene, sceneItemId: itemId });
        await obs.call('SetSceneItemEnabled', { sceneName: targetScene, sceneItemId: itemId, sceneItemEnabled: !sceneItemEnabled });
      } else {
        console.warn(`Source ${sourceName} not found in scene ${targetScene}`);
      }
    } catch (e) {
      console.error(`Failed to toggle source ${sourceName} in scene ${targetScene}:`, e);
    }
  }

  public async toggleStream() {
    if (this.status !== 'connected') return;
    await obs.call('ToggleStream');
  }

  public async toggleRecord() {
    if (this.status !== 'connected') return;
    await obs.call('ToggleRecord');
  }

  public async toggleVirtualCam() {
    if (this.status !== 'connected') return;
    await obs.call('ToggleVirtualCam');
  }

  public async takeScreenshot(folderPath: string) {
    if (this.status !== 'connected' || !folderPath) return;
    
    try {
      const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dir = folderPath.replace(/[/\\]$/, '');
      const imageFilePath = `${dir}\\Screenshot_${timestamp}.png`;
      
      await obs.call('SaveSourceScreenshot', {
        sourceName: currentProgramSceneName,
        imageFormat: 'png',
        imageFilePath
      });
    } catch (e) {
      console.error('Failed to take screenshot:', e);
    }
  }
}

export const obsService = new OBSService();
