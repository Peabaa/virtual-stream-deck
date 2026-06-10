import { useState } from 'react';
import { 
  Mic, MicOff, Camera, CameraOff, Monitor, MonitorUp, Headphones, 
  Volume, VolumeX, Volume1, Volume2, Play, Pause, SkipBack, SkipForward, Square, 
  Globe, Folder, FolderOpen, File, Music, MessageSquare, Phone, Settings, 
  Power, Terminal, Code, PenTool, Gamepad2, Gamepad, Image, Video, Layers, Link, Map, Mail, 
  Plus, Minus, Check, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home,
  List, Menu, Activity, AlertCircle, Bell, Bookmark, Calendar, Clock, Cloud,
  Compass, Cpu, Database, Edit, Eye, EyeOff, Filter, Hash, Heart, Info, Key,
  Lock, Unlock, LogIn, LogOut, Maximize, Minimize, Moon, Sun, Navigation,
  RefreshCw, Save, Search, Send, Share, Shield, ShoppingCart, Star, Tag,
  ThumbsUp, ThumbsDown, Trash, Trash2, User, Users, VideoOff, Wifi, WifiOff,
  Zap
} from 'lucide-react';

export const CURATED_ICONS = {
  Mic, MicOff, Camera, CameraOff, Monitor, MonitorUp, Headphones, 
  Volume, VolumeX, Volume1, Volume2, Play, Pause, SkipBack, SkipForward, Square, 
  Globe, Folder, FolderOpen, File, Music, MessageSquare, Phone, Settings, 
  Power, Terminal, Code, PenTool, Gamepad2, Gamepad, Image, Video, Layers, Link, Map, Mail, 
  Plus, Minus, Check, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home,
  List, Menu, Activity, AlertCircle, Bell, Bookmark, Calendar, Clock, Cloud,
  Compass, Cpu, Database, Edit, Eye, EyeOff, Filter, Hash, Heart, Info, Key,
  Lock, Unlock, LogIn, LogOut, Maximize, Minimize, Moon, Sun, Navigation,
  RefreshCw, Save, Search, Send, Share, Shield, ShoppingCart, Star, Tag,
  ThumbsUp, ThumbsDown, Trash, Trash2, User, Users, VideoOff, Wifi, WifiOff,
  Zap
};

export type IconName = keyof typeof CURATED_ICONS;

interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconName: IconName) => void;
}

function IconPicker({ isOpen, onClose, onSelect }: IconPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredIcons = Object.keys(CURATED_ICONS).filter(name => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  ) as IconName[];

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        width: '500px',
        maxHeight: '80vh',
        backgroundColor: '#222',
        borderRadius: '12px',
        border: '1px solid #444',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Choose an Icon</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        
        <div style={{ padding: '15px', borderBottom: '1px solid #333' }}>
          <input 
            type="text" 
            placeholder="Search icons..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              boxSizing: 'border-box', 
              backgroundColor: '#111', 
              color: 'white', 
              border: '1px solid #555', 
              borderRadius: '4px' 
            }}
            autoFocus
          />
        </div>

        <div style={{ 
          padding: '20px', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', 
          gap: '15px', 
          overflowY: 'auto',
          flexGrow: 1
        }}>
          {filteredIcons.map((name) => {
            const Icon = CURATED_ICONS[name];
            return (
              <button
                key={name}
                onClick={() => {
                  onSelect(name);
                  onClose();
                }}
                title={name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#333',
                  border: '1px solid #444',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  color: 'white',
                  aspectRatio: '1/1'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#333'}
              >
                <Icon size={24} />
              </button>
            )
          })}
          {filteredIcons.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888', padding: '20px' }}>
              No icons found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IconPicker;
