import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { useDraw } from '../hooks/useDraw';
import { useSocket } from '../hooks/useSocket';
import { useViewport } from '../hooks/useViewport';
import { Point, CursorData } from '../types/stroke';
import { screenToWorld } from '../utils/transform';

type BoardProps = {
  roomId?: string;
  username?: string;
};

const Board: React.FC<BoardProps> = ({ roomId = 'default-room', username = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});

  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(3);

  const {
    currentStroke,
    strokes,
    setStrokes,
    startDrawing,
    draw,
    stopDrawing,
    addStroke,
    appendRemotePoint,
    finalizeRemoteStroke,
    clear
  } = useDraw();

  const { viewport, viewportRef, handleWheel, pan, resetViewport } = useViewport();

  const {
    emitStrokeStart,
    emitStrokeMove,
    emitStrokeEnd,
    emitCursorMove,
    emitCursorLeave
  } = useSocket({
    roomId,
    onInitBoard: (initialStrokes) => setStrokes(initialStrokes),
    onStrokeStart: (stroke) => addStroke(stroke),
    onStrokeMove: (strokeId, point) => appendRemotePoint(strokeId, point),
    onStrokeEnd: (strokeId) => finalizeRemoteStroke(strokeId),
    onClearReceived: clear,
    onCursorMove: (cursor) => setCursors(prev => ({ ...prev, [cursor.id]: cursor })),
    onCursorRemove: (cursorId) => {
      setCursors(prev => {
        const next = { ...prev };
        delete next[cursorId];
        return next;
      });
    }
  });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Countdown timer logic (Reset at midnight)
  const getNextMidnight = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).getTime();
  };

  const [expiresAt, setExpiresAt] = useState<number>(getNextMidnight());
  const [timeLeftStr, setTimeLeftStr] = useState('00:00:00');

  useEffect(() => {
    const interval = setInterval(() => {
      let remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setExpiresAt(getNextMidnight());
        remaining = getNextMidnight() - Date.now();
      }

      const hours = Math.floor(remaining / 1000 / 60 / 60);
      const mins = Math.floor((remaining / 1000 / 60) % 60);
      const secs = Math.floor((remaining / 1000) % 60);
      setTimeLeftStr(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleDrawStart = (point: Point) => {
    const stroke = startDrawing(point, color, width);
    emitStrokeStart(stroke);
  };

  const handleDrawMove = (point: Point) => {
    const updated = draw(point);
    if (updated) {
      // Send only the new point, not entire stroke
      emitStrokeMove(updated.id, point);
    }
  };

  const handleDrawEnd = () => {
    const finalStroke = stopDrawing();
    if (finalStroke) {
      emitStrokeEnd(finalStroke.id);
    }
  };

  // Throttle cursor emit to ~30fps to avoid flooding the socket
  const lastCursorEmit = useRef(0);
  const handlePointerMoveCapture = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const now = Date.now();
    if (now - lastCursorEmit.current < 33) return; // ~30fps
    lastCursorEmit.current = now;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPoint = screenToWorld({ x, y }, viewport);

    emitCursorMove({
      x: worldPoint.x,
      y: worldPoint.y,
      username: username.trim() || 'Khách',
      color
    });
  }, [viewport, username, color, emitCursorMove]);

  const handlePointerLeave = useCallback(() => {
    emitCursorLeave();
  }, [emitCursorLeave]);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMoveCapture}
      onPointerLeave={handlePointerLeave}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#fafafa'
      }}
    >
      <Toolbar
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
      />
      <Canvas
        width={dimensions.width}
        height={dimensions.height}
        brushWidth={width}
        brushColor={color}
        strokes={strokes}
        currentStroke={currentStroke}
        viewportRef={viewportRef}
        viewport={viewport}
        onDrawStart={handleDrawStart}
        onDrawMove={handleDrawMove}
        onDrawEnd={handleDrawEnd}
        onWheel={handleWheel}
        onPan={pan}
      />

      {/* Remote Cursors */}
      {Object.values(cursors).map(cursor => {
        // Convert world back to screen coordinates for rendering
        const screenX = cursor.x * viewport.scale + viewport.offsetX;
        const screenY = cursor.y * viewport.scale + viewport.offsetY;

        return (
          <div
            key={cursor.id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              pointerEvents: 'none',
              zIndex: 50,
              transform: 'translate(-2px, -2px)', // Shift SVG tip to exactly match pointer
              transition: 'transform 0.05s linear, left 0.05s linear, top 0.05s linear' // Smooth cursor movement
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={cursor.color === 'eraser' ? '#94a3b8' : cursor.color} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round">
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L5.5 3.21Z"></path>
            </svg>
            <div style={{
              backgroundColor: cursor.color === 'eraser' ? '#94a3b8' : cursor.color,
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              position: 'absolute',
              top: 24,
              left: 14,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}>
              {cursor.username}
            </div>
          </div>
        );
      })}

      {/* Zoom scale indicator and reset button */}
      <button
        onClick={resetViewport}
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '8px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
          backdropFilter: 'blur(8px)',
          border: '1px solid #e5e7eb',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          color: '#475569',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'}
        title="Về giữa trang (Reset View)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        {Math.round(viewport.scale * 100)}%
      </button>

      {/* Top Right Container (Avatars and Timer) */}
      <div style={{
        position: 'absolute',
        top: 24,
        right: 24,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        zIndex: 50,
      }}>
        {/* Active Users Avatars */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            title={(username.trim() || 'Khách') + ' (Bạn)'}
            style={{
              width: '36px', height: '36px', borderRadius: '50%', backgroundColor: color === 'eraser' ? '#94a3b8' : color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: '2px solid #fff', zIndex: 100, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'default'
            }}
          >
            {(username.trim() || 'Khách').charAt(0).toUpperCase()}
          </div>
          {Object.values(cursors).slice(0, 3).map((c, i) => (
            <div
              key={c.id}
              title={c.username}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', backgroundColor: c.color === 'eraser' ? '#94a3b8' : c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: '2px solid #fff', marginLeft: '-12px', zIndex: 99 - i, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'default'
              }}
            >
              {(c.username || '?').charAt(0).toUpperCase()}
            </div>
          ))}
          {Object.keys(cursors).length > 3 && (
            <div
              title={Object.values(cursors).slice(3).map(c => c.username).join(', ')}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', border: '2px solid #fff', marginLeft: '-12px', zIndex: 95, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'default'
              }}
            >
              +{Object.keys(cursors).length - 3}
            </div>
          )}
        </div>

        {/* Countdown Timer */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '8px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backdropFilter: 'blur(8px)',
          border: '1px solid #e5e7eb',
          fontSize: '14px',
          fontWeight: '600',
          color: '#64748b',
          pointerEvents: 'none',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Reset after: <span style={{ color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{timeLeftStr}</span>
        </div>
      </div>
    </div>
  );
};

export default Board;
