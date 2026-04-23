import { useState, useEffect } from 'react';
import HotkeyInput from './HotkeyInput';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit } from '@tauri-apps/api/event';
import { loadProfiles, saveProfiles, loadEquippedProfileId, saveEquippedProfileId, DeckProfile, DeckButtonData, DEFAULT_PROFILE } from './store';

function Dashboard() {
  const [osdHotkey, setOsdHotkey] = useState<string>('');
  
  // Profile Management State
  const [profiles, setProfiles] = useState<Record<string, DeckProfile>>({});
  const [activeProfileId, setActiveProfileId] = useState<string>('default');
  const [equippedProfileId, setEquippedProfileId] = useState<string>('default');
  const [draftProfile, setDraftProfile] = useState<DeckProfile>(DEFAULT_PROFILE);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);

  // Load initial profiles on mount
  useEffect(() => {
    Promise.all([loadProfiles(), loadEquippedProfileId()]).then(([loadedProfiles, eqId]) => {
      setProfiles(loadedProfiles);
      setEquippedProfileId(eqId);
      
      const activeId = loadedProfiles[eqId] ? eqId : Object.keys(loadedProfiles)[0];
      setActiveProfileId(activeId);
      setDraftProfile(loadedProfiles[activeId] || DEFAULT_PROFILE);
      setHasUnsavedChanges(false);
    });
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


  // ---- Profile Actions ----

  const handleSwitchProfile = (newId: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes! Do you want to discard them and switch profiles?")) {
        return;
      }
    }
    setActiveProfileId(newId);
    setDraftProfile(profiles[newId]);
    setHasUnsavedChanges(false);
    setSelectedButtonId(null);
  };

  const handleCreateNewProfile = () => {
    if (hasUnsavedChanges && !window.confirm("You have unsaved changes! Discard them to create a new profile?")) return;
    
    const name = window.prompt("Enter a name for the new profile:");
    if (!name || name.trim() === '') return;
    
    const newId = Date.now().toString();
    const newProfile: DeckProfile = {
      id: newId,
      name: name.trim(),
      rows: 3,
      columns: 3,
      buttons: {}
    };
    
    const newProfilesList = { ...profiles, [newId]: newProfile };
    setProfiles(newProfilesList);
    saveProfiles(newProfilesList); // Auto-save the blank profile creation
    
    setActiveProfileId(newId);
    setDraftProfile(newProfile);
    setHasUnsavedChanges(false);
  };

  const handleSaveProfile = async () => {
    const updatedProfiles = { ...profiles, [activeProfileId]: draftProfile };
    setProfiles(updatedProfiles);
    await saveProfiles(updatedProfiles);
    setHasUnsavedChanges(false);

    // If we are saving the currently equipped profile, tell OSD to reload!
    if (equippedProfileId === activeProfileId) {
      await emit('profile_updated');
    }
  };

  const handleEquipProfile = async () => {
    if (hasUnsavedChanges) {
      alert("Please save your changes before equipping this profile!");
      return;
    }
    setEquippedProfileId(activeProfileId);
    await saveEquippedProfileId(activeProfileId);
    await emit('profile_updated');
  };

  // ---- Editor Actions ----

  const updateDraft = (newDraft: DeckProfile) => {
    setDraftProfile(newDraft);
    setHasUnsavedChanges(true);
  };

  const handleDimensionChange = (key: 'rows' | 'columns', val: number) => {
    if (val < 1 || val > 12) return;
    updateDraft({ ...draftProfile, [key]: val });
    setSelectedButtonId(null);
  };

  const handleButtonUpdate = (id: string, updates: Partial<DeckButtonData>) => {
    const existing = draftProfile.buttons[id] || { id, label: id, color: 'rgba(255, 255, 255, 0.08)' };
    const newButtons = { ...draftProfile.buttons, [id]: { ...existing, ...updates } };
    updateDraft({ ...draftProfile, buttons: newButtons });
  };

  const selectedButtonData = selectedButtonId 
    ? (draftProfile.buttons[selectedButtonId] || { id: selectedButtonId, label: selectedButtonId, color: 'rgba(255, 255, 255, 0.08)' })
    : null;

  return (
    <div style={{ padding: '20px', color: 'white', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', width: '100vw', height: '100vh', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* Top Header & Profile Manager */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ margin: 0 }}>Virtual Stream Deck</h1>
        <div style={{ padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '8px', border: '1px solid #444', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '4px' }}>Editing Profile:</label>
            <select 
              value={activeProfileId} 
              onChange={(e) => handleSwitchProfile(e.target.value)}
              style={{ padding: '6px', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
            >
              {Object.values(profiles).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.id === equippedProfileId ? '(Equipped)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <button onClick={handleCreateNewProfile} style={{ padding: '6px 12px', cursor: 'pointer' }}>+ New</button>
          
          <div style={{ width: '1px', height: '30px', backgroundColor: '#555' }} />
          
          <button 
            onClick={handleSaveProfile} 
            disabled={!hasUnsavedChanges}
            style={{ 
              padding: '6px 16px', 
              cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
              backgroundColor: hasUnsavedChanges ? '#2e7d32' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            {hasUnsavedChanges ? "💾 Save Changes" : "Saved"}
          </button>
          
          <button 
            onClick={handleEquipProfile}
            disabled={activeProfileId === equippedProfileId || hasUnsavedChanges}
            style={{ 
              padding: '6px 16px', 
              cursor: (activeProfileId !== equippedProfileId && !hasUnsavedChanges) ? 'pointer' : 'not-allowed',
              backgroundColor: (activeProfileId === equippedProfileId) ? '#1565c0' : '#444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            {activeProfileId === equippedProfileId ? "Equipped" : "Equip Profile"}
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        
        {/* Left Column: Grid Editor Canvas */}
        <div style={{ flex: 2, padding: '20px', backgroundColor: '#222', borderRadius: '12px', border: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Grid Layout</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label>Cols:</label>
              <input type="number" value={draftProfile.columns} onChange={e => handleDimensionChange('columns', parseInt(e.target.value))} style={{ width: '50px' }} />
              <label>Rows:</label>
              <input type="number" value={draftProfile.rows} onChange={e => handleDimensionChange('rows', parseInt(e.target.value))} style={{ width: '50px' }} />
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${draftProfile.columns}, 1fr)`, 
            gap: '10px',
            backgroundColor: '#111',
            padding: '20px',
            borderRadius: '8px'
          }}>
            {Array.from({ length: draftProfile.rows }).map((_, y) => (
              Array.from({ length: draftProfile.columns }).map((_, x) => {
                const id = `${x},${y}`;
                const btnData = draftProfile.buttons[id];
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
