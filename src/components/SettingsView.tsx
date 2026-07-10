
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import HotkeyInput from '../HotkeyInput';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { obsService, ConnectionStatus } from '../obsService';
import { DeckProfile } from '../store';

interface SettingsViewProps {
  draftProfile: DeckProfile;
  updateDraft: (draft: DeckProfile) => void;
  runOnStartup: boolean;
  setRunOnStartup: (val: boolean) => void;
  obsStatus: ConnectionStatus;
  obsUrl: string;
  setObsUrl: (val: string) => void;
  obsPassword: string;
  setObsPassword: (val: string) => void;
  hasUnsavedChanges: boolean;
  handleDiscardChanges: () => void;
  handleSaveProfile: () => Promise<void>;
}

export function SettingsView({
  draftProfile, updateDraft, runOnStartup, setRunOnStartup,
  obsStatus, obsUrl, setObsUrl, obsPassword, setObsPassword,
  hasUnsavedChanges, handleDiscardChanges, handleSaveProfile
}: SettingsViewProps) {
  const [showObsGuide, setShowObsGuide] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true); // Default true so it doesn't flash

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const adminStatus = await invoke<boolean>('is_admin');
        setIsAdmin(adminStatus);
      } catch (e) {
        console.error("Failed to check admin status:", e);
      }
    };
    checkAdmin();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
      <h2 style={{ margin: '0 0 10px 0' }}>Global Settings</h2>
      
      {!isAdmin && (
        <div style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)', padding: '15px', borderRadius: '12px', border: '1px solid #f44336', color: '#ffcdd2', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ fontSize: '24px' }}>⚠️</div>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#f44336' }}>Admin Privileges Recommended</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
              Virtual Stream Deck is currently running as a normal user. Some full-screen games (especially those with anti-cheat) will block simulated keystrokes. If your macros are failing in-game, please restart this app as an <b>Administrator</b>.
            </p>
          </div>
        </div>
      )}

      <div style={{ padding: '25px', backgroundColor: 'rgba(30,30,35,0.6)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '1rem', fontWeight: 'bold', marginBottom: '8px' }}>OSD Toggle Hotkey</label>
          <HotkeyInput 
            value={draftProfile.osdHotkey || ''} 
            onChange={val => updateDraft({ ...draftProfile, osdHotkey: val })} 
          />
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#888' }}>Must be saved and equipped to take effect.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            id="requireOsdVisible"
            checked={!!draftProfile.requireOsdVisible}
            onChange={e => updateDraft({ ...draftProfile, requireOsdVisible: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="requireOsdVisible" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>
            Require Virtual Deck Overlay to be visible for hotkeys to work
          </label>
        </div>
      </div>

      <div style={{ padding: '25px', backgroundColor: 'rgba(30,30,35,0.6)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>System Preferences</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            id="runOnStartup"
            checked={runOnStartup}
            onChange={async (e) => {
              const checked = e.target.checked;
              setRunOnStartup(checked);
              if (checked) {
                await enable();
              } else {
                await disable();
              }
            }}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="runOnStartup" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>
            Run on System Startup (Background)
          </label>
        </div>
      </div>

      <div style={{ padding: '25px', backgroundColor: 'rgba(30,30,35,0.6)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          OBS Studio Connection
          <span style={{ 
            fontSize: '0.8rem', 
            padding: '4px 10px', 
            borderRadius: '12px', 
            backgroundColor: obsStatus === 'connected' ? 'rgba(46, 125, 50, 0.5)' : (obsStatus === 'connecting' ? 'rgba(245, 124, 0, 0.5)' : 'rgba(211, 47, 47, 0.5)'),
            border: `1px solid ${obsStatus === 'connected' ? '#4caf50' : (obsStatus === 'connecting' ? '#ff9800' : '#f44336')}`,
            color: 'white'
          }}>
            {obsStatus.toUpperCase()}
          </span>
          <button 
            onClick={() => setShowObsGuide(!showObsGuide)}
            style={{ marginLeft: 'auto', backgroundColor: 'transparent', border: '1px solid #555', color: '#ccc', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontSize: '0.8rem' }}
          >
            {showObsGuide ? 'Hide Guide' : 'Need Help?'}
          </button>
        </h3>
        
        {showObsGuide && (
          <div style={{ backgroundColor: 'rgba(57, 108, 216, 0.1)', border: '1px solid rgba(57, 108, 216, 0.3)', padding: '15px', borderRadius: '8px', marginBottom: '15px', color: '#ccc', fontSize: '0.9rem', lineHeight: '1.5' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#74b9ff' }}>How to connect OBS Studio:</h4>
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Open OBS Studio and click <b>Tools {'>'} WebSocket Server Settings</b>.</li>
              <li>Check the box for <b>Enable WebSocket server</b>.</li>
              <li>Make sure the Server Port matches (usually <b>4455</b>).</li>
              <li>Click <b>Show Connect Info</b> to reveal your Server Password.</li>
              <li>Copy the port and password into the fields below.</li>
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>WebSocket URL</label>
            <input 
              type="text" 
              placeholder="ws://127.0.0.1:4455"
              value={obsUrl} 
              onChange={e => setObsUrl(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box', backgroundColor: 'rgba(15,15,20,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>Password</label>
            <input 
              type="password" 
              placeholder="OBS WebSocket Password (if any)"
              value={obsPassword} 
              onChange={e => setObsPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box', backgroundColor: 'rgba(15,15,20,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={async () => {
                try {
                  await obsService.saveSettings(obsUrl, obsPassword);
                  await obsService.connect();
                } catch (err: any) {
                  alert("OBS Connection Failed: " + (err.message || JSON.stringify(err) || String(err)));
                }
              }}
              disabled={obsStatus === 'connected'}
              style={{ flex: 1, padding: '10px', cursor: obsStatus === 'connected' ? 'not-allowed' : 'pointer', backgroundColor: obsStatus === 'connected' ? '#333' : '#396cd8', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              Connect
            </button>
            <button 
              onClick={() => obsService.disconnect()}
              disabled={obsStatus === 'disconnected'}
              style={{ flex: 1, padding: '10px', cursor: obsStatus === 'disconnected' ? 'not-allowed' : 'pointer', backgroundColor: obsStatus === 'disconnected' ? '#333' : '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '15px' }}>
         {hasUnsavedChanges && (
           <button 
             onClick={handleDiscardChanges} 
             style={{ 
               padding: '10px 20px', 
               cursor: 'pointer',
               backgroundColor: '#444',
               color: 'white',
               border: 'none',
               borderRadius: '8px',
               fontWeight: 'bold',
               transition: 'all 0.2s'
             }}
           >
             Discard Changes
           </button>
         )}
         <button 
            onClick={handleSaveProfile} 
            disabled={!hasUnsavedChanges}
            style={{ 
              padding: '10px 20px', 
              cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
              backgroundColor: hasUnsavedChanges ? '#4caf50' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            {hasUnsavedChanges ? "💾 Save All Changes" : "Everything is Saved"}
          </button>
      </div>
    </div>
  );
}
