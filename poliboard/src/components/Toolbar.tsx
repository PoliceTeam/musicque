import React, { useEffect } from 'react';
import { StrokeType } from '../types/stroke';

type ToolbarProps = {
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
  selectedType: StrokeType;
  setSelectedType: (type: StrokeType) => void;
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

const RectIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);

const CircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const LineIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5" />
  </svg>
);

const BrushIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19 7-7 3 3-7 7-3-3Z"/><path d="m18 13-1.5-7.5L4 2l3.5 12.5L13 16"/>
  </svg>
);

const GridIcon = ({ size }: { size: number }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    <text x="12" y="16" fontSize="8" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="bold">
      {size}
    </text>
  </svg>
);

export const Toolbar: React.FC<ToolbarProps> = ({ 
  color, setColor, width, setWidth, selectedType, setSelectedType 
}) => {
  const isEraser = color === 'eraser';
  const currentSizes = isEraser ? ERASER_SIZES : PEN_SIZES;

  useEffect(() => {
    if (!currentSizes.includes(width)) {
      setWidth(currentSizes[1]);
    }
  }, [isEraser, width, setWidth, currentSizes]);

  const ToolButton = ({ type, icon, title, activeColor = '#3b82f6' }: any) => {
    const isActive = selectedType === type && !isEraser;
    return (
      <button
        onClick={() => {
          setSelectedType(type);
          if (isEraser) setColor('#000000');
        }}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: isActive ? '#f1f5f9' : '#ffffff',
          border: isActive ? `2px solid ${activeColor}` : '1px solid #cbd5e1',
          color: isActive ? activeColor : '#64748b',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: isActive ? `0 2px 4px ${activeColor}33` : 'none'
        }}
        title={title}
      >
        {icon}
      </button>
    );
  };

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
      gap: '20px',
      alignItems: 'center',
      zIndex: 10,
      backdropFilter: 'blur(8px)',
      border: '1px solid #e5e7eb'
    }}>
      {/* Tool Section */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <ToolButton type="freehand" icon={<BrushIcon />} title="Bút vẽ" />
        <ToolButton type="line" icon={<LineIcon />} title="Đường thẳng" />
        <ToolButton type="rect" icon={<RectIcon />} title="Hình vuông" />
        <ToolButton type="circle" icon={<CircleIcon />} title="Hình tròn" />
      </div>

      <div style={{ width: '1px', height: '32px', backgroundColor: '#e5e7eb' }} />

      {/* Grid Section */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <ToolButton type="caro3" icon={<GridIcon size={3} />} title="Bàn Caro 3x3" activeColor="#eab308" />
        <ToolButton type="caro5" icon={<GridIcon size={5} />} title="Bàn Caro 5x5" activeColor="#eab308" />
        <ToolButton type="caro10" icon={<GridIcon size={10} />} title="Bàn Caro 10x10" activeColor="#eab308" />
      </div>

      <div style={{ width: '1px', height: '32px', backgroundColor: '#e5e7eb' }} />

      {/* Colors Section */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
            }}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: c,
              border: (c === color && !isEraser) ? '3px solid #cbd5e1' : '3px solid transparent',
              boxShadow: (c === color && !isEraser) ? '0 0 0 1px #333' : 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.2s ease'
            }}
            title={`Màu ${c}`}
            aria-label={`Color ${c}`}
          />
        ))}

        {/* Custom Color Picker */}
        <div 
          style={{ position: 'relative', width: '24px', height: '24px' }}
          title="Chọn màu tùy chỉnh"
        >
          <input
            type="color"
            value={!COLORS.includes(color) && !isEraser ? color : '#000000'}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              padding: 0,
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              opacity: 0,
              position: 'absolute',
              zIndex: 2,
            }}
          />
          <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: '50%',
              backgroundColor: (!COLORS.includes(color) && !isEraser) ? color : '#f8fafc',
              border: (!COLORS.includes(color) && !isEraser) ? '3px solid #cbd5e1' : '1px dashed #94a3b8',
              boxShadow: (!COLORS.includes(color) && !isEraser) ? '0 0 0 1px #333' : 'none',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              transition: 'all 0.2s ease'
          }}>
            {(!COLORS.includes(color) && !isEraser) ? null : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </div>
        </div>
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
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: s === width ? '#f1f5f9' : 'transparent',
              border: s === width ? '1px solid #cbd5e1' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ 
              width: `${Math.min(s, 20)}px`, 
              height: `${Math.min(s, 20)}px`, 
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
