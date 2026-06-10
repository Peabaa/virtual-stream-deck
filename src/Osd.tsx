import { useState, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { loadProfiles, loadEquippedProfileId, saveEquippedProfileId, DeckProfile, DEFAULT_PROFILE } from './store';
import { CURATED_ICONS, IconName } from './IconPicker';
import './App.css';

function Osd() {
  const [profile, setProfile] = useState<DeckProfile>(DEFAULT_PROFILE);
  const registeredHotkeysRef = useRef<string[]>([]);

  const fetchProfile = async () => {
    const eqId = await loadEquippedProfileId();
    const profilesList = await loadProfiles();
    const p = profilesList[eqId] || DEFAULT_PROFILE;
    setProfile(p);
    setupHotkeys(p);
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
          
          await register(btn.triggerHotkey, async (event) => {
            if (event.state !== "Pressed") return;

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
      // Clean up global shortcuts when OSD unmounts
      registeredHotkeysRef.current.forEach(hk => {
        if(hk) unregister(hk).catch(()=>{});
      });
    };
  }, []);

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
              }
            };

            return (
              <button 
                key={id} 
                onClick={handleAction}
                className="deck-button"
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
