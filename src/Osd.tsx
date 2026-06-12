import { useState, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { loadProfiles, loadEquippedProfileId, saveEquippedProfileId, DeckProfile, DEFAULT_PROFILE } from './store';
import { CURATED_ICONS, IconName } from './IconPicker';
import { obsService, ObsState } from './obsService';
import './App.css';

function Osd() {
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

            if (btn.action?.type === 'open_url' && btn.action.payload) {
              let target = btn.action.payload.trim();
              if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([/].*)?$/.test(target)) target = 'https://' + target;
              try { await open(target); } catch (e) { console.error("Failed to execute action via hotkey:", e); }
            } else if (btn.action?.type === 'open_folder' && btn.action.payload) {
              try {
                await saveEquippedProfileId(btn.action.payload);
                await emit('profile_updated');
              } catch (e) {
                console.error("Failed to swap profile folder via hotkey:", e);
              }
            } else if (btn.action?.type === 'type_text' && btn.action.payload) {
              try {
                await invoke('type_text', { text: btn.action.payload });
              } catch (e) {
                console.error("Failed to type text via hotkey:", e);
              }
            } else if (btn.action?.type === 'run_macro' && btn.action.payload) {
              try {
                await invoke('run_macro', { sequence: btn.action.payload });
              } catch (e) {
                console.error("Failed to run macro via hotkey:", e);
              }
            } else if (btn.action?.type === 'obs_switch_scene' && btn.action.payload) {
              await obsService.switchScene(btn.action.payload);
            } else if (btn.action?.type === 'obs_toggle_source' && btn.action.payload) {
              await obsService.toggleSource(undefined, btn.action.payload);
            } else if (btn.action?.type === 'obs_toggle_mute' && btn.action.payload) {
              await obsService.toggleMute(btn.action.payload);
            } else if (btn.action?.type === 'obs_toggle_stream') {
              await obsService.toggleStream();
            } else if (btn.action?.type === 'obs_toggle_record') {
              await obsService.toggleRecord();
            } else if (btn.action?.type === 'obs_toggle_virtual_cam') {
              await obsService.toggleVirtualCam();
            } else if (btn.action?.type === 'obs_take_screenshot' && btn.action.payload) {
              await obsService.takeScreenshot(btn.action.payload);
            }
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
              if (btnData?.action?.type === 'open_url' && btnData.action.payload) {
                let target = btnData.action.payload.trim();
                
                if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([/].*)?$/.test(target)) {
                  target = 'https://' + target;
                }

                try {
                  await open(target);
                } catch (e) {
                  console.error("Failed to execute action:", e);
                }
              } else if (btnData?.action?.type === 'open_folder' && btnData.action.payload) {
                try {
                  await saveEquippedProfileId(btnData.action.payload);
                  await emit('profile_updated');
                } catch (e) {
                  console.error("Failed to swap profile folder:", e);
                }
              } else if (btnData?.action?.type === 'type_text' && btnData.action.payload) {
                try {
                  await invoke('type_text', { text: btnData.action.payload });
                } catch (e) {
                  console.error("Failed to type text:", e);
                }
              } else if (btnData?.action?.type === 'run_macro' && btnData.action.payload) {
                try {
                  await invoke('run_macro', { sequence: btnData.action.payload });
                } catch (e) {
                  console.error("Failed to run macro:", e);
                }
              } else if (btnData?.action?.type === 'obs_switch_scene' && btnData.action.payload) {
                await obsService.switchScene(btnData.action.payload);
              } else if (btnData?.action?.type === 'obs_toggle_source' && btnData.action.payload) {
                await obsService.toggleSource(undefined, btnData.action.payload);
              } else if (btnData?.action?.type === 'obs_toggle_mute' && btnData.action.payload) {
                await obsService.toggleMute(btnData.action.payload);
              } else if (btnData?.action?.type === 'obs_toggle_stream') {
                await obsService.toggleStream();
              } else if (btnData?.action?.type === 'obs_toggle_record') {
                await obsService.toggleRecord();
              } else if (btnData?.action?.type === 'obs_toggle_virtual_cam') {
                await obsService.toggleVirtualCam();
              } else if (btnData?.action?.type === 'obs_take_screenshot' && btnData.action.payload) {
                await obsService.takeScreenshot(btnData.action.payload);
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
