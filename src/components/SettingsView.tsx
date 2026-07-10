
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
      <h2 style={{ margin: '0 0 10px 0' }}>Global Settings</h2>
      
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
        </h3>
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
