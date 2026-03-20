export type Point = {
  x: number;
  y: number;
};

export type StrokeType = 'freehand' | 'rect' | 'circle' | 'line' | 'caro3' | 'caro5' | 'caro10';

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  type?: StrokeType;
};

export type Viewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type CursorData = {
  id: string;
  x: number;
  y: number;
  username: string;
  color: string;
};

export type CursorState = {
  data: CursorData;
  x: number;       // Interpolated display x
  y: number;       // Interpolated display y
  targetX: number; // Network target x
  targetY: number; // Network target y
  lastUpdate?: number;
};
