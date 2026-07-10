import { useState, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { loadProfiles, loadEquippedProfileId, saveEquippedProfileId, loadBaseProfileId, DeckProfile, DEFAULT_PROFILE, DeckButtonAction } from './store';
import { CURATED_ICONS, IconName } from './IconPicker';
import { obsService, ObsState } from './obsService';
import { useToast } from './components/ToastContext';
import './App.css';

function Osd() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<DeckProfile>(DEFAULT_PROFILE);
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);
  const [obsState, setObsState] = useState<ObsState>(obsService.getObsState());
  const registeredHotkeysRef = useRef<string[]>([]);

  const fetchProfile = async () => {
    const eqId = await loadEquippedProfileId();
    const profilesList = await loadProfiles();
    const p = profilesList[eqId] || DEFAULT_PROFILE;
    setProfile(p);
    setupHotkeys(p);
    
    // Also ensure OBS is connected with the latest settings
    if (obsService.getStatus() !== 'connected') {
      obsService.connect().catch(e => console.error("OBS Connection failed", e));
    }
  };

  useEffect(() => {
    const unlistenWindow = listen<string>('active-window-changed', async (event) => {
      const exeName = event.payload;
      console.log('Active window changed:', exeName);
      
      const allProfiles = await loadProfiles();
      const currentEquippedId = await loadEquippedProfileId();
      
      // Find a profile that links to this exe
      let matchedProfileId = null;
      for (const p of Object.values(allProfiles)) {
        if (p.linkedApp && p.linkedApp.toLowerCase() === exeName.toLowerCase()) {
          matchedProfileId = p.id;
          break;
        }
      }

      if (matchedProfileId) {
        if (matchedProfileId !== currentEquippedId) {
          console.log(`Auto-switching to profile ${matchedProfileId} for ${exeName}`);
          await saveEquippedProfileId(matchedProfileId);
          fetchProfile();
        }
      } else {
        const baseId = await loadBaseProfileId();
        if (currentEquippedId !== baseId) {
          console.log(`Auto-switching back to base profile ${baseId}`);
          await saveEquippedProfileId(baseId);
          fetchProfile();
        }
      }
    });

    return () => {
      unlistenWindow.then(f => f());
    };
  }, []);

  const executeActionSequence = async (actions: DeckButtonAction[]) => {
    for (const act of actions) {
      if (!act) continue;
      try {
        if (act.type === 'delay') {
          const ms = parseInt(act.payload, 10) || 0;
          if (ms > 0) {
            await new Promise(r => setTimeout(r, ms));
          }
        } else if (act.type === 'open_url' && act.payload) {
          let target = act.payload.trim();
          if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([/].*)?$/.test(target)) target = 'https://' + target;
          await open(target);
        } else if (act.type === 'open_folder' && act.payload) {
          await saveEquippedProfileId(act.payload);
          await emit('profile_updated');
        } else if (act.type === 'type_text' && act.payload) {
          await invoke('type_text', { text: act.payload });
        } else if (act.type === 'run_macro' && act.payload) {
          await invoke('run_macro', { sequence: act.payload });
        } else if (act.type === 'obs_switch_scene' && act.payload) {
          await obsService.switchScene(act.payload);
        } else if (act.type === 'obs_toggle_source' && act.payload) {
          await obsService.toggleSource(undefined, act.payload);
        } else if (act.type === 'obs_toggle_mute' && act.payload) {
          await obsService.toggleMute(act.payload);
        } else if (act.type === 'obs_toggle_stream') {
          await obsService.toggleStream();
        } else if (act.type === 'obs_toggle_record') {
          await obsService.toggleRecord();
        } else if (act.type === 'obs_toggle_virtual_cam') {
          await obsService.toggleVirtualCam();
        } else if (act.type === 'obs_take_screenshot' && act.payload) {
          await obsService.takeScreenshot(act.payload);
        } else if (act.type === 'sys_volume_up') {
          await invoke('trigger_sys_key', { keyCode: 175 });
        } else if (act.type === 'sys_volume_down') {
          await invoke('trigger_sys_key', { keyCode: 174 });
        } else if (act.type === 'sys_volume_mute') {
          await invoke('trigger_sys_key', { keyCode: 173 });
        } else if (act.type === 'sys_media_play_pause') {
          await invoke('trigger_sys_key', { keyCode: 179 });
        } else if (act.type === 'sys_media_next') {
          await invoke('trigger_sys_key', { keyCode: 176 });
        } else if (act.type === 'sys_media_prev') {
          await invoke('trigger_sys_key', { keyCode: 177 });
        } else if (act.type === 'sys_send_keypress' && act.payload) {
          try {
            const parsed = JSON.parse(act.payload);
            if (parsed.modifiers && parsed.modifiers.length > 0) {
              await invoke('trigger_sys_combo', { modifiers: parsed.modifiers, keyCode: parseInt(parsed.key, 10) });
            } else {
              await invoke('trigger_sys_key', { keyCode: parseInt(parsed.key || parsed, 10) });
            }
          } catch (e) {
            await invoke('trigger_sys_key', { keyCode: parseInt(act.payload, 10) });
          }
        }
      } catch (err) {
        console.error(`Failed to execute action ${act.type}:`, err);
        showToast(`Action Failed: ${act.type}`, 'error');
      }
    }
  };

  const setupHotkeys = async (p: DeckProfile) => {
    for (const hk of registeredHotkeysRef.current) {
      if (hk) {
        try { await unregister(hk); } catch(e) {}
      }
    }
    registeredHotkeysRef.current = [];

    const newHotkeys: string[] = [];

    for (const id in p.buttons) {
      const btn = p.buttons[id];
      if (btn.triggerHotkey) {
        try {
          const registered = await isRegistered(btn.triggerHotkey);
          if (registered) await unregister(btn.triggerHotkey).catch(()=>{});
          
          let isHeld = false;
          await register(btn.triggerHotkey, async (event) => {
            if (event.state === "Released") {
              isHeld = false;
              return;
            }
            if (event.state === "Pressed") {
              if (isHeld) return; // Prevent OS auto-repeat from triggering multiple times
              isHeld = true;
            }

            // Trigger visual glow
            setActiveButtonId(id);
            setTimeout(() => {
              setActiveButtonId(prev => prev === id ? null : prev);
            }, 150);

            if (p.requireOsdVisible) {
              const osdWindow = await WebviewWindow.getByLabel('osd');
              if (osdWindow) {
                const isVisible = await osdWindow.isVisible();
                if (!isVisible) return; 
              }
            }

            const actionsToRun = btn.actions || (btn.action ? [btn.action] : []);
            await executeActionSequence(actionsToRun);
          });
          newHotkeys.push(btn.triggerHotkey);
        } catch (e) {
          console.error("Failed to register button hotkey", btn.triggerHotkey, e);
        }
      }
    }
    registeredHotkeysRef.current = newHotkeys;
  };

  useEffect(() => {
    fetchProfile();
    obsService.connect().catch(e => console.error("OBS Connection failed on mount", e));
    
    const unlistenObs = obsService.onObsStateChange(setObsState);

    // Listen for updates from the Dashboard
    const unlisten = listen('profile_updated', () => {
      fetchProfile();
    });

    const unlistenPause = listen('pause_hotkeys', async () => {
      for (const hk of registeredHotkeysRef.current) {
        if(hk) await unregister(hk).catch(()=>{});
      }
    });

    const unlistenResume = listen('resume_hotkeys', () => {
      fetchProfile();
    });

    // Fallback: forcefully fetch the latest profile whenever the OSD window gains focus/visibility
    const handleFocus = () => fetchProfile();
    window.addEventListener('focus', handleFocus);

    return () => {
      unlisten.then(f => f());
      unlistenPause.then(f => f());
      unlistenResume.then(f => f());
      window.removeEventListener('focus', handleFocus);
      unlistenObs();
      // Clean up global shortcuts when OSD unmounts
      registeredHotkeysRef.current.forEach(hk => {
        if(hk) unregister(hk).catch(()=>{});
      });
    };
  }, []);

  const getStateCssClass = (btnData: any) => {
    if (!btnData?.action) return '';
    switch (btnData.action.type) {
      case 'obs_toggle_record': return obsState.isRecording ? 'state-pulse-red' : '';
      case 'obs_toggle_stream': return obsState.isStreaming ? 'state-pulse-red' : '';
      case 'obs_toggle_virtual_cam': return obsState.isVirtualCamOn ? 'state-pulse-blue' : '';
      case 'obs_switch_scene': return obsState.currentScene === btnData.action.payload ? 'state-pulse-blue' : '';
      case 'obs_toggle_mute': return obsState.mutedInputs[btnData.action.payload || ''] === true ? 'state-pulse-yellow' : '';
      default: return '';
    }
  };

  return (
    <main data-tauri-drag-region className="deck-container">
      <div className="status-bar">
        <span>{profile.name}</span>
        <div className="dot" />
      </div>

      <div 
        className="button-grid" 
        style={{ 
          gridTemplateColumns: `repeat(${profile.columns}, 1fr)`,
          gridTemplateRows: `repeat(${profile.rows}, 1fr)` // Keep rows evenly distributed
        }}
      >
        {Array.from({ length: profile.rows }).map((_, y) => (
          Array.from({ length: profile.columns }).map((_, x) => {
            const id = `${x},${y}`;
            const btnData = profile.buttons[id];
            const handleAction = async () => {
              if (btnData) {
                const actionsToRun = btnData.actions || (btnData.action ? [btnData.action] : []);
                await executeActionSequence(actionsToRun);
              }
            };

            const stateCssClass = getStateCssClass(btnData);

            return (
              <button 
                key={id} 
                onClick={handleAction}
                className={`deck-button ${activeButtonId === id ? 'active-simulated' : ''} ${stateCssClass}`}
                style={{
                  backgroundColor: btnData?.color || 'rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  overflow: 'hidden',
                  padding: '5px'
                }}
              >
                {btnData?.imageUrl ? (
                  <img src={btnData.imageUrl} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                ) : btnData?.iconName && CURATED_ICONS[btnData.iconName as IconName] ? (
                  <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                      const Icon = CURATED_ICONS[btnData.iconName as IconName];
                      return <Icon size={36} color={btnData.fontColor || 'white'} />;
                    })()}
                  </div>
                ) : null}
                <span style={{ 
                  fontSize: '0.9rem', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  maxWidth: '100%',
                  color: btnData?.fontColor || 'white'
                }}>
                  {btnData?.label || id}
                </span>
              </button>
            );
          })
        ))}
      </div>
    </main>
  );
}

export default Osd;
