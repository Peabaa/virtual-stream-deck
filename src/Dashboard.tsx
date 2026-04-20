import { useState, useEffect } from 'react';
import HotkeyInput from './HotkeyInput';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

function Dashboard() {
  const [osdHotkey, setOsdHotkey] = useState<string>('');

  useEffect(() => {
    let activeHotkey = osdHotkey;

    const setupShortcut = async () => {
      try {
        if (!activeHotkey) return;
        
        // During development, Vite hot-reloading keeps the Rust backend alive.
        // If it's already registered, we try to unregister it to clean up stale JS callbacks.
        const registered = await isRegistered(activeHotkey);
        if (registered) {
          await unregister(activeHotkey).catch(() => {});
        }
        
        await register(activeHotkey, async (event) => {
          // Tauri global-shortcut fires for both KeyDown and KeyUp events.
          // We only want to toggle the window when the key is pressed down.
          if (event.state !== "Pressed") return;

          console.log(`Shortcut triggered globally: ${activeHotkey}`);
          
          try {
            const osdWindow = await WebviewWindow.getByLabel('osd');
            if (osdWindow) {
              const isVisible = await osdWindow.isVisible();
              if (isVisible) {
                await osdWindow.hide();
              } else {
                await osdWindow.show();
                await osdWindow.setFocus();
              }
            }
          } catch (e) {
            console.error("Error accessing osd window:", e);
          }
        });
        console.log(`Successfully registered shortcut: ${activeHotkey}`);
      } catch (err) {
        // Suppress the error log if it's just the hot-reloader failing to unregister a ghost lock
        if (String(err).includes("already registered")) {
           console.warn(`Hotkey ${activeHotkey} is locked by the Rust backend due to hot-reloading. You'll need to restart the app (close the window and run start again) to bind a new Javascript callback to it.`);
        } else {
           console.error('Failed to register shortcut:', err);
        }
      }
    };

    setupShortcut();

    return () => {
      if (activeHotkey) {
        unregister(activeHotkey).catch(console.error);
      }
    };
  }, [osdHotkey]);

  return (
    <div style={{ 
      padding: '20px', 
      color: 'white', 
      fontFamily: 'sans-serif',
      backgroundColor: '#1a1a1a', 
      width: '100vw',
      height: '100vh',
      boxSizing: 'border-box'
    }}>
      <h1>Virtual Stream Deck Dashboard</h1>
      <p>This is where we will manage profiles and grid layouts.</p>

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#222', borderRadius: '12px', border: '1px solid #333' }}>
        <h3 style={{ marginTop: 0 }}>Global Settings</h3>
        <p style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '20px' }}>
          Assign a hotkey to show or hide the virtual stream deck from anywhere.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <label style={{ fontWeight: 'bold' }}>OSD Toggle Hotkey:</label>
          <HotkeyInput 
            value={osdHotkey} 
            onChange={setOsdHotkey} 
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
