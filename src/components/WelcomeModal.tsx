import { useState } from 'react';

interface WelcomeModalProps {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(1);

  const renderContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <h2 style={{ marginTop: 0 }}>Welcome to Virtual Stream Deck!</h2>
            <p style={{ lineHeight: '1.6', color: '#ccc' }}>
              Virtual Stream Deck is a completely software-based alternative to expensive hardware macro pads. It allows you to create custom buttons, automate tasks, and control OBS Studio.
            </p>
            <div style={{ backgroundColor: 'rgba(57, 108, 216, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(57, 108, 216, 0.3)', marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#74b9ff' }}>How to add buttons:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#bbb' }}>
                <li style={{ marginBottom: '8px' }}>Click on any empty grid square in the <b>Dashboard</b>.</li>
                <li style={{ marginBottom: '8px' }}>Use the <b>Button Editor</b> on the right to set a Label, Color, and Icon.</li>
                <li>Scroll down to the <b>Action Chain</b> to assign what happens when the button is pressed (e.g., Run a Keyboard Shortcut, Open an App).</li>
              </ul>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <h2 style={{ marginTop: 0 }}>Active App Tracking</h2>
            <p style={{ lineHeight: '1.6', color: '#ccc' }}>
              You can create different <b>Profiles</b> for different games or applications. Virtual Stream Deck can automatically switch to the correct profile when you focus a specific app!
            </p>
            <div style={{ backgroundColor: 'rgba(46, 125, 50, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(46, 125, 50, 0.3)', marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#4caf50' }}>How to link a profile:</h4>
              <ol style={{ margin: 0, paddingLeft: '20px', color: '#bbb' }}>
                <li style={{ marginBottom: '8px' }}>Create a new profile using the <b>+ New</b> button at the top.</li>
                <li style={{ marginBottom: '8px' }}>Click the <b>🎯 Detect</b> button.</li>
                <li>Immediately click into the Game or App you want to link. The tracker will detect its `.exe` name automatically!</li>
              </ol>
            </div>
          </>
        );
      case 3:
        return (
          <>
            <h2 style={{ marginTop: 0 }}>The On-Screen Display (OSD)</h2>
            <p style={{ lineHeight: '1.6', color: '#ccc' }}>
              The OSD is a floating, transparent version of your grid that hovers over your games or desktop so you can click your macros without alt-tabbing.
            </p>
            <div style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(156, 39, 176, 0.3)', marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#e040fb' }}>How to summon the OSD:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#bbb' }}>
                <li style={{ marginBottom: '8px' }}>Go to the <b>Settings Tab</b> (the gear icon on the far left).</li>
                <li style={{ marginBottom: '8px' }}>Set your <b>Global OSD Hotkey</b> (e.g., <code>Ctrl + Shift + D</code>).</li>
                <li>Press that hotkey anytime to summon or hide the floating deck! You can drag it by its top edge to reposition it.</li>
              </ul>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: '#1e1e24',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        width: '500px',
        maxWidth: '90vw',
        padding: '30px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        position: 'relative'
      }}>
        
        {/* Content */}
        <div style={{ minHeight: '250px' }}>
          {renderContent()}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                style={{ 
                  width: '8px', height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: step === i ? '#fff' : 'rgba(255,255,255,0.2)',
                  transition: 'background-color 0.3s'
                }} 
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {step > 1 && (
              <button 
                onClick={() => setStep(step - 1)}
                style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}
              >
                Back
              </button>
            )}
            
            {step < 3 ? (
              <button 
                onClick={() => setStep(step + 1)}
                style={{ padding: '8px 16px', backgroundColor: '#396cd8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Next
              </button>
            ) : (
              <button 
                onClick={onClose}
                style={{ padding: '8px 16px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Get Started
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
