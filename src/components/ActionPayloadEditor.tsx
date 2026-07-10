
import { DeckProfile, DeckButtonData, DeckButtonAction } from '../store';

export const KEYPRESS_OPTIONS = [
  { group: "Standard Keys (A-Z)", options: [
      { label: "A", value: "65" }, { label: "B", value: "66" }, { label: "C", value: "67" },
      { label: "D", value: "68" }, { label: "E", value: "69" }, { label: "F", value: "70" },
      { label: "G", value: "71" }, { label: "H", value: "72" }, { label: "I", value: "73" },
      { label: "J", value: "74" }, { label: "K", value: "75" }, { label: "L", value: "76" },
      { label: "M", value: "77" }, { label: "N", value: "78" }, { label: "O", value: "79" },
      { label: "P", value: "80" }, { label: "Q", value: "81" }, { label: "R", value: "82" },
      { label: "S", value: "83" }, { label: "T", value: "84" }, { label: "U", value: "85" },
      { label: "V", value: "86" }, { label: "W", value: "87" }, { label: "X", value: "88" },
      { label: "Y", value: "89" }, { label: "Z", value: "90" },
  ]},
  { group: "Numbers & Punctuation", options: [
      { label: "0", value: "48" }, { label: "1", value: "49" }, { label: "2", value: "50" },
      { label: "3", value: "51" }, { label: "4", value: "52" }, { label: "5", value: "53" },
      { label: "6", value: "54" }, { label: "7", value: "55" }, { label: "8", value: "56" },
      { label: "9", value: "57" }, { label: ";", value: "186" }, { label: "=", value: "187" },
      { label: ",", value: "188" }, { label: "-", value: "189" }, { label: ".", value: "190" },
      { label: "/", value: "191" }, { label: "`", value: "192" }, { label: "[", value: "219" },
      { label: "\\", value: "220" }, { label: "]", value: "221" }, { label: "'", value: "222" },
  ]},
  { group: "Modifiers & Special", options: [
      { label: "Enter", value: "13" }, { label: "Escape", value: "27" }, { label: "Tab", value: "9" },
      { label: "Space", value: "32" }, { label: "Backspace", value: "8" }, { label: "Caps Lock", value: "20" },
      { label: "Shift", value: "16" }, { label: "Control", value: "17" }, { label: "Alt", value: "18" },
      { label: "Windows Key", value: "91" },
  ]},
  { group: "Arrow Keys", options: [
      { label: "Up Arrow", value: "38" }, { label: "Down Arrow", value: "40" }, 
      { label: "Left Arrow", value: "37" }, { label: "Right Arrow", value: "39" },
  ]},
  { group: "Function Keys (F1-F12)", options: [
      { label: "F1", value: "112" }, { label: "F2", value: "113" }, { label: "F3", value: "114" },
      { label: "F4", value: "115" }, { label: "F5", value: "116" }, { label: "F6", value: "117" },
      { label: "F7", value: "118" }, { label: "F8", value: "119" }, { label: "F9", value: "120" },
      { label: "F10", value: "121" }, { label: "F11", value: "122" }, { label: "F12", value: "123" },
  ]},
  { group: "Extended Function Keys (F13-F24)", options: [
      { label: "F13", value: "124" }, { label: "F14", value: "125" }, { label: "F15", value: "126" },
      { label: "F16", value: "127" }, { label: "F17", value: "128" }, { label: "F18", value: "129" },
      { label: "F19", value: "130" }, { label: "F20", value: "131" }, { label: "F21", value: "132" },
      { label: "F22", value: "133" }, { label: "F23", value: "134" }, { label: "F24", value: "135" },
  ]},
  { group: "Numpad", options: [
      { label: "Numpad 0", value: "96" }, { label: "Numpad 1", value: "97" }, { label: "Numpad 2", value: "98" },
      { label: "Numpad 3", value: "99" }, { label: "Numpad 4", value: "100" }, { label: "Numpad 5", value: "101" },
      { label: "Numpad 6", value: "102" }, { label: "Numpad 7", value: "103" }, { label: "Numpad 8", value: "104" },
      { label: "Numpad 9", value: "105" }, { label: "Numpad *", value: "106" }, { label: "Numpad +", value: "107" },
      { label: "Numpad -", value: "109" }, { label: "Numpad .", value: "110" }, { label: "Numpad /", value: "111" },
  ]},
  { group: "Navigation", options: [
      { label: "Insert", value: "45" }, { label: "Delete", value: "46" }, { label: "Home", value: "36" },
      { label: "End", value: "35" }, { label: "Page Up", value: "33" }, { label: "Page Down", value: "34" },
  ]}
];

interface ActionPayloadEditorProps {
  act?: DeckButtonAction;
  index: number;
  selectedButtonId: string | null;
  selectedButtonData: DeckButtonData | null;
  profiles: Record<string, DeckProfile>;
  handleButtonUpdate: (id: string, updates: Partial<DeckButtonData>) => void;
}

export function ActionPayloadEditor({ 
  act, index, selectedButtonId, selectedButtonData, profiles, handleButtonUpdate 
}: ActionPayloadEditorProps) {
  if (!act || !selectedButtonId || !selectedButtonData) return null;

  const updateAction = (payload: string) => {
    const currentActs = selectedButtonData.actions || (selectedButtonData.action ? [selectedButtonData.action] : []);
    const newActs = [...currentActs];
    newActs[index] = { type: act.type, payload };
    handleButtonUpdate(selectedButtonId, { actions: newActs });
  };

  return (
    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {act.type === 'delay' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Delay (Milliseconds)</label>
          <input 
            type="number" 
            placeholder="1000"
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>1000 ms = 1 second. Execution will pause here.</p>
        </div>
      )}

      {act.type === 'open_url' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Target Payload</label>
          <input 
            type="text" 
            placeholder="https://youtube.com or C:/app.exe"
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Enter a web link or an absolute file path.</p>
        </div>
      )}

      {act.type === 'open_folder' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Target Folder</label>
          <select 
            value={act.payload || ''}
            onChange={e => updateAction(e.target.value)}
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

      {act.type === 'type_text' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Text to Type</label>
          <textarea 
            placeholder="Hello World! This is a test."
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px', resize: 'vertical', minHeight: '60px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Type long paragraphs here. All uppercase letters and symbols are perfectly preserved.</p>
        </div>
      )}

      {act.type === 'run_macro' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Macro Sequence</label>
          <input 
            type="text" 
            placeholder="{+CTRL}c{-CTRL}"
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Wrap modifiers in brackets. Examples: {'{+CTRL}c{-CTRL}'} or {'{ENTER}'}. Do not use for plain text.</p>
        </div>
      )}

      {act.type === 'sys_send_keypress' && (() => {
        let currentPayload: { modifiers: number[], key: string } = { modifiers: [], key: '' };
        if (act.payload) {
          try {
            const parsed = JSON.parse(act.payload);
            if (parsed.key !== undefined) currentPayload = parsed;
            else currentPayload.key = act.payload;
          } catch (e) {
            currentPayload.key = act.payload;
          }
        }

        const handleComboUpdate = (mods: number[], key: string) => {
          updateAction(JSON.stringify({ modifiers: mods, key }));
        };

        const toggleMod = (mod: number) => {
          const mods = currentPayload.modifiers.includes(mod) 
            ? currentPayload.modifiers.filter(m => m !== mod)
            : [...currentPayload.modifiers, mod];
          handleComboUpdate(mods, currentPayload.key);
        };

        return (
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Combo Builder</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', padding: '10px', backgroundColor: '#111', borderRadius: '4px', border: '1px solid #555' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={currentPayload.modifiers.includes(17)} onChange={() => toggleMod(17)} /> Ctrl
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={currentPayload.modifiers.includes(16)} onChange={() => toggleMod(16)} /> Shift
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={currentPayload.modifiers.includes(18)} onChange={() => toggleMod(18)} /> Alt
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={currentPayload.modifiers.includes(91)} onChange={() => toggleMod(91)} /> Win
              </label>
            </div>
            <select 
              value={currentPayload.key}
              onChange={e => handleComboUpdate(currentPayload.modifiers, e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
            >
              <option value="" disabled>Select a main key...</option>
              {KEYPRESS_OPTIONS.map((group, i) => (
                <optgroup key={i} label={group.group}>
                  {group.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>Select modifiers and a main key to trigger them simultaneously via the Windows API.</p>
          </div>
        );
      })()}

      {act.type === 'obs_switch_scene' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Scene Name</label>
          <input 
            type="text" 
            placeholder="Gameplay"
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The exact name of the OBS Scene to switch to.</p>
        </div>
      )}

      {act.type === 'obs_toggle_source' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Source Name</label>
          <input 
            type="text" 
            placeholder="Webcam"
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The exact name of the OBS Source to toggle in the current scene.</p>
        </div>
      )}

      {act.type === 'obs_toggle_mute' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Audio Source Name</label>
          <input 
            type="text" 
            placeholder="Mic/Aux"
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The exact name of the OBS Audio source to toggle mute.</p>
        </div>
      )}

      {act.type === 'obs_take_screenshot' && (
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>Save Folder Path</label>
          <input 
            type="text" 
            placeholder="C:\Users\Name\Pictures"
            value={act.payload || ''} 
            onChange={e => updateAction(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', backgroundColor: '#111', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
          />
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>The absolute path to the folder where the screenshot of the Current Program Scene will be saved.</p>
        </div>
      )}
    </div>
  );
}
