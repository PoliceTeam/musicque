import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { useDraw } from '../hooks/useDraw';
import { useSocket } from '../hooks/useSocket';
import { useViewport } from '../hooks/useViewport';
import { Point, CursorState, StrokeType } from '../types/stroke';
import { screenToWorld } from '../utils/transform';

type BoardProps = {
  roomId?: string;
  username?: string;
};

const Board: React.FC<BoardProps> = ({ roomId = 'default-room', username = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Phase 4: Track via Ref, no React state to avoid massive re-renders
  const cursorsRef = useRef<Record<string, CursorState>>({});

  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Track IDs of strokes drawn by the current user (for undo)
  const myStrokeIdsRef = useRef<string[]>([]);

  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(3);
  const [selectedType, setSelectedType] = useState<StrokeType>('freehand');

  const {
    currentStroke,
    strokes,
    setStrokes,
    remoteActiveStrokesRef,
    startDrawing,
    draw,
    stopDrawing,
    addStroke,
    appendRemotePoint,
    finalizeRemoteStroke,
    clear,
    undo
  } = useDraw();

  const { viewport, viewportRef, handleWheel, pan, resetViewport } = useViewport();

  const {
    emitStrokeStart,
    emitStrokeMove,
    emitStrokeEnd,
    emitUndo,
    emitCursorMove,
    emitCursorLeave
  } = useSocket({
    roomId,
    onInitBoard: (initialStrokes) => {
      // Phase 5: Chunked loading for massive boards to avoid UI freeze
      if (initialStrokes.length > 50) {
        let loaded = 0;
        const chunkSize = 50;

        const processChunk = () => {
          const next = initialStrokes.slice(0, loaded + chunkSize);
          setStrokes(next);
          loaded += chunkSize;
          setLoadingProgress(Math.floor(Math.min(100, (loaded / initialStrokes.length) * 100)));

          if (loaded < initialStrokes.length) {
            requestAnimationFrame(processChunk);
          } else {
            setLoading(false);
          }
        };
        requestAnimationFrame(processChunk);
      } else {
        setStrokes(initialStrokes);
        setLoading(false);
      }
    },
    onStrokeStart: (stroke) => addStroke(stroke),
    onStrokeMove: (strokeId, point) => appendRemotePoint(strokeId, point),
    onStrokeEnd: (stroke) => finalizeRemoteStroke(stroke),
    onClearReceived: () => {
      clear();
      myStrokeIdsRef.current = [];
    },
    onUndoReceived: (strokeId) => {
      undo(strokeId);
      // Also remove from our own tracking if it was ours
      myStrokeIdsRef.current = myStrokeIdsRef.current.filter(id => id !== strokeId);
    },
    onCursorMove: (cursor) => {
      // Phase 4: Mutate ref bypassing React
      if (!cursor.id) return;
      const exist = cursorsRef.current[cursor.id];
      if (exist) {
        exist.targetX = cursor.x;
        exist.targetY = cursor.y;
        exist.data = cursor;
      } else {
        cursorsRef.current[cursor.id] = {
          data: cursor,
          x: cursor.x, y: cursor.y,
          targetX: cursor.x, targetY: cursor.y
        };
      }
    },
    onCursorRemove: (cursorId) => {
      delete cursorsRef.current[cursorId];
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
    const stroke = startDrawing(point, color, width, selectedType);
    myStrokeIdsRef.current.push(stroke.id);
    emitStrokeStart(stroke);
  };

  const lastDrawEmit = useRef(0);
  const handleDrawMove = (point: Point) => {
    const updated = draw(point);
    if (updated) {
      // Phase 1: Throttle network emissions to ~60fps (16ms)
      const now = Date.now();
      if (now - lastDrawEmit.current > 16) {
        lastDrawEmit.current = now;
        emitStrokeMove(updated.id, point);
      }
    }
  };

  const handleDrawEnd = () => {
    const finalStroke = stopDrawing();
    if (finalStroke) {
      // Phase 2: emit simplified full stroke to server for overwrite
      emitStrokeEnd(finalStroke);
    }
  };

  // Undo: remove last own stroke
  const handleUndo = useCallback(() => {
    const lastId = myStrokeIdsRef.current.pop();
    if (lastId) {
      undo(lastId);
      emitUndo(lastId);
    }
  }, [undo, emitUndo]);

  // Ctrl+Z / Cmd+Z keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

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
        selectedType={selectedType}
        setSelectedType={setSelectedType}
      />
      <Canvas
        width={dimensions.width}
        height={dimensions.height}
        brushWidth={width}
        brushColor={color}
        strokes={strokes}
        currentStroke={currentStroke}
        remoteActiveStrokesRef={remoteActiveStrokesRef}
        cursorsRef={cursorsRef}
        viewportRef={viewportRef}
        viewport={viewport}
        onDrawStart={handleDrawStart}
        onDrawMove={handleDrawMove}
        onDrawEnd={handleDrawEnd}
        onWheel={handleWheel}
        onPan={pan}
      />

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 999
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
          }}>
            <svg style={{ animation: 'spin 1s linear infinite', width: '40px', height: '40px', color: '#3b82f6' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div style={{ fontWeight: 600, color: '#475569' }}>
              Đang tải dữ liệu bảng vẽ... {loadingProgress > 0 && `${loadingProgress}%`}
            </div>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Bottom left controls: Zoom scale indicator, reset button, undo button */}
      <div style={{ position: 'absolute', bottom: 24, left: 24, zIndex: 10, display: 'flex', gap: '12px' }}>
        <button
          onClick={resetViewport}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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

        <button
          onClick={handleUndo}
          disabled={myStrokeIdsRef.current.length === 0}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(8px)',
            border: '1px solid #e5e7eb',
            cursor: myStrokeIdsRef.current.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            color: myStrokeIdsRef.current.length === 0 ? '#94a3b8' : '#475569',
            transition: 'all 0.2s ease',
            opacity: myStrokeIdsRef.current.length === 0 ? 0.7 : 1,
          }}
          onMouseOver={(e) => { if (myStrokeIdsRef.current.length > 0) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'; }}
          title="Hoàn tác nét vẽ (Ctrl+Z / Cmd+Z)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"></path>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
          </svg>
          Hoàn tác
        </button>
      </div>

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
          {Object.values(cursorsRef.current).slice(0, 3).map((c, i) => (
            <div
              key={c.data.id}
              title={c.data.username}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', backgroundColor: c.data.color === 'eraser' ? '#94a3b8' : c.data.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: '2px solid #fff', marginLeft: '-12px', zIndex: 99 - i, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'default'
              }}
            >
              {(c.data.username || '?').charAt(0).toUpperCase()}
            </div>
          ))}
          {Object.keys(cursorsRef.current).length > 3 && (
            <div
              title={Object.values(cursorsRef.current).slice(3).map(c => c.data.username).join(', ')}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', border: '2px solid #fff', marginLeft: '-12px', zIndex: 95, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'default'
              }}
            >
              +{Object.keys(cursorsRef.current).length - 3}
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
