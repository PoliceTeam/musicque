import React, { useEffect } from 'react';

type ToolbarProps = {
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
};

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];
const PEN_SIZES = [2, 5, 10, 20];
const ERASER_SIZES = [10, 20, 40, 80];

const EraserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
    <path d="M22 21H7"></path>
    <path d="m5 11 9 9"></path>
  </svg>
);

export const Toolbar: React.FC<ToolbarProps> = ({ color, setColor, width, setWidth }) => {
  const isEraser = color === 'eraser';
  const currentSizes = isEraser ? ERASER_SIZES : PEN_SIZES;

  // Auto-adjust width when switching modes if the current width isn't in the new array
  useEffect(() => {
    if (!currentSizes.includes(width)) {
      setWidth(currentSizes[1]); // Default to second size
    }
  }, [isEraser, width, setWidth, currentSizes]);

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: '12px 24px',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      display: 'flex',
      gap: '24px',
      alignItems: 'center',
      zIndex: 10,
      backdropFilter: 'blur(8px)',
      border: '1px solid #e5e7eb'
    }}>
      {/* Colors Section */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: c,
              border: c === color ? '3px solid #cbd5e1' : '3px solid transparent',
              boxShadow: c === color ? '0 0 0 1px #333' : 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.2s ease'
            }}
            aria-label={`Color ${c}`}
            title="Bút vẽ"
          />
        ))}
      </div>

      <div style={{ width: '1px', height: '32px', backgroundColor: '#e5e7eb' }} />

      {/* Eraser Section */}
      <button
        onClick={() => setColor('eraser')}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: isEraser ? '#f1f5f9' : '#ffffff',
          border: isEraser ? '2px solid #3b82f6' : '1px solid #cbd5e1',
          color: isEraser ? '#3b82f6' : '#64748b',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: isEraser ? '0 2px 4px rgba(59, 130, 246, 0.2)' : 'none'
        }}
        title="Cục Tẩy"
      >
        <EraserIcon />
      </button>
      
      <div style={{ width: '1px', height: '32px', backgroundColor: '#e5e7eb' }} />
      
      {/* Sizes Section */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {currentSizes.map(s => (
          <button
            key={s}
            onClick={() => setWidth(s)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: s === width ? '#f1f5f9' : 'transparent',
              border: s === width ? '1px solid #cbd5e1' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            title={`Kích thước ${s}`}
          >
            <div style={{ 
              width: `${Math.min(s, 24)}px`, 
              height: `${Math.min(s, 24)}px`, 
              backgroundColor: isEraser ? '#94a3b8' : '#333', 
              borderRadius: '50%',
              border: isEraser ? '1px solid #cbd5e1' : 'none'
            }} />
          </button>
        ))}
      </div>
    </div>
  );
};
