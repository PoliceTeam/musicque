import React, { useRef, useEffect, useState } from 'react';
import { Stroke, Viewport, Point } from '../types/stroke';
import { screenToWorld } from '../utils/transform';

type InteractionMode = 'draw' | 'pan';

type CanvasProps = {
  strokes: Stroke[];
  currentStroke: Stroke | null;
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
      ctx.beginPath();
      const pt0 = stroke.points[0];
      ctx.moveTo(pt0.x, pt0.y);

      if (stroke.points.length === 1) {
        // Single point — draw a dot
        ctx.arc(pt0.x, pt0.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color === 'eraser' ? '#ffffff' : stroke.color;
        ctx.fill();
        return;
      }

      // Quadratic curve smoothing for 3+ points
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

      if (stroke.color === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    const render = () => {
      const vp = viewportRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(vp.offsetX, vp.offsetY);
      ctx.scale(vp.scale, vp.scale);

      strokes.forEach((s) => drawStroke(ctx, s));
      if (currentStroke) drawStroke(ctx, currentStroke);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [strokes, currentStroke, viewportRef, width, height]);

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
