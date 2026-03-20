import { Point } from '../types/stroke';

export const getPerpendicularDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  
  const num = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  const den = Math.hypot(dx, dy);
  return num / den;
};

/**
 * Simplifies a given array of points using the Ramer-Douglas-Peucker algorithm.
 * @param points Array of Point objects
 * @param epsilon The tolerance (distance in pixels). Higher = smoother/fewer points.
 * @returns A new array of simplified points
 */
export const simplifyStroke = (points: Point[], epsilon: number = 1.0): Point[] => {
  if (!points || points.length <= 2) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = getPerpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1 = simplifyStroke(points.slice(0, index + 1), epsilon);
    const recResults2 = simplifyStroke(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[end]];
  }
};
