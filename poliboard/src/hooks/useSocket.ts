import { useEffect, useRef, useCallback } from 'react';
import { socketService } from '../services/socket';
import { Stroke, Point } from '../types/stroke';

type UseSocketParams = {
  roomId: string;
  onInitBoard: (strokes: Stroke[]) => void;
  onStrokeStart: (stroke: Stroke) => void;
  onStrokeMove: (strokeId: string, point: Point) => void;
  onStrokeEnd: (strokeId: string) => void;
  onClearReceived: () => void;
  onCursorMove: (cursor: any) => void;
  onCursorRemove: (cursorId: string) => void;
};

export const useSocket = ({
  roomId,
  onInitBoard,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  onClearReceived,
  onCursorMove,
  onCursorRemove
}: UseSocketParams) => {
  const initialized = useRef(false);
  // Store callbacks in refs to avoid re-subscribing on every render
  const callbacksRef = useRef({
    onInitBoard,
    onStrokeStart,
    onStrokeMove,
    onStrokeEnd,
    onClearReceived,
    onCursorMove,
    onCursorRemove
  });

  // Keep refs updated
  callbacksRef.current = {
    onInitBoard,
    onStrokeStart,
    onStrokeMove,
    onStrokeEnd,
    onClearReceived,
    onCursorMove,
    onCursorRemove
  };

  useEffect(() => {
    if (!initialized.current) {
      socketService.connect();
      initialized.current = true;
    }

    socketService.joinRoom(roomId);

    const handleInit = (strokes: Stroke[]) => callbacksRef.current.onInitBoard(strokes);
    const handleStart = (payload: { room: string; data: Stroke }) =>
      callbacksRef.current.onStrokeStart(payload.data);
    // Optimized: only receive the new point, not the entire stroke
    const handleMove = (payload: { room: string; data: { strokeId: string; point: Point } }) =>
      callbacksRef.current.onStrokeMove(payload.data.strokeId, payload.data.point);
    const handleEnd = (payload: { room: string; data: { strokeId: string } }) =>
      callbacksRef.current.onStrokeEnd(payload.data.strokeId);
    const handleClear = () => callbacksRef.current.onClearReceived();
    const handleCursorMove = (cursorData: any) => callbacksRef.current.onCursorMove(cursorData);
    const handleCursorRemove = (payload: { id: string }) =>
      callbacksRef.current.onCursorRemove(payload.id);

    socketService.on('init-board', handleInit);
    socketService.on('draw:start', handleStart);
    socketService.on('draw:move', handleMove);
    socketService.on('draw:end', handleEnd);
    socketService.on('clear-board', handleClear);
    socketService.on('cursor:move', handleCursorMove);
    socketService.on('cursor:remove', handleCursorRemove);
    socketService.on('cursor:leave', handleCursorRemove);

    return () => {
      socketService.off('init-board', handleInit);
      socketService.off('draw:start', handleStart);
      socketService.off('draw:move', handleMove);
      socketService.off('draw:end', handleEnd);
      socketService.off('clear-board', handleClear);
      socketService.off('cursor:move', handleCursorMove);
      socketService.off('cursor:remove', handleCursorRemove);
      socketService.off('cursor:leave', handleCursorRemove);
    };
  }, [roomId]); // Only re-subscribe when roomId changes!

  const emitStrokeStart = useCallback((stroke: Stroke) => socketService.emit('draw:start', stroke), []);
  // Optimized: only send the single new point, not the whole stroke
  const emitStrokeMove = useCallback(
    (strokeId: string, point: Point) => socketService.emit('draw:move', { strokeId, point }),
    []
  );
  const emitStrokeEnd = useCallback(
    (strokeId: string) => socketService.emit('draw:end', { strokeId }),
    []
  );
  const emitClear = useCallback(() => socketService.emit('clear-board', {}), []);
  const emitCursorMove = useCallback((data: any) => socketService.emit('cursor:move', data), []);
  const emitCursorLeave = useCallback(() => socketService.emit('cursor:leave', {}), []);

  return { emitStrokeStart, emitStrokeMove, emitStrokeEnd, emitClear, emitCursorMove, emitCursorLeave };
};
