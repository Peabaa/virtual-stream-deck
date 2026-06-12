import { DeckButtonData } from './store';
import { ObsState } from './obsService';

export function isButtonActive(button: DeckButtonData | undefined, obsState: ObsState): boolean {
  if (!button || !button.action) return false;
  
  switch (button.action.type) {
    case 'obs_toggle_record':
      return obsState.isRecording;
    case 'obs_toggle_stream':
      return obsState.isStreaming;
    case 'obs_toggle_virtual_cam':
      return obsState.isVirtualCamOn;
    case 'obs_switch_scene':
      return obsState.currentScene === button.action.payload;
    case 'obs_toggle_mute':
      return !!obsState.mutedInputs[button.action.payload];
    default:
      return false;
  }
}
