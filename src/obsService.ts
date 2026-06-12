import OBSWebSocket from 'obs-websocket-js';
import { getStore } from './store';

export const obs = new OBSWebSocket();

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface ObsState {
  isRecording: boolean;
  isStreaming: boolean;
  isVirtualCamOn: boolean;
  currentScene: string;
  mutedInputs: Record<string, boolean>;
}

class OBSService {
  private status: ConnectionStatus = 'disconnected';
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];

  private obsState: ObsState = {
    isRecording: false,
    isStreaming: false,
    isVirtualCamOn: false,
    currentScene: '',
    mutedInputs: {}
  };
  private obsStateListeners: Array<(state: ObsState) => void> = [];

  constructor() {
    obs.on('ConnectionOpened', () => {
      this.setStatus('connected');
      this.fetchInitialState();
    });
    obs.on('ConnectionClosed', () => this.setStatus('disconnected'));
    obs.on('ConnectionError', () => this.setStatus('disconnected'));

    obs.on('RecordStateChanged', (data: any) => this.updateObsState({ isRecording: data.outputActive }));
    obs.on('StreamStateChanged', (data: any) => this.updateObsState({ isStreaming: data.outputActive }));
    obs.on('VirtualcamStateChanged', (data: any) => this.updateObsState({ isVirtualCamOn: data.outputActive }));
    obs.on('CurrentProgramSceneChanged', (data: any) => this.updateObsState({ currentScene: data.sceneName }));
    obs.on('InputMuteStateChanged', (data: any) => {
      this.updateObsState({
        mutedInputs: { ...this.obsState.mutedInputs, [data.inputName]: data.inputMuted }
      });
    });
  }

  public getObsState() { return this.obsState; }
  public onObsStateChange(listener: (state: ObsState) => void) {
    this.obsStateListeners.push(listener);
    return () => { this.obsStateListeners = this.obsStateListeners.filter(l => l !== listener); };
  }
  private updateObsState(partial: Partial<ObsState>) {
    this.obsState = { ...this.obsState, ...partial };
    this.obsStateListeners.forEach(l => l(this.obsState));
  }

  private async fetchInitialState() {
    if (this.status !== 'connected') return;
    try {
      const [
        recordStatus, 
        streamStatus, 
        vcamStatus, 
        { currentProgramSceneName }, 
        { inputs }
      ] = await Promise.all([
        obs.call('GetRecordStatus'),
        obs.call('GetStreamStatus'),
        obs.call('GetVirtualCamStatus'),
        obs.call('GetCurrentProgramScene'),
        obs.call('GetInputList')
      ]);

      const mutedInputs: Record<string, boolean> = {};
      for (const input of inputs) {
        try {
          const { inputMuted } = await obs.call('GetInputMute', { inputName: input.inputName as string });
          mutedInputs[input.inputName as string] = inputMuted;
        } catch(e) {}
      }

      this.updateObsState({
        isRecording: !!recordStatus.outputActive,
        isStreaming: !!streamStatus.outputActive,
        isVirtualCamOn: !!vcamStatus.outputActive,
        currentScene: currentProgramSceneName,
        mutedInputs
      });
    } catch (e) {
      console.error("Failed to fetch initial OBS state", e);
    }
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
