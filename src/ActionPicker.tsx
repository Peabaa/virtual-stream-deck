import React, { useState } from 'react';
import { ActionType } from './store';
import { Ban, Link, FolderOpen, Keyboard, Zap, MonitorPlay, Clapperboard, Eye, Mic, Radio, CircleDot, Webcam, Image as ImageIcon, Laptop, Volume2, Volume1, VolumeX, PlayCircle, SkipForward, SkipBack, Cpu } from 'lucide-react';

interface ActionDefinition {
  type: ActionType;
  label: string;
  description: string;
  icon: React.ElementType;
}

interface ActionCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  actions: ActionDefinition[];
}

const ACTION_CATEGORIES: ActionCategory[] = [
  {
    id: 'general',
    name: 'General',
    icon: Laptop,
    actions: [
      { type: 'none', label: 'None', description: 'Do nothing when pressed.', icon: Ban },
      { type: 'open_url', label: 'Open URL / File', description: 'Launch a website, app, or file.', icon: Link },
      { type: 'open_folder', label: 'Switch Profile', description: 'Instantly swap your deck layout.', icon: FolderOpen },
      { type: 'type_text', label: 'Type Text', description: 'Automatically type a paragraph.', icon: Keyboard },
      { type: 'run_macro', label: 'Run Macro', description: 'Execute a keyboard shortcut sequence.', icon: Zap },
      { type: 'sys_send_keypress', label: 'Simulate Key', description: 'Send a physical keypress to the OS.', icon: Keyboard },
    ]
  },
  {
    id: 'obs',
    name: 'OBS Studio',
    icon: MonitorPlay,
    actions: [
      { type: 'obs_switch_scene', label: 'Switch Scene', description: 'Change the active OBS scene.', icon: Clapperboard },
      { type: 'obs_toggle_source', label: 'Toggle Source', description: 'Show or hide a specific source.', icon: Eye },
      { type: 'obs_toggle_mute', label: 'Toggle Audio Mute', description: 'Mute or unmute an audio input.', icon: Mic },
      { type: 'obs_toggle_stream', label: 'Toggle Stream', description: 'Start or stop streaming.', icon: Radio },
      { type: 'obs_toggle_record', label: 'Toggle Record', description: 'Start or stop recording.', icon: CircleDot },
      { type: 'obs_toggle_virtual_cam', label: 'Toggle Virtual Cam', description: 'Start or stop virtual camera.', icon: Webcam },
      { type: 'obs_take_screenshot', label: 'Take Screenshot', description: 'Capture the current OBS program.', icon: ImageIcon },
    ]
  },
  {
    id: 'system',
    name: 'Windows System',
    icon: Cpu,
    actions: [
      { type: 'sys_volume_up', label: 'Volume Up', description: 'Increase the master volume.', icon: Volume2 },
      { type: 'sys_volume_down', label: 'Volume Down', description: 'Decrease the master volume.', icon: Volume1 },
      { type: 'sys_volume_mute', label: 'Toggle Mute', description: 'Mute or unmute the system.', icon: VolumeX },
      { type: 'sys_media_play_pause', label: 'Play / Pause', description: 'Toggle media playback.', icon: PlayCircle },
      { type: 'sys_media_next', label: 'Next Track', description: 'Skip to the next track.', icon: SkipForward },
      { type: 'sys_media_prev', label: 'Previous Track', description: 'Go to the previous track.', icon: SkipBack },
    ]
  }
];

export const ACTION_DEFS: Record<ActionType, ActionDefinition> = ACTION_CATEGORIES.reduce((acc, cat) => {
  cat.actions.forEach(a => acc[a.type] = a);
  return acc;
}, {} as Record<ActionType, ActionDefinition>);

interface ActionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (actionType: ActionType) => void;
}

export function ActionPicker({ isOpen, onClose, onSelect }: ActionPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(ACTION_CATEGORIES[0].id);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', width: '800px', height: '600px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#22222d'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Choose an Action</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.5rem', lineHeight: '1rem' }}>✕</button>
        </div>

        {/* Content Split */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Sidebar */}
          <div style={{ width: '220px', backgroundColor: '#1a1a24', borderRight: '1px solid rgba(255,255,255,0.1)', padding: '15px', overflowY: 'auto' }}>
            {ACTION_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '12px 15px', marginBottom: '8px',
                  backgroundColor: selectedCategory === cat.id ? 'rgba(57, 108, 216, 0.3)' : 'transparent',
                  color: selectedCategory === cat.id ? '#74b9ff' : '#ccc',
                  border: 'none', borderRadius: '8px',
                  textAlign: 'left', cursor: 'pointer', fontSize: '1rem',
                  transition: 'all 0.2s', fontWeight: selectedCategory === cat.id ? 'bold' : 'normal'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}><cat.icon size={20} /></span>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Action Grid */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: '#15151e' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
              {ACTION_CATEGORIES.find(c => c.id === selectedCategory)?.actions.map(action => (
                <button
                  key={action.type}
                  onClick={() => {
                    onSelect(action.type);
                    onClose();
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '15px', backgroundColor: '#22222d',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                    color: 'white'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#2c2c3a';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'rgba(57, 108, 216, 0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#22222d';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', color: '#74b9ff' }}><action.icon size={24} /></span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{action.label}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>{action.description}</span>
                </button>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
