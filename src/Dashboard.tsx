import { useState, useEffect } from 'react';
import HotkeyInput from './HotkeyInput';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen } from '@tauri-apps/api/event';
import { loadProfiles, saveProfiles, loadEquippedProfileId, saveEquippedProfileId, DeckProfile, DeckButtonData, DEFAULT_PROFILE, ActionType } from './store';

function Dashboard() {
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

  // The active hotkey is the one saved in the CURRENTLY EQUIPPED profile
  const activeOsdHotkey = profiles[equippedProfileId]?.osdHotkey || '';

  // Hotkey hook logic...
  useEffect(() => {
    let activeHotkey = activeOsdHotkey;
    let isPaused = false;

    const setupShortcut = async () => {
      try {
        if (isPaused || !activeHotkey) return;
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

    const unlistenPause = listen('pause_hotkeys', async () => {
      isPaused = true;
      if (activeHotkey) await unregister(activeHotkey).catch(() => {});
    });

    const unlistenResume = listen('resume_hotkeys', () => {
      isPaused = false;
      setupShortcut();
    });

    setupShortcut();

    return () => { 
      unlistenPause.then(f => f());
      unlistenResume.then(f => f());
      if (activeHotkey) unregister(activeHotkey).catch(console.error); 
    };
  }, [activeOsdHotkey]);


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

  const handleDeleteProfile = async () => {
    if (Object.keys(profiles).length <= 1) {
      alert("You cannot delete the last remaining profile.");
      return;
    }

    if (window.confirm(`Are you sure you want to permanently delete the profile "${draftProfile.name}"?`)) {
      const updatedProfiles = { ...profiles };
      delete updatedProfiles[activeProfileId];
      
      setProfiles(updatedProfiles);
      await saveProfiles(updatedProfiles);
      
      // Fallback to the next available profile
      const fallbackId = Object.keys(updatedProfiles)[0];
      setActiveProfileId(fallbackId);
      setDraftProfile(updatedProfiles[fallbackId]);
      setHasUnsavedChanges(false);
      setSelectedButtonId(null);

      // If we just deleted the actively equipped profile, we MUST auto-equip the fallback profile
      if (activeProfileId === equippedProfileId) {
        setEquippedProfileId(fallbackId);
        await saveEquippedProfileId(fallbackId);
        await emit('profile_updated');
      }
    }
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

  const handleImageUpload = (id: string, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Downscale to 128x128 max
        const MAX_SIZE = 128;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round(height * (MAX_SIZE / width));
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round(width * (MAX_SIZE / height));
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/png');
        handleButtonUpdate(id, { imageUrl: dataUrl });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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
            <div style={{ display: 'flex', gap: '5px' }}>
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
              <button 
                onClick={() => {
                  const newName = window.prompt("Enter new profile name:", draftProfile.name);
                  if (newName && newName.trim() !== '') {
                    updateDraft({ ...draftProfile, name: newName.trim() });
                  }
                }}
                style={{ padding: '6px 10px', cursor: 'pointer', backgroundColor: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                title="Rename Profile"
              >
                ✏️
              </button>
            </div>
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

          <button 
            onClick={handleDeleteProfile}
            disabled={Object.keys(profiles).length <= 1}
            style={{ 
              padding: '6px 12px', 
              cursor: Object.keys(profiles).length <= 1 ? 'not-allowed' : 'pointer',
              backgroundColor: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              marginLeft: '10px'
            }}
          >
            🗑️ Delete
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
                      fontWeight: 'bold',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      overflow: 'hidden',
                      padding: '5px'
                    }}
                  >
                    {btnData?.imageUrl && (
                      <img src={btnData.imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    )}
                    <span style={{ 
                      fontSize: '0.8rem', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      maxWidth: '100%' 
                    }}>
                      {btnData?.label || id}
                    </span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>OSD Toggle Hotkey:</label>
                <HotkeyInput 
                  value={draftProfile.osdHotkey || ''} 
                  onChange={val => updateDraft({ ...draftProfile, osdHotkey: val })} 
                />
                <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Must be saved and equipped to take effect.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="requireOsdVisible"
                  checked={!!draftProfile.requireOsdVisible}
                  onChange={e => updateDraft({ ...draftProfile, requireOsdVisible: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="requireOsdVisible" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                  Require OSD to be visible for hotkeys to work
                </label>
              </div>
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
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Icon Image</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {selectedButtonData.imageUrl && (
                      <img 
                        src={selectedButtonData.imageUrl} 
                        alt="icon preview" 
                        style={{ width: '40px', height: '40px', objectFit: 'contain', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '4px' }} 
                      />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageUpload(selectedButtonData.id, e.target.files[0]);
                        }
                      }}
                      style={{ flexGrow: 1 }}
                    />
                    {selectedButtonData.imageUrl && (
                      <button 
                        onClick={() => handleButtonUpdate(selectedButtonData.id, { imageUrl: '' })}
                        style={{ padding: '6px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Remove Icon"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginTop: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Action Engine</label>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Action Type</label>
                    <select 
                      value={selectedButtonData.action?.type || 'none'}
                      onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                        action: { type: e.target.value as ActionType, payload: '' } 
                      })}
                      style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                    >
                      <option value="none">None</option>
                      <option value="open_url">Open URL / App / File</option>
                      <option value="open_folder">Open Folder / Profile</option>
                    </select>
                  </div>

                  {selectedButtonData.action?.type === 'open_url' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Target Payload</label>
                      <input 
                        type="text" 
                        placeholder="https://youtube.com or C:/app.exe"
                        value={selectedButtonData.action?.payload || ''} 
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'open_url', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                      />
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Enter a web link or an absolute file path.</p>
                    </div>
                  )}

                  {selectedButtonData.action?.type === 'open_folder' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Target Folder</label>
                      <select 
                        value={selectedButtonData.action?.payload || ''}
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'open_folder', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                      >
                        <option value="" disabled>Select a profile...</option>
                        {Object.values(profiles).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Instantly swap your layout to this profile.</p>
                    </div>
                  )}
                </div>

                <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginTop: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Hardware Trigger</label>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Physical Key Binding</label>
                  <HotkeyInput 
                    value={selectedButtonData.triggerHotkey || ''} 
                    onChange={val => handleButtonUpdate(selectedButtonData.id, { triggerHotkey: val })} 
                  />
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Pressing this key will silently trigger the Action Payload.</p>
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
