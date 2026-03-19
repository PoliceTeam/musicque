import { useRef, useCallback, useState } from 'react';
import { Viewport } from '../types/stroke';

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_SENSITIVITY = 0.001;

export const useViewport = () => {
  // Use ref for high-frequency updates (render loop reads this)
  const viewportRef = useRef<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 });
  // State for React UI that needs to re-render (zoom %, reset button)
  const [viewportState, setViewportState] = useState<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 });

  const commitRef = useCallback(() => {
    setViewportState({ ...viewportRef.current });
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const vp = viewportRef.current;

    // Pinch-zoom (ctrl/meta) or regular wheel → zoom
    if (e.ctrlKey || e.metaKey) {
      // Exponential zoom for smooth feel
      const oldScale = vp.scale;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
        oldScale * Math.exp(-e.deltaY * ZOOM_SENSITIVITY)
      ));

      if (newScale === oldScale) return;

      // Cursor position in world coords BEFORE zoom
      const mouseWorldX = (e.offsetX - vp.offsetX) / oldScale;
      const mouseWorldY = (e.offsetY - vp.offsetY) / oldScale;

      // Recalculate offset so cursor stays fixed on the same world point
      viewportRef.current = {
        scale: newScale,
        offsetX: e.offsetX - mouseWorldX * newScale,
        offsetY: e.offsetY - mouseWorldY * newScale,
      };
    } else {
      // Trackpad / wheel scroll → pan
      viewportRef.current = {
        ...vp,
        offsetX: vp.offsetX - e.deltaX,
        offsetY: vp.offsetY - e.deltaY,
      };
    }

    commitRef();
  }, [commitRef]);

  const pan = useCallback((dx: number, dy: number) => {
    const vp = viewportRef.current;
    viewportRef.current = {
      ...vp,
      offsetX: vp.offsetX + dx,
      offsetY: vp.offsetY + dy,
    };
    commitRef();
  }, [commitRef]);

  const resetViewport = useCallback(() => {
    viewportRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
    commitRef();
  }, [commitRef]);

  return {
    viewport: viewportState,
    viewportRef,
    handleWheel,
    pan,
    resetViewport,
  };
};
