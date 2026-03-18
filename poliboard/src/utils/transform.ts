import { Point, Viewport } from '../types/stroke';

export const screenToWorld = (screenPoint: Point, viewport: Viewport): Point => {
  return {
    x: (screenPoint.x - viewport.offsetX) / viewport.scale,
    y: (screenPoint.y - viewport.offsetY) / viewport.scale,
  };
};

export const worldToScreen = (worldPoint: Point, viewport: Viewport): Point => {
  return {
    x: worldPoint.x * viewport.scale + viewport.offsetX,
    y: worldPoint.y * viewport.scale + viewport.offsetY,
  };
};
