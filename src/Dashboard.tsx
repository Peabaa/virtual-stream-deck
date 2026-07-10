import { useState, useEffect, useRef, useCallback } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen } from '@tauri-apps/api/event';
import { isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { loadProfiles, saveProfiles, loadEquippedProfileId, saveEquippedProfileId, saveBaseProfileId, DeckProfile, DeckButtonData, DEFAULT_PROFILE } from './store';
import IconPicker from './IconPicker';
import { ActionPicker } from './ActionPicker';
import { obsService, ConnectionStatus, ObsState } from './obsService';
import { SettingsView } from './components/SettingsView';
import { GridCanvas } from './components/GridCanvas';
import { ButtonEditorSidebar } from './components/ButtonEditorSidebar';
import { ProfileManagerBar } from './components/ProfileManagerBar';




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
  const [activeActionIndex, setActiveActionIndex] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState<'editor' | 'settings'>('editor');
  const [obsStatus, setObsStatus] = useState<ConnectionStatus>(obsService.getStatus());
  const [obsState, setObsState] = useState<ObsState>(obsService.getObsState());
  const [obsUrl, setObsUrl] = useState<string>('ws://127.0.0.1:4455');
  const [obsPassword, setObsPassword] = useState<string>('');
  const [runOnStartup, setRunOnStartup] = useState<boolean>(false);
  const [isDetectingApp, setIsDetectingApp] = useState<boolean>(false);
  const isDetectingAppRef = useRef<boolean>(false);
  const draftProfileRef = useRef<DeckProfile>(draftProfile);

  useEffect(() => {
    draftProfileRef.current = draftProfile;
  }, [draftProfile]);
  
  const dragSourceRef = useRef<string | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Load initial profiles on mount
  useEffect(() => {
    const fetchData = async () => {
      const [loadedProfiles, eqId, obsSettings] = await Promise.all([
        loadProfiles(), 
        loadEquippedProfileId(), 
        obsService.loadSettings()
      ]);
      
      setProfiles(loadedProfiles);
      setEquippedProfileId(eqId);
      
      if (obsSettings.url) setObsUrl(obsSettings.url);
      if (obsSettings.password) setObsPassword(obsSettings.password);
      
      const activeId = loadedProfiles[eqId] ? eqId : Object.keys(loadedProfiles)[0];
      setActiveProfileId(activeId);
      setDraftProfile(loadedProfiles[activeId] || DEFAULT_PROFILE);
      setHasUnsavedChanges(false);
      
      const startupStatus = await isAutostartEnabled();
      setRunOnStartup(startupStatus);
    };
    fetchData();

    // Listen for active window changes just to keep the equipped profile UI in sync
    const unlistenWindow = listen<string>('active-window-changed', async (event) => {
      const exeName = event.payload;

      if (isDetectingAppRef.current && exeName !== 'virtual-stream-deck.exe') {
        setDraftProfile({ ...draftProfileRef.current, linkedApp: exeName });
        setHasUnsavedChanges(true);
        isDetectingAppRef.current = false;
        setIsDetectingApp(false);
      }

      const eqId = await loadEquippedProfileId();
      setEquippedProfileId(eqId);
    });

    const unlistenStatus = obsService.onStatusChange(setObsStatus);
    const unlistenObsState = obsService.onObsStateChange(setObsState);
    
    return () => {
        unlistenStatus();
        unlistenObsState();
        unlistenWindow.then(f => f());
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
    await saveBaseProfileId(activeProfileId); // Manually equipped, so it becomes the base
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
    <div style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: '#0f0f14', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ width: '80px', backgroundColor: '#0a0a0d', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px', gap: '15px' }}>
        <button 
          onClick={() => setCurrentTab('editor')}
          style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: currentTab === 'editor' ? 'rgba(57, 108, 216, 0.2)' : 'transparent', color: currentTab === 'editor' ? '#74b9ff' : '#666', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Profile Editor"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        </button>
        <button 
          onClick={() => setCurrentTab('settings')}
          style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: currentTab === 'settings' ? 'rgba(57, 108, 216, 0.2)' : 'transparent', color: currentTab === 'settings' ? '#74b9ff' : '#666', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Global Settings"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '30px', overflowY: 'auto', minWidth: 0 }}>
        {currentTab === 'editor' && (
          <>
            <ProfileManagerBar
              profiles={profiles}
              activeProfileId={activeProfileId}
              handleSwitchProfile={handleSwitchProfile}
              equippedProfileId={equippedProfileId}
              isDetectingApp={isDetectingApp}
              setIsDetectingApp={setIsDetectingApp}
              isDetectingAppRef={isDetectingAppRef}
              draftProfile={draftProfile}
              handleCreateNewProfile={handleCreateNewProfile}
              hasUnsavedChanges={hasUnsavedChanges}
              handleSaveProfile={handleSaveProfile}
              handleDiscardChanges={handleDiscardChanges}
              handleEquipProfile={handleEquipProfile}
              handleDeleteProfile={handleDeleteProfile}
            />
            
            <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0, marginTop: '20px' }}>
              <GridCanvas
                draftProfile={draftProfile}
                handleDimensionChange={handleDimensionChange}
                gridRef={gridRef}
                selectedButtonId={selectedButtonId}
                setSelectedButtonId={setSelectedButtonId}
                dragSourceId={dragSourceId}
                dragOverId={dragOverId}
                isDraggingRef={isDraggingRef}
                handleMouseDown={handleMouseDown}
                obsState={obsState}
              />
              <ButtonEditorSidebar
                selectedButtonData={selectedButtonData}
                selectedButtonId={selectedButtonId}
                handleButtonUpdate={handleButtonUpdate}
                handleImageUpload={handleImageUpload}
                setIsIconPickerOpen={setIsIconPickerOpen}
                setActiveActionIndex={setActiveActionIndex}
                profiles={profiles}
              />
            </div>
          </>
        )}

        {currentTab === 'settings' && (
          <SettingsView
            draftProfile={draftProfile}
            updateDraft={updateDraft}
            runOnStartup={runOnStartup}
            setRunOnStartup={setRunOnStartup}
            obsStatus={obsStatus}
            obsUrl={obsUrl}
            setObsUrl={setObsUrl}
            obsPassword={obsPassword}
            setObsPassword={setObsPassword}
            hasUnsavedChanges={hasUnsavedChanges}
            handleDiscardChanges={handleDiscardChanges}
            handleSaveProfile={handleSaveProfile}
          />
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
        isOpen={activeActionIndex !== null}
        onClose={() => setActiveActionIndex(null)}
        onSelect={(actionType) => {
          if (selectedButtonId && activeActionIndex !== null) {
            const currentActions = selectedButtonData?.actions || (selectedButtonData?.action ? [selectedButtonData.action] : []);
            const newActions = [...currentActions];
            newActions[activeActionIndex] = { type: actionType, payload: '' };
            handleButtonUpdate(selectedButtonId, { actions: newActions });
          }
        }}
      />
    </div>
  );
}

export default Dashboard;
