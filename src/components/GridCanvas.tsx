import React from 'react';
import { DeckProfile } from '../store';
import { ObsState } from '../obsService';
import { CURATED_ICONS, IconName } from '../IconPicker';

interface GridCanvasProps {
  draftProfile: DeckProfile;
  handleDimensionChange: (key: 'rows' | 'columns', val: number) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
  selectedButtonId: string | null;
  setSelectedButtonId: (id: string | null) => void;
  dragSourceId: string | null;
  dragOverId: string | null;
  isDraggingRef: React.MutableRefObject<boolean>;
  handleMouseDown: (e: React.MouseEvent, id: string) => void;
  obsState: ObsState;
}

export function GridCanvas({
  draftProfile, handleDimensionChange, gridRef, selectedButtonId, setSelectedButtonId,
  dragSourceId, dragOverId, isDraggingRef, handleMouseDown, obsState
}: GridCanvasProps) {
  return (
    <div style={{ flex: 2, padding: '25px', backgroundColor: 'rgba(30,30,35,0.6)', backdropFilter: 'blur(10px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Grid Layout</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label>Cols:</label>
          <input type="number" value={draftProfile.columns} onChange={e => handleDimensionChange('columns', parseInt(e.target.value))} style={{ width: '50px' }} />
          <label>Rows:</label>
          <input type="number" value={draftProfile.rows} onChange={e => handleDimensionChange('rows', parseInt(e.target.value))} style={{ width: '50px' }} />
        </div>
      </div>

      <div
        ref={gridRef}
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${draftProfile.columns}, 1fr)`, 
          gap: '10px',
          backgroundColor: '#111',
          padding: '20px',
          borderRadius: '8px'
        }}
      >
        {Array.from({ length: draftProfile.rows }).map((_, y) => (
          Array.from({ length: draftProfile.columns }).map((_, x) => {
            const id = `${x},${y}`;
            const btnData = draftProfile.buttons[id];
            const isSelected = selectedButtonId === id;
            const isBeingDragged = dragSourceId === id;
            const isDropTarget = dragOverId === id && dragSourceId !== id;
            
            let stateCssClass = '';
            if (btnData?.action) {
              switch (btnData.action.type) {
                case 'obs_toggle_record': stateCssClass = obsState.isRecording ? 'state-pulse-red' : ''; break;
                case 'obs_toggle_stream': stateCssClass = obsState.isStreaming ? 'state-pulse-red' : ''; break;
                case 'obs_toggle_virtual_cam': stateCssClass = obsState.isVirtualCamOn ? 'state-pulse-blue' : ''; break;
                case 'obs_switch_scene': stateCssClass = obsState.currentScene === btnData.action.payload ? 'state-pulse-blue' : ''; break;
                case 'obs_toggle_mute': stateCssClass = obsState.mutedInputs[btnData.action.payload || ''] === true ? 'state-pulse-yellow' : ''; break;
              }
            }

            return (
              <div 
                key={id}
                data-cell-id={id}
                onClick={() => { if (!isDraggingRef.current) setSelectedButtonId(id); }}
                onMouseDown={(e) => handleMouseDown(e, id)}
                className={stateCssClass}
                style={{
                  aspectRatio: '1 / 1',
                  backgroundColor: btnData?.color || 'rgba(255, 255, 255, 0.08)',
                  color: 'white',
                  border: isSelected ? '2px solid #396cd8' : (isDropTarget ? '2px dashed #4caf50' : '1px solid rgba(255,255,255,0.1)'),
                  boxShadow: 'none',
                  opacity: isBeingDragged ? 0.4 : 1,
                  transform: isDropTarget ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.1s ease, opacity 0.1s ease',
                  borderRadius: '8px',
                  cursor: dragSourceId ? 'grabbing' : 'grab',
                  fontWeight: 'bold',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  overflow: 'hidden',
                  padding: '5px',
                  userSelect: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {btnData?.imageUrl ? (
                  <img src={btnData.imageUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain', pointerEvents: 'none' }} />
                ) : btnData?.iconName && CURATED_ICONS[btnData.iconName as IconName] ? (
                  <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                      const Icon = CURATED_ICONS[btnData.iconName as IconName];
                      return <Icon size={32} color={btnData.fontColor || 'white'} />;
                    })()}
                  </div>
                ) : null}
                <span style={{ 
                  fontSize: '0.8rem', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  maxWidth: '100%',
                  color: btnData?.fontColor || 'white',
                  pointerEvents: 'none'
                }}>
                  {btnData?.label || id}
                </span>
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}
