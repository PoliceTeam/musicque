import { useState, useCallback, useRef } from 'react';
import { Stroke, Point } from '../types/stroke';

export const useDraw = () => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Map for O(1) lookup of remote strokes being drawn by others
  const remoteStrokesRef = useRef<Map<string, Stroke>>(new Map());

  const startDrawing = useCallback((point: Point, color: string, width: number) => {
    const newStroke: Stroke = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      points: [point],
      color,
      width,
    };
    currentStrokeRef.current = newStroke;
    setCurrentStroke(newStroke);
    return newStroke;
  }, []);

  const draw = useCallback((point: Point) => {
    if (!currentStrokeRef.current) return null;
    // Mutate in place for performance, then trigger re-render
    currentStrokeRef.current.points.push(point);
    const updated = { ...currentStrokeRef.current };
    setCurrentStroke(updated);
    return updated;
  }, []);

  const stopDrawing = useCallback(() => {
    let finalStroke: Stroke | null = null;
    if (currentStrokeRef.current) {
      finalStroke = currentStrokeRef.current;
      setStrokes((prev) => [...prev, finalStroke as Stroke]);
      currentStrokeRef.current = null;
      setCurrentStroke(null);
    }
    return finalStroke;
  }, []);

  // Remote: someone else started a stroke
  const addStroke = useCallback((stroke: Stroke) => {
    remoteStrokesRef.current.set(stroke.id, { ...stroke, points: [...stroke.points] });
    // Trigger re-render with the new remote stroke tracked
    setStrokes((prev) => [...prev, remoteStrokesRef.current.get(stroke.id)!]);
  }, []);

  // Remote: someone else added a point to an active stroke (incremental)
  const appendRemotePoint = useCallback((strokeId: string, point: Point) => {
    const existing = remoteStrokesRef.current.get(strokeId);
    if (existing) {
      // Mutate the stroke for speed, then replace ref in array
      existing.points.push(point);
      setStrokes((prev) => {
        const idx = prev.findIndex((s) => s.id === strokeId);
        if (idx !== -1) {
          const newArr = [...prev];
          newArr[idx] = { ...existing };
          return newArr;
        }
        return prev;
      });
    }
  }, []);

  // Remote: someone else finished a stroke
  const finalizeRemoteStroke = useCallback((strokeId: string) => {
    remoteStrokesRef.current.delete(strokeId);
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
    remoteStrokesRef.current.clear();
  }, []);

  const undo = useCallback((strokeId: string) => {
    setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
    remoteStrokesRef.current.delete(strokeId);
  }, []);

  return {
    strokes,
    setStrokes,
    currentStroke,
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
