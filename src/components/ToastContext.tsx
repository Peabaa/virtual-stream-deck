import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}>
        {toasts.map(toast => {
          let bgColor = 'rgba(30, 30, 35, 0.9)';
          let borderColor = '#555';
          if (toast.type === 'success') {
            bgColor = 'rgba(46, 125, 50, 0.9)';
            borderColor = '#4caf50';
          } else if (toast.type === 'error') {
            bgColor = 'rgba(211, 47, 47, 0.9)';
            borderColor = '#f44336';
          }

          return (
            <div 
              key={toast.id}
              style={{
                backgroundColor: bgColor,
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(10px)',
                animation: 'fade-in-up 0.3s ease-out forwards',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                maxWidth: '300px',
                wordWrap: 'break-word'
              }}
            >
              {toast.message}
            </div>
          );
        })}
      </div>
      
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
