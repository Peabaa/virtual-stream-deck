
import { DeckProfile } from '../store';

interface ProfileManagerBarProps {
  profiles: Record<string, DeckProfile>;
  activeProfileId: string;
  handleSwitchProfile: (id: string) => void;
  equippedProfileId: string;
  isDetectingApp: boolean;
  setIsDetectingApp: (val: boolean) => void;
  isDetectingAppRef: React.MutableRefObject<boolean>;
  draftProfile: DeckProfile;
  handleCreateNewProfile: () => void;
  hasUnsavedChanges: boolean;
  handleSaveProfile: () => Promise<void>;
  handleDiscardChanges: () => void;
  handleEquipProfile: () => Promise<void>;
  handleDeleteProfile: () => Promise<void>;
}

export function ProfileManagerBar({
  profiles, activeProfileId, handleSwitchProfile, equippedProfileId,
  isDetectingApp, setIsDetectingApp, isDetectingAppRef, draftProfile,
  handleCreateNewProfile, hasUnsavedChanges, handleSaveProfile,
  handleDiscardChanges, handleEquipProfile, handleDeleteProfile
}: ProfileManagerBarProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(30,30,35,0.6)', backdropFilter: 'blur(10px)', padding: '15px 25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '15px' }}>
      {/* Left-aligned controls (Profile details & App detector) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Profile:</h3>
        <select 
          value={activeProfileId} 
          onChange={e => handleSwitchProfile(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#111', color: 'white', border: '1px solid #444', outline: 'none' }}
        >
          {Object.values(profiles).map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.id === equippedProfileId ? '(Equipped)' : ''}
            </option>
          ))}
        </select>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px', paddingLeft: '10px', borderLeft: '1px solid #555' }}>
          <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Linked App:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              fontSize: '0.9rem', 
              color: draftProfile.linkedApp ? '#4caf50' : '#888',
              fontWeight: 'bold',
              backgroundColor: 'rgba(0,0,0,0.3)',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {draftProfile.linkedApp || 'None'}
            </span>
            <button 
              onClick={() => {
                if (!isDetectingApp) {
                  isDetectingAppRef.current = true;
                  setIsDetectingApp(true);
                  alert("Listening for app... Click 'OK', then immediately click into the Game or App you want to link. The tracker will detect it automatically.");
                } else {
                  isDetectingAppRef.current = false;
                  setIsDetectingApp(false);
                }
              }}
              style={{ 
                padding: '4px 8px', 
                cursor: 'pointer',
                backgroundColor: isDetectingApp ? '#d32f2f' : '#333',
                color: 'white',
                border: isDetectingApp ? '1px solid #f44336' : '1px solid #555',
                borderRadius: '4px',
                fontWeight: 'bold',
                animation: isDetectingApp ? 'pulse-red 1.5s infinite' : 'none'
              }}
              title="Detect Active App"
            >
              {isDetectingApp ? "Listening..." : "🎯 Detect"}
            </button>
          </div>
        </div>

        <button onClick={handleCreateNewProfile} style={{ padding: '6px 12px', cursor: 'pointer', marginLeft: '10px' }}>+ New</button>
      </div>

      {/* Right-aligned controls (Save, Discard, Equip, Delete) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
              fontWeight: 'bold'
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
            fontWeight: 'bold'
          }}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
