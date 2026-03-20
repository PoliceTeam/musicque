import React, { useRef, useEffect, useState } from 'react';
import { Stroke, Viewport, Point, CursorState } from '../types/stroke';
import { screenToWorld } from '../utils/transform';

type InteractionMode = 'draw' | 'pan';

type CanvasProps = {
  strokes: Stroke[];
  currentStroke: Stroke | null;
  remoteActiveStrokesRef: React.MutableRefObject<Map<string, Stroke>>;
  cursorsRef: React.MutableRefObject<Record<string, CursorState>>;
  viewportRef: React.MutableRefObject<Viewport>;
  viewport: Viewport; // For cursor/UI reactivity
  onDrawStart: (point: Point) => void;
  onDrawMove: (point: Point) => void;
  onDrawEnd: () => void;
  onWheel: (e: WheelEvent) => void;
  onPan: (dx: number, dy: number) => void;
  width: number;
  height: number;
  brushWidth: number;
  brushColor: string;
};

export const Canvas: React.FC<CanvasProps> = ({
  strokes,
  currentStroke,
  remoteActiveStrokesRef,
  cursorsRef,
  viewportRef,
  viewport,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  onWheel,
  onPan,
  width,
  height,
  brushWidth,
  brushColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });

  // Space key tracking for pan mode
  const [mode, setMode] = useState<InteractionMode>('draw');
  const spacePressed = useRef(false);

  // Global keyboard listeners for Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !spacePressed.current) {
        e.preventDefault();
        spacePressed.current = true;
        setMode('pan');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        spacePressed.current = false;
        setMode('draw');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Attach non-passive wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Render loop — reads viewportRef directly for max perf
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;

      if (stroke.color === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color === 'eraser' ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const type = stroke.type || 'freehand';

      if (type === 'freehand') {
        ctx.beginPath();
        const pt0 = stroke.points[0];
        ctx.moveTo(pt0.x, pt0.y);

        if (stroke.points.length === 1) {
          ctx.arc(pt0.x, pt0.y, stroke.width / 2, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        if (stroke.points.length >= 3) {
          for (let i = 1; i < stroke.points.length - 1; i++) {
            const cp = stroke.points[i];
            const np = stroke.points[i + 1];
            const midX = (cp.x + np.x) / 2;
            const midY = (cp.y + np.y) / 2;
            ctx.quadraticCurveTo(cp.x, cp.y, midX, midY);
          }
          const last = stroke.points[stroke.points.length - 1];
          ctx.lineTo(last.x, last.y);
        } else {
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
        }
        ctx.stroke();
      } else {
        // Shapes logic
        const start = stroke.points[0];
        const end = stroke.points[1] || start;

        ctx.beginPath();
        if (type === 'rect') {
          ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (type === 'circle') {
          const radiusX = Math.abs(end.x - start.x) / 2;
          const radiusY = Math.abs(end.y - start.y) / 2;
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        } else if (type === 'line') {
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
        } else if (type.startsWith('caro')) {
          const size = parseInt(type.replace('caro', ''));
          const x = Math.min(start.x, end.x);
          const y = Math.min(start.y, end.y);
          const w = Math.abs(end.x - start.x);
          const h = Math.abs(end.y - start.y);
          
          // Outer border
          ctx.rect(x, y, w, h);
          
          // Grid lines
          for (let i = 1; i < size; i++) {
            // Vertical
            const vx = x + (w / size) * i;
            ctx.moveTo(vx, y);
            ctx.lineTo(vx, y + h);
            // Horizontal
            const hy = y + (h / size) * i;
            ctx.moveTo(x, hy);
            ctx.lineTo(x + w, hy);
          }
        }
        ctx.stroke();
      }
    };

    // Phase 3: Offscreen Canvas for caching finalized strokes
    const offscreenCanvas = document.createElement('canvas'); // Not attached to DOM
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    let lastVpStr = '';
    let lastStrokes = strokes;

    const render = () => {
      const vp = viewportRef.current;
      const vpStr = `${vp.scale},${vp.offsetX},${vp.offsetY}`;

      // Resize offscreen cache if screen bounds change
      if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        lastVpStr = ''; // Force redraw of cache
      }

      // 1. Check if cache needs drawing (viewport changed or strokes array reference changed)
      if (vpStr !== lastVpStr || strokes !== lastStrokes) {
        lastVpStr = vpStr;
        lastStrokes = strokes;
        
        if (offscreenCtx) {
          offscreenCtx.clearRect(0, 0, width, height);
          offscreenCtx.save();
          offscreenCtx.translate(vp.offsetX, vp.offsetY);
          offscreenCtx.scale(vp.scale, vp.scale);
          
          strokes.forEach((s) => drawStroke(offscreenCtx, s));
          
          offscreenCtx.restore();
        }
      }

      // 2. Main canvas rendering
      ctx.clearRect(0, 0, width, height);
      
      // Core perf win: Blit entire static background in 1 command
      ctx.drawImage(offscreenCanvas, 0, 0);

      // 3. Draw live active strokes (local and remote) on top
      ctx.save();
      ctx.translate(vp.offsetX, vp.offsetY);
      ctx.scale(vp.scale, vp.scale);

      // Draw all actively moving remote strokes bypassing React
      remoteActiveStrokesRef.current.forEach((s) => drawStroke(ctx, s));

      // Draw local current stroke
      if (currentStroke) drawStroke(ctx, currentStroke);

      ctx.restore();

      // 4. Draw Remote Cursors (Phase 4: 60fps interpolation directly on screen space)
      Object.values(cursorsRef.current).forEach((c) => {
        // Linear interpolation towards target for smooth glide feeling
        c.x += (c.targetX - c.x) * 0.2;
        c.y += (c.targetY - c.y) * 0.2;

        const cx = c.x * vp.scale + vp.offsetX;
        const cy = c.y * vp.scale + vp.offsetY;

        ctx.save();
        ctx.translate(cx, cy);

        // SVG Arrow Path
        const p = new Path2D('M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L5.5 3.21Z');
        ctx.fillStyle = c.data.color === 'eraser' ? '#94a3b8' : c.data.color;
        ctx.fill(p);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke(p);

        // Username Badge
        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(c.data.username).width;
        const bx = 14, by = 24, padding = 6;
        
        ctx.fillStyle = c.data.color === 'eraser' ? '#94a3b8' : c.data.color;
        ctx.beginPath();
        ctx.roundRect(bx, by, textWidth + padding * 2, 20, 6);
        ctx.fill();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText(c.data.username, bx + padding, by + 14);

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [strokes, currentStroke, remoteActiveStrokesRef, cursorsRef, viewportRef, width, height]);

  // --- Pointer handlers ---

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Middle mouse OR Space held → start pan
    if (e.button === 1 || spacePressed.current) {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    // Draw mode
    isDrawing.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const rect = canvasRef.current!.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, viewportRef.current);
    onDrawStart(worldPoint);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      onPan(dx, dy);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDrawing.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, viewportRef.current);
    onDrawMove(worldPoint);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      isPanning.current = false;
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      return;
    }
    if (isDrawing.current) {
      isDrawing.current = false;
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      onDrawEnd();
    }
  };

  // --- Cursor ---
  const getCursor = (): string => {
    if (mode === 'pan') {
      return isPanning.current ? 'grabbing' : 'grab';
    }
    // Draw mode: brush circle cursor
    const actualSize = brushWidth * viewport.scale;
    const svgCursor = `<svg xmlns="http://www.w3.org/2000/svg" width="${actualSize + 2}" height="${actualSize + 2}" viewBox="0 0 ${actualSize + 2} ${actualSize + 2}">
      <circle cx="${(actualSize + 2) / 2}" cy="${(actualSize + 2) / 2}" r="${actualSize / 2}" fill="${brushColor === 'eraser' ? 'rgba(255,255,255,0.5)' : brushColor}" opacity="0.5" stroke="#000000" stroke-width="1"/>
    </svg>`;
    return `url('data:image/svg+xml;utf8,${encodeURIComponent(svgCursor)}') ${(actualSize + 2) / 2} ${(actualSize + 2) / 2}, crosshair`;
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        display: 'block',
        touchAction: 'none',
        cursor: getCursor(),
        backgroundColor: '#ffffff',
      }}
    />
  );
};
