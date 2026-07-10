
import { DeckButtonData, DeckProfile } from '../store';
import { CURATED_ICONS, IconName } from '../IconPicker';
import { ACTION_DEFS } from '../ActionPicker';
import { ActionPayloadEditor } from './ActionPayloadEditor';
import HotkeyInput from '../HotkeyInput';

interface ButtonEditorSidebarProps {
  selectedButtonData: DeckButtonData | null;
  selectedButtonId: string | null;
  handleButtonUpdate: (id: string, updates: Partial<DeckButtonData>) => void;
  handleImageUpload: (id: string, file: File) => void;
  setIsIconPickerOpen: (isOpen: boolean) => void;
  setActiveActionIndex: (index: number | null) => void;
  profiles: Record<string, DeckProfile>;
}

export function ButtonEditorSidebar({
  selectedButtonData, selectedButtonId, handleButtonUpdate,
  handleImageUpload, setIsIconPickerOpen, setActiveActionIndex, profiles
}: ButtonEditorSidebarProps) {
  return (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', margin: 0 }}>Action Engine (Chain)</label>
              </div>
              
              {(() => {
                const actions = selectedButtonData.actions || (selectedButtonData.action ? [selectedButtonData.action] : []);
                if (actions.length === 0) return <p style={{ color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', margin: '20px 0' }}>No actions configured.</p>;

                return actions.map((act, index) => (
                  <div key={index} style={{ marginBottom: index === actions.length - 1 ? 0 : '15px', padding: '15px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 'bold' }}>Action {index + 1}</span>
                      <button 
                        onClick={() => {
                          const newActs = [...actions];
                          newActs.splice(index, 1);
                          handleButtonUpdate(selectedButtonData.id, { actions: newActs });
                        }}
                        style={{ background: 'transparent', border: '1px solid rgba(255,85,85,0.3)', color: '#ff5555', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px' }}
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Action Type</label>
                      <button 
                        onClick={() => setActiveActionIndex(index)}
                        style={{ 
                          width: '100%', padding: '12px 15px', boxSizing: 'border-box', 
                          backgroundColor: 'rgba(57, 108, 216, 0.1)', color: '#74b9ff', 
                          border: '1px solid rgba(57, 108, 216, 0.4)', borderRadius: '8px', 
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                          transition: 'all 0.2s', textAlign: 'left'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          {(() => {
                            const actionDef = act.type ? ACTION_DEFS[act.type] : null;
                            if (actionDef) {
                              const Icon = actionDef.icon;
                              return <Icon size={28} />;
                            }
                            return '🚫';
                          })()}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>
                            {act.type && ACTION_DEFS[act.type] ? ACTION_DEFS[act.type].label : 'None'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#74b9ff' }}>Click to change action...</span>
                        </div>
                      </button>
                    </div>

                    <ActionPayloadEditor 
                      act={act}
                      index={index}
                      selectedButtonId={selectedButtonId}
                      selectedButtonData={selectedButtonData}
                      profiles={profiles}
                      handleButtonUpdate={handleButtonUpdate}
                    />
                  </div>
                ));
              })()}

              <button 
                onClick={() => {
                  const currentActs = selectedButtonData.actions || (selectedButtonData.action ? [selectedButtonData.action] : []);
                  handleButtonUpdate(selectedButtonData.id, { actions: [...currentActs, { type: 'none', payload: '' }] });
                }}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  backgroundColor: 'rgba(57, 108, 216, 0.15)', 
                  color: '#74b9ff', 
                  border: '1px dashed rgba(57, 108, 216, 0.5)', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontSize: '0.95rem', 
                  fontWeight: 'bold',
                  marginTop: '10px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(57, 108, 216, 0.25)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(57, 108, 216, 0.15)'}
              >
                + Add Action
              </button>
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
  );
}
