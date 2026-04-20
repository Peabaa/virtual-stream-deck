import { useState, KeyboardEvent, useEffect } from 'react';

interface HotkeyInputProps {
  value: string;
  onChange: (hotkey: string) => void;
}

export default function HotkeyInput({ value, onChange }: HotkeyInputProps) {
  const [isListening, setIsListening] = useState(false);

  // If user clicks away while listening, stop listening
  useEffect(() => {
    const handleWindowClick = () => setIsListening(false);
    if (isListening) {
      window.addEventListener('click', handleWindowClick);
    }
    return () => window.removeEventListener('click', handleWindowClick);
  }, [isListening]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!isListening) return;

    e.preventDefault();
    e.stopPropagation();

    // Escape kills listening
    if (e.key === 'Escape') {
      setIsListening(false);
      return;
    }

    const modifiers: string[] = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('CommandOrControl');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');

    let mainKey = e.key.toUpperCase();
    
    // Ignore standalone modifiers
    if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(mainKey)) {
      return;
    }

    if (mainKey === ' ') mainKey = 'Space';
    if (e.code.startsWith('Numpad')) mainKey = e.code; // Prefer 'Numpad1' over '1' for numerical pad keys

    const combination = [...modifiers, mainKey].join('+');
    
    onChange(combination);
    setIsListening(false);
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsListening(true);
      }}
      onKeyDown={handleKeyDown}
      style={{
        padding: '10px 16px',
        backgroundColor: isListening ? '#396cd8' : '#333',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1rem',
        minWidth: '200px',
        transition: 'background-color 0.2s',
      }}
    >
      {isListening ? 'Press any combination...' : (value || 'Click to set hotkey')}
    </button>
  );
}
