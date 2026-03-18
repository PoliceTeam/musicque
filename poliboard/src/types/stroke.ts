export type Point = {
  x: number;
  y: number;
};

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
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
