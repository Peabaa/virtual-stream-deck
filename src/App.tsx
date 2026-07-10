import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Osd from './Osd';
import Dashboard from './Dashboard';
import { ToastProvider } from './components/ToastContext';

function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    // Determine which window is currently rendering
    setWindowLabel(getCurrentWindow().label);
  }, []);

  return (
    <ToastProvider>
      {windowLabel === 'osd' ? <Osd /> : windowLabel === 'dashboard' ? <Dashboard /> : <div style={{ color: 'white' }}>Loading...</div>}
    </ToastProvider>
  );
}

export default App;
