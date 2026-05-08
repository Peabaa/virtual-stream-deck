import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { loadProfiles, loadEquippedProfileId, DeckProfile, DEFAULT_PROFILE } from './store';
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
    // Unregister old button hotkeys
    for (const hk of registeredHotkeysRef.current) {
      if (hk) {
        try { await unregister(hk); } catch(e) {}
      }
    }
    registeredHotkeysRef.current = [];

    const newHotkeys: string[] = [];

    // Register new hotkeys for every button that has one
    for (const id in p.buttons) {
      const btn = p.buttons[id];
      if (btn.triggerHotkey) {
        try {
          const registered = await isRegistered(btn.triggerHotkey);
          if (registered) await unregister(btn.triggerHotkey).catch(()=>{});
          
          await register(btn.triggerHotkey, async (event) => {
            if (event.state !== "Pressed") return;

            // Check if the user requires the OSD to be visible for hotkeys to work
            if (p.requireOsdVisible) {
              const osdWindow = await WebviewWindow.getByLabel('osd');
              if (osdWindow) {
                const isVisible = await osdWindow.isVisible();
                if (!isVisible) return; // Abort execution
              }
            }

            // Execute the action payload silently in the background
            if (btn.action?.type === 'open_url' && btn.action.payload) {
              let target = btn.action.payload.trim();
              if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([/].*)?$/.test(target)) {
                target = 'https://' + target;
              }
              try {
                await open(target);
              } catch (e) {
                console.error("Failed to execute action via hotkey:", e);
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

    // Fallback: forcefully fetch the latest profile whenever the OSD window gains focus/visibility
    const handleFocus = () => fetchProfile();
    window.addEventListener('focus', handleFocus);

    return () => {
      unlisten.then(f => f());
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
        <span>Numpad Deck</span>
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
                
                // If it looks like a domain (e.g. youtube.com) and has no protocol, automatically add https://
                if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([/].*)?$/.test(target)) {
                  target = 'https://' + target;
                }

                try {
                  await open(target);
                } catch (e) {
                  console.error("Failed to execute action:", e);
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
                }}
              >
                {btnData?.label || id}
              </button>
            );
          })
        ))}
      </div>
    </main>
  );
}

export default Osd;
