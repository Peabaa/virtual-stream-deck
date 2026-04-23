import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { loadActiveProfile, DeckProfile, DEFAULT_PROFILE } from './store';
import './App.css';

function Osd() {
  const [profile, setProfile] = useState<DeckProfile>(DEFAULT_PROFILE);

  const fetchProfile = async () => {
    const p = await loadActiveProfile();
    setProfile(p);
  };

  useEffect(() => {
    fetchProfile();
    
    // Listen for updates from the Dashboard
    const unlisten = listen('profile_updated', () => {
      fetchProfile();
    });

    // Fallback: forcefully fetch the latest profile whenever the OSD window gains focus/visibility
    const handleFocus = () => fetchProfile();
    window.addEventListener('focus', handleFocus);

    return () => {
      unlisten.then(f => f());
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return (
    <main data-tauri-drag-region className="deck-container">
      <div className="status-bar">
        <span>Numpad Deck</span>
        <div className="dot" />
      </div>

      <div 
        className="button-grid" 
        style={{ 
          gridTemplateColumns: `repeat(${profile.columns}, 1fr)`,
          gridTemplateRows: `repeat(${profile.rows}, 1fr)` // Keep rows evenly distributed
        }}
      >
        {Array.from({ length: profile.rows }).map((_, y) => (
          Array.from({ length: profile.columns }).map((_, x) => {
            const id = `${x},${y}`;
            const btnData = profile.buttons[id];
            
            return (
              <button 
                key={id} 
                className="deck-button"
                style={{
                  backgroundColor: btnData?.color || 'rgba(255, 255, 255, 0.08)',
                }}
              >
                {btnData?.label || id}
              </button>
            );
          })
        ))}
      </div>
    </main>
  );
}

export default Osd;
