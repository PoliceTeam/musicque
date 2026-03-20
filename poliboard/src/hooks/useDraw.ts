import { useState, useCallback, useRef } from 'react';
import { Stroke, Point, StrokeType } from '../types/stroke';
import { simplifyStroke } from '../utils/rdp';

export const useDraw = () => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Phase 3: Track remote active strokes without triggering React re-renders
  const remoteActiveStrokesRef = useRef<Map<string, Stroke>>(new Map());

  const startDrawing = useCallback((point: Point, color: string, width: number, type: StrokeType = 'freehand') => {
    const newStroke: Stroke = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      points: [point],
      color,
      width,
      type,
    };
    currentStrokeRef.current = newStroke;
    setCurrentStroke(newStroke);
    return newStroke;
  }, []);

  const draw = useCallback((point: Point) => {
    if (!currentStrokeRef.current) return null;
    
    const stroke = currentStrokeRef.current;
    if (stroke.type === 'freehand' || !stroke.type) {
      // Phase 1: Throttle points (skip if < 1.2px from last point)
      const lastPoint = stroke.points[stroke.points.length - 1];
      if (lastPoint) {
        const dist = Math.hypot(lastPoint.x - point.x, lastPoint.y - point.y);
        if (dist < 1.2) return null; // Skip redundant updates for performance
      }
      
      // Mutate in place for performance, then trigger re-render
      stroke.points.push(point);
    } else {
      // For shapes, we only need start and end points
      stroke.points[1] = point;
    }
    
    const updated = { ...stroke };
    setCurrentStroke(updated);
    return updated;
  }, []);

  const stopDrawing = useCallback(() => {
    let finalStroke: Stroke | null = null;
    if (currentStrokeRef.current) {
      finalStroke = currentStrokeRef.current;
      
      // Phase 2: Simplification using Ramer-Douglas-Peucker
      if (finalStroke.type === 'freehand' || !finalStroke.type) {
        finalStroke.points = simplifyStroke(finalStroke.points, 0.5); // reduced from 1.2 avoiding visual deformation
      }

      setStrokes((prev) => [...prev, finalStroke as Stroke]);
      currentStrokeRef.current = null;
      setCurrentStroke(null);
    }
    return finalStroke;
  }, []);

  // Remote: someone else started a stroke
  const addStroke = useCallback((stroke: Stroke) => {
    // Phase 3: Only mutate ref, do NOT trigger React re-render
    remoteActiveStrokesRef.current.set(stroke.id, { ...stroke, points: [...stroke.points] });
  }, []);

  // Remote: someone else added a point to an active stroke (incremental)
  const appendRemotePoint = useCallback((strokeId: string, point: Point) => {
    const existing = remoteActiveStrokesRef.current.get(strokeId);
    if (existing) {
      // Phase 3: Mutate ref only. The Canvas rAF loop will pick it up automatically.
      existing.points.push(point);
    }
  }, []);

  // Remote: someone else finished a stroke
  const finalizeRemoteStroke = useCallback((simplifiedStroke: Stroke) => {
    // Delete from in-progress remote strokes map
    remoteActiveStrokesRef.current.delete(simplifiedStroke.id);
    
    // Replace or append the finalized stroke to trigger React and cache invalidation
    setStrokes((prev) => {
      const idx = prev.findIndex((s) => s.id === simplifiedStroke.id);
      if (idx !== -1) {
        const newArr = [...prev];
        newArr[idx] = simplifiedStroke;
        return newArr;
      }
      return [...prev, simplifiedStroke];
    });
  }, []);

  // Legacy full-stroke update (for init-board)
  const updateStroke = useCallback((stroke: Stroke) => {
    setStrokes((prev) => {
      const idx = prev.findIndex((s) => s.id === stroke.id);
      if (idx !== -1) {
        const newStrokes = [...prev];
        newStrokes[idx] = stroke;
        return newStrokes;
      }
      return [...prev, stroke];
    });
  }, []);

  const clear = useCallback(() => {
    setStrokes([]);
    currentStrokeRef.current = null;
    setCurrentStroke(null);
    remoteActiveStrokesRef.current.clear();
  }, []);

  const undo = useCallback((strokeId: string) => {
    setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    remoteActiveStrokesRef.current.delete(strokeId);
  }, []);

  return {
    strokes,
    setStrokes,
    currentStroke,
    remoteActiveStrokesRef,
    startDrawing,
    draw,
    stopDrawing,
    addStroke,
    appendRemotePoint,
    finalizeRemoteStroke,
    updateStroke,
    clear,
    undo,
  };
};
