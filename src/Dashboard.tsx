import { useState, useEffect, useRef, useCallback } from 'react';
import HotkeyInput from './HotkeyInput';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen } from '@tauri-apps/api/event';
import { loadProfiles, saveProfiles, loadEquippedProfileId, saveEquippedProfileId, DeckProfile, DeckButtonData, DEFAULT_PROFILE, ActionType } from './store';
import IconPicker, { CURATED_ICONS, IconName } from './IconPicker';
import { ActionPicker, ACTION_DEFS } from './ActionPicker';
import { obsService, ConnectionStatus, ObsState } from './obsService';

function Dashboard() {
  // Profile Management State
  const [profiles, setProfiles] = useState<Record<string, DeckProfile>>({});
  const [activeProfileId, setActiveProfileId] = useState<string>('default');
  const [equippedProfileId, setEquippedProfileId] = useState<string>('default');
  const [draftProfile, setDraftProfile] = useState<DeckProfile>(DEFAULT_PROFILE);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState<boolean>(false);
  const [isActionPickerOpen, setIsActionPickerOpen] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<'editor' | 'settings'>('editor');
  const [obsStatus, setObsStatus] = useState<ConnectionStatus>(obsService.getStatus());
  const [obsState, setObsState] = useState<ObsState>(obsService.getObsState());
  const [obsUrl, setObsUrl] = useState<string>('ws://127.0.0.1:4455');
  const [obsPassword, setObsPassword] = useState<string>('');
  
  const dragSourceRef = useRef<string | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load initial profiles on mount
  useEffect(() => {
    Promise.all([loadProfiles(), loadEquippedProfileId(), obsService.loadSettings()]).then(([loadedProfiles, eqId, obsSettings]) => {
      setProfiles(loadedProfiles);
      setEquippedProfileId(eqId);
      
      if (obsSettings.url) setObsUrl(obsSettings.url);
      if (obsSettings.password) setObsPassword(obsSettings.password);
      
      const activeId = loadedProfiles[eqId] ? eqId : Object.keys(loadedProfiles)[0];
      setActiveProfileId(activeId);
      setDraftProfile(loadedProfiles[activeId] || DEFAULT_PROFILE);
      setHasUnsavedChanges(false);
    });

    const unlistenStatus = obsService.onStatusChange(setObsStatus);
    const unlistenObsState = obsService.onObsStateChange(setObsState);
    return () => {
        unlistenStatus();
        unlistenObsState();
    };
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

  const handleDiscardChanges = () => {
    if (window.confirm("Are you sure you want to discard all unsaved changes?")) {
      setDraftProfile(profiles[activeProfileId] || DEFAULT_PROFILE);
      setHasUnsavedChanges(false);
      setSelectedButtonId(null);
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

  const swapButtons = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setDraftProfile(prev => {
      const newButtons = { ...prev.buttons };
      const sourceBtn = newButtons[sourceId];
      const targetBtn = newButtons[targetId];
      if (sourceBtn) newButtons[targetId] = { ...sourceBtn, id: targetId };
      else delete newButtons[targetId];
      if (targetBtn) newButtons[sourceId] = { ...targetBtn, id: sourceId };
      else delete newButtons[sourceId];
      return { ...prev, buttons: newButtons };
    });
    setHasUnsavedChanges(true);
    setSelectedButtonId(prev => {
      if (prev === sourceId) return targetId;
      if (prev === targetId) return sourceId;
      return prev;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    dragSourceRef.current = id;
    isDraggingRef.current = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        setDragSourceId(dragSourceRef.current);
      }
      if (!gridRef.current) return;
      const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null;
      const cell = el?.closest('[data-cell-id]') as HTMLElement | null;
      setDragOverId(cell ? cell.dataset.cellId || null : null);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (isDraggingRef.current) {
        const el = document.elementFromPoint(upEvent.clientX, upEvent.clientY) as HTMLElement | null;
        const cell = el?.closest('[data-cell-id]') as HTMLElement | null;
        const targetId = cell ? cell.dataset.cellId : null;
        if (targetId && dragSourceRef.current && targetId !== dragSourceRef.current) {
          swapButtons(dragSourceRef.current, targetId);
        }
      }

      dragSourceRef.current = null;
      isDraggingRef.current = false;
      setDragSourceId(null);
      setDragOverId(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [swapButtons]);

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
    <div style={{ display: 'flex', color: 'white', fontFamily: "'Outfit', sans-serif", backgroundColor: '#0f0f13', width: '100vw', height: '100vh', boxSizing: 'border-box' }}>
      
      {/* Left Sidebar */}
      <div style={{ width: '260px', backgroundColor: 'rgba(20, 20, 25, 0.8)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', padding: '20px', flexShrink: 0 }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', color: '#fff', textAlign: 'center' }}>Virtual Stream Deck</h2>
        <h3 style={{ margin: '0 0 40px 0', fontSize: '1.0rem', color: '#fff', textAlign: 'center', fontStyle: 'italic' }}>By MD Pastor</h3>
        <button 
          onClick={() => setCurrentTab('editor')}
          style={{ padding: '12px 16px', backgroundColor: currentTab === 'editor' ? 'rgba(57, 108, 216, 0.2)' : 'transparent', color: currentTab === 'editor' ? '#74b9ff' : '#aaa', border: 'none', borderLeft: currentTab === 'editor' ? '3px solid #74b9ff' : '3px solid transparent', borderRadius: '0 8px 8px 0', textAlign: 'left', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px', transition: 'all 0.2s' }}
        >
          🎨 Editor
        </button>
        <button 
          onClick={() => setCurrentTab('settings')}
          style={{ padding: '12px 16px', backgroundColor: currentTab === 'settings' ? 'rgba(57, 108, 216, 0.2)' : 'transparent', color: currentTab === 'settings' ? '#74b9ff' : '#aaa', border: 'none', borderLeft: currentTab === 'settings' ? '3px solid #74b9ff' : '3px solid transparent', borderRadius: '0 8px 8px 0', textAlign: 'left', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', transition: 'all 0.2s' }}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        
        {currentTab === 'editor' && (
          <>
            {/* Top Profile Manager */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ padding: '15px', backgroundColor: 'rgba(40,40,45,0.6)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '15px', alignItems: 'center' }}>
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
                        if (newName && newName.trim() !== '') updateDraft({ ...draftProfile, name: newName.trim() });
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

                {hasUnsavedChanges && (
                  <button 
                    onClick={handleDiscardChanges}
                    style={{ 
                      padding: '6px 16px', 
                      cursor: 'pointer',
                      backgroundColor: '#555',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      marginLeft: '10px'
                    }}
                  >
                    Discard
                  </button>
                )}
                
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
            
            {/* Editor Content Split */}
            <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
              
              {/* Left Column: Grid Layout Canvas */}
              <div style={{ flex: 2, padding: '25px', backgroundColor: 'rgba(30,30,35,0.6)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Grid Layout</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label>Cols:</label>
              <input type="number" value={draftProfile.columns} onChange={e => handleDimensionChange('columns', parseInt(e.target.value))} style={{ width: '50px' }} />
              <label>Rows:</label>
              <input type="number" value={draftProfile.rows} onChange={e => handleDimensionChange('rows', parseInt(e.target.value))} style={{ width: '50px' }} />
            </div>
          </div>

          <div
            ref={gridRef}
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${draftProfile.columns}, 1fr)`, 
              gap: '10px',
              backgroundColor: '#111',
              padding: '20px',
              borderRadius: '8px'
            }}
          >
            {Array.from({ length: draftProfile.rows }).map((_, y) => (
              Array.from({ length: draftProfile.columns }).map((_, x) => {
                const id = `${x},${y}`;
                const btnData = draftProfile.buttons[id];
                const isSelected = selectedButtonId === id;
                const isBeingDragged = dragSourceId === id;
                const isDropTarget = dragOverId === id && dragSourceId !== id;
                
                let isStateActive = false;
                if (btnData?.action) {
                  switch (btnData.action.type) {
                    case 'obs_toggle_record': isStateActive = obsState.isRecording; break;
                    case 'obs_toggle_stream': isStateActive = obsState.isStreaming; break;
                    case 'obs_toggle_virtual_cam': isStateActive = obsState.isVirtualCamOn; break;
                    case 'obs_switch_scene': isStateActive = obsState.currentScene === btnData.action.payload; break;
                    case 'obs_toggle_mute': isStateActive = obsState.mutedInputs[btnData.action.payload || ''] === true; break;
                  }
                }

                return (
                  <div 
                    key={id}
                    data-cell-id={id}
                    onClick={() => { if (!isDraggingRef.current) setSelectedButtonId(id); }}
                    onMouseDown={(e) => handleMouseDown(e, id)}
                    style={{
                      aspectRatio: '1 / 1',
                      backgroundColor: btnData?.color || 'rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      border: isSelected ? '2px solid #396cd8' : (isStateActive ? '2px solid #f44336' : (isDropTarget ? '2px dashed #4caf50' : '1px solid rgba(255,255,255,0.1)')),
                      boxShadow: isStateActive && !isSelected ? '0 0 15px rgba(244, 67, 54, 0.4)' : 'none',
                      opacity: isBeingDragged ? 0.4 : 1,
                      transform: isDropTarget ? 'scale(1.05)' : 'scale(1)',
                      transition: 'transform 0.1s ease, opacity 0.1s ease',
                      borderRadius: '8px',
                      cursor: dragSourceId ? 'grabbing' : 'grab',
                      fontWeight: 'bold',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      overflow: 'hidden',
                      padding: '5px',
                      userSelect: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    {btnData?.imageUrl ? (
                      <img src={btnData.imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain', pointerEvents: 'none' }} />
                    ) : btnData?.iconName && CURATED_ICONS[btnData.iconName as IconName] ? (
                      <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(() => {
                          const Icon = CURATED_ICONS[btnData.iconName as IconName];
                          return <Icon size={32} color={btnData.fontColor || 'white'} />;
                        })()}
                      </div>
                    ) : null}
                    <span style={{ 
                      fontSize: '0.8rem', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      maxWidth: '100%',
                      color: btnData?.fontColor || 'white',
                      pointerEvents: 'none'
                    }}>
                      {btnData?.label || id}
                    </span>
                  </div>
                );
              })
            ))}
            </div>
          </div>

            {/* Right Column: Button Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '25px', backgroundColor: 'rgba(30,30,35,0.6)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', flexGrow: 1, overflowY: 'auto' }}>
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
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Background</label>
                    <input 
                      type="color" 
                      value={selectedButtonData.color.startsWith('#') ? selectedButtonData.color : '#333333'} 
                      onChange={e => handleButtonUpdate(selectedButtonData.id, { color: e.target.value })}
                      style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Text Color</label>
                    <input 
                      type="color" 
                      value={selectedButtonData.fontColor?.startsWith('#') ? selectedButtonData.fontColor : '#ffffff'} 
                      onChange={e => handleButtonUpdate(selectedButtonData.id, { fontColor: e.target.value })}
                      style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                  </div>
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
                      key={selectedButtonData.id}
                      id="icon-upload-input"
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
                        onClick={() => {
                          handleButtonUpdate(selectedButtonData.id, { imageUrl: '' });
                          const input = document.getElementById('icon-upload-input') as HTMLInputElement;
                          if (input) input.value = '';
                        }}
                        style={{ padding: '6px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Remove Icon"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Built-in Icon</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {selectedButtonData.iconName && CURATED_ICONS[selectedButtonData.iconName as IconName] ? (
                      <div style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '4px', display: 'flex' }}>
                        {(() => {
                          const Icon = CURATED_ICONS[selectedButtonData.iconName as IconName];
                          return <Icon size={24} color="white" />;
                        })()}
                      </div>
                    ) : null}
                    <button 
                      onClick={() => setIsIconPickerOpen(true)}
                      style={{ padding: '8px 12px', flexGrow: 1, backgroundColor: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Choose Built-in Icon...
                    </button>
                    {selectedButtonData.iconName && (
                      <button 
                        onClick={() => handleButtonUpdate(selectedButtonData.id, { iconName: undefined })}
                        style={{ padding: '6px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        title="Remove Built-in Icon"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginTop: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Action Engine</label>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Action Type</label>
                    <button 
                      onClick={() => setIsActionPickerOpen(true)}
                      style={{ 
                        width: '100%', padding: '12px 15px', boxSizing: 'border-box', 
                        backgroundColor: 'rgba(57, 108, 216, 0.1)', color: '#74b9ff', 
                        border: '1px solid rgba(57, 108, 216, 0.4)', borderRadius: '8px', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                        transition: 'all 0.2s', textAlign: 'left'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(57, 108, 216, 0.2)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(57, 108, 216, 0.1)'; }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        {(() => {
                          const actionDef = selectedButtonData.action?.type ? ACTION_DEFS[selectedButtonData.action.type] : null;
                          if (actionDef) {
                            const Icon = actionDef.icon;
                            return <Icon size={28} />;
                          }
                          return '🚫';
                        })()}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>
                          {selectedButtonData.action?.type && ACTION_DEFS[selectedButtonData.action.type] ? ACTION_DEFS[selectedButtonData.action.type].label : 'None'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#74b9ff' }}>Click to change action...</span>
                      </div>
                    </button>
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

                  {selectedButtonData.action?.type === 'type_text' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Text to Type</label>
                      <textarea 
                        placeholder="Hello World! This is a test."
                        value={selectedButtonData.action?.payload || ''} 
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'type_text', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px', resize: 'vertical', minHeight: '60px' }}
                      />
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Type long paragraphs here. All uppercase letters and symbols are perfectly preserved.</p>
                    </div>
                  )}

                  {selectedButtonData.action?.type === 'run_macro' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Macro Sequence</label>
                      <input 
                        type="text" 
                        placeholder="{+CTRL}c{-CTRL}"
                        value={selectedButtonData.action?.payload || ''} 
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'run_macro', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                      />
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Wrap modifiers in brackets. Examples: {'{+CTRL}c{-CTRL}'} or {'{ENTER}'}. Do not use for plain text.</p>
                    </div>
                  )}

                  {selectedButtonData.action?.type === 'obs_switch_scene' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Scene Name</label>
                      <input 
                        type="text" 
                        placeholder="Gameplay"
                        value={selectedButtonData.action?.payload || ''} 
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'obs_switch_scene', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                      />
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The exact name of the OBS Scene to switch to.</p>
                    </div>
                  )}

                  {selectedButtonData.action?.type === 'obs_toggle_source' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Source Name</label>
                      <input 
                        type="text" 
                        placeholder="Webcam"
                        value={selectedButtonData.action?.payload || ''} 
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'obs_toggle_source', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                      />
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The exact name of the OBS Source to toggle in the current scene.</p>
                    </div>
                  )}

                  {selectedButtonData.action?.type === 'obs_toggle_mute' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Audio Source Name</label>
                      <input 
                        type="text" 
                        placeholder="Mic/Aux"
                        value={selectedButtonData.action?.payload || ''} 
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'obs_toggle_mute', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                      />
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The exact name of the OBS Audio source to toggle mute.</p>
                    </div>
                  )}

                  {selectedButtonData.action?.type === 'obs_take_screenshot' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Save Folder Path</label>
                      <input 
                        type="text" 
                        placeholder="C:\Users\Name\Pictures"
                        value={selectedButtonData.action?.payload || ''} 
                        onChange={e => handleButtonUpdate(selectedButtonData.id, { 
                          action: { type: 'obs_take_screenshot', payload: e.target.value } 
                        })}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                      />
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The absolute path to the folder where the screenshot of the Current Program Scene will be saved.</p>
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
          </>
        )}

        {currentTab === 'settings' && (
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
        )}

      </div>
      
      <IconPicker 
        isOpen={isIconPickerOpen} 
        onClose={() => setIsIconPickerOpen(false)} 
        onSelect={(iconName) => {
          if (selectedButtonId) {
            handleButtonUpdate(selectedButtonId, { iconName });
          }
        }} 
      />
      <ActionPicker
        isOpen={isActionPickerOpen}
        onClose={() => setIsActionPickerOpen(false)}
        onSelect={(actionType) => {
          if (selectedButtonId) {
            handleButtonUpdate(selectedButtonId, { action: { type: actionType, payload: '' } });
          }
        }}
      />
    </div>
  );
}

export default Dashboard;
