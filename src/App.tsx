import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Osd from './Osd';
import Dashboard from './Dashboard';

function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    // Determine which window is currently rendering
    setWindowLabel(getCurrentWindow().label);
  }, []);

  if (windowLabel === 'osd') {
    return <Osd />;
  }

  if (windowLabel === 'dashboard') {
    return <Dashboard />;
  }

  // Fallback while detecting or if window label doesn't match
  return <div style={{ color: 'white' }}>Loading...</div>;
}

export default App;
