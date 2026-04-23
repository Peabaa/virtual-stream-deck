import { useState, useEffect } from 'react';
import HotkeyInput from './HotkeyInput';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit } from '@tauri-apps/api/event';
import { loadActiveProfile, saveActiveProfile, DeckProfile, DeckButtonData, DEFAULT_PROFILE } from './store';

function Dashboard() {
  const [osdHotkey, setOsdHotkey] = useState<string>('');
  const [profile, setProfile] = useState<DeckProfile>(DEFAULT_PROFILE);
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);

  // Load profile on mount
  useEffect(() => {
    loadActiveProfile().then(p => setProfile(p));
  }, []);

  // Hotkey hook logic...
  useEffect(() => {
    let activeHotkey = osdHotkey;
    const setupShortcut = async () => {
      try {
        if (!activeHotkey) return;
        const registered = await isRegistered(activeHotkey);
        if (registered) await unregister(activeHotkey).catch(() => {});
        
        await register(activeHotkey, async (event) => {
          if (event.state !== "Pressed") return;
          try {
            const osdWindow = await WebviewWindow.getByLabel('osd');
            if (osdWindow) {
              const isVisible = await osdWindow.isVisible();
              if (isVisible) await osdWindow.hide();
              else {
                await osdWindow.show();
                await osdWindow.setFocus();
              }
            }
          } catch (e) { console.error("Error accessing osd window:", e); }
        });
      } catch (err) { console.error('Failed to register shortcut:', err); }
    };
    setupShortcut();
    return () => { if (activeHotkey) unregister(activeHotkey).catch(console.error); };
  }, [osdHotkey]);

  // Handle saving profile changes
  const handleSaveProfile = async (newProfile: DeckProfile) => {
    setProfile(newProfile);
    await saveActiveProfile(newProfile);
    // Tell the OSD window to reload its profile
    await emit('profile_updated');
  };

  const handleDimensionChange = (key: 'rows' | 'columns', val: number) => {
    if (val < 1 || val > 12) return;
    handleSaveProfile({ ...profile, [key]: val });
    setSelectedButtonId(null);
  };

  const handleButtonUpdate = (id: string, updates: Partial<DeckButtonData>) => {
    const existing = profile.buttons[id] || { id, label: id, color: 'rgba(255, 255, 255, 0.08)' };
    const newButtons = { ...profile.buttons, [id]: { ...existing, ...updates } };
    handleSaveProfile({ ...profile, buttons: newButtons });
  };

  const selectedButtonData = selectedButtonId 
    ? (profile.buttons[selectedButtonId] || { id: selectedButtonId, label: selectedButtonId, color: 'rgba(255, 255, 255, 0.08)' })
    : null;

  return (
    <div style={{ padding: '20px', color: 'white', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', width: '100vw', height: '100vh', boxSizing: 'border-box', overflowY: 'auto' }}>
      <h1>Virtual Stream Deck Dashboard</h1>
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        
        {/* Left Column: Grid Editor Canvas */}
        <div style={{ flex: 2, padding: '20px', backgroundColor: '#222', borderRadius: '12px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Grid Layout</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label>Cols:</label>
              <input type="number" value={profile.columns} onChange={e => handleDimensionChange('columns', parseInt(e.target.value))} style={{ width: '50px' }} />
              <label>Rows:</label>
              <input type="number" value={profile.rows} onChange={e => handleDimensionChange('rows', parseInt(e.target.value))} style={{ width: '50px' }} />
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${profile.columns}, 1fr)`, 
            gap: '10px',
            backgroundColor: '#111',
            padding: '20px',
            borderRadius: '8px'
          }}>
            {Array.from({ length: profile.rows }).map((_, y) => (
              Array.from({ length: profile.columns }).map((_, x) => {
                const id = `${x},${y}`;
                const btnData = profile.buttons[id];
                const isSelected = selectedButtonId === id;
                return (
                  <button 
                    key={id}
                    onClick={() => setSelectedButtonId(id)}
                    style={{
                      aspectRatio: '1 / 1',
                      backgroundColor: btnData?.color || 'rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      border: isSelected ? '2px solid #396cd8' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {btnData?.label || id}
                  </button>
                );
              })
            ))}
          </div>
        </div>

        {/* Right Column: Settings & Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ padding: '20px', backgroundColor: '#222', borderRadius: '12px', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0 }}>Global Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.9rem', color: '#aaa' }}>OSD Toggle Hotkey:</label>
              <HotkeyInput value={osdHotkey} onChange={setOsdHotkey} />
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#222', borderRadius: '12px', border: '1px solid #333', flexGrow: 1 }}>
            <h3 style={{ marginTop: 0 }}>Button Editor</h3>
            {selectedButtonData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <p style={{ margin: 0, color: '#aaa' }}>Editing Button [{selectedButtonData.id}]</p>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Label</label>
                  <input 
                    type="text" 
                    value={selectedButtonData.label} 
                    onChange={e => handleButtonUpdate(selectedButtonData.id, { label: e.target.value })}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Color</label>
                  <input 
                    type="color" 
                    value={selectedButtonData.color.startsWith('#') ? selectedButtonData.color : '#333333'} 
                    onChange={e => handleButtonUpdate(selectedButtonData.id, { color: e.target.value })}
                    style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginTop: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#888', fontStyle: 'italic' }}>Action binding will be implemented in the next phase!</p>
                </div>
              </div>
            ) : (
              <p style={{ color: '#aaa' }}>Click a button in the grid to edit its appearance.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default Dashboard;
