import type { Point, Side, CanvasNode } from "./types";

export const SIDE_NORMALS: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function attachmentPoint(node: CanvasNode, side: Side): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  switch (side) {
    case "top": return { x: cx, y: node.y };
    case "bottom": return { x: cx, y: node.y + node.height };
    case "left": return { x: node.x, y: cy };
    case "right": return { x: node.x + node.width, y: cy };
  }
}

export function detectSide(node: CanvasNode, point: Point): Side {
  const dx = (point.x - node.x - node.width / 2) / node.width;
  const dy = (point.y - node.y - node.height / 2) / node.height;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "bottom" : "top";
}

export function autoSides(from: CanvasNode, to: CanvasNode): { fromSide: Side; toSide: Side } {
  const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
  const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { fromSide: "right", toSide: "left" } : { fromSide: "left", toSide: "right" };
  }
  return dy >= 0 ? { fromSide: "bottom", toSide: "top" } : { fromSide: "top", toSide: "bottom" };
}

export function pointInNode(node: CanvasNode, p: Point): boolean {
  return p.x >= node.x && p.x <= node.x + node.width &&
         p.y >= node.y && p.y <= node.y + node.height;
}

export function bezierControlPoints(from: Point, to: Point, fromSide: Side, toSide: Side): { c1: Point; c2: Point } {
  const nFrom = SIDE_NORMALS[fromSide];
  const nTo = SIDE_NORMALS[toSide];
  const dist = Math.max(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.4);
  return {
    c1: { x: from.x + nFrom.x * dist, y: from.y + nFrom.y * dist },
    c2: { x: to.x + nTo.x * dist, y: to.y + nTo.y * dist },
  };
}

export function bezierPath(from: Point, to: Point, fromSide: Side, toSide: Side): string {
  const { c1, c2 } = bezierControlPoints(from, to, fromSide, toSide);
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

export function bezierMidpoint(from: Point, to: Point, fromSide: Side, toSide: Side): Point {
  const { c1, c2 } = bezierControlPoints(from, to, fromSide, toSide);
  // Evaluate cubic bezier at t=0.5
  const t = 0.5, u = 0.5;
  return {
    x: u*u*u*from.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*to.x,
    y: u*u*u*from.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*to.y,
  };
}

/** Return IDs of nodes fully enclosed within the given rectangle */
export function nodesInRect(nodes: CanvasNode[], minX: number, minY: number, maxX: number, maxY: number): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    if (n.x >= minX && n.y >= minY && n.x + n.width <= maxX && n.y + n.height <= maxY) {
      ids.push(n.id);
    }
  }
  return ids;
}

export function distToBezier(from: Point, to: Point, fromSide: Side, toSide: Side, test: Point): number {
  const { c1, c2 } = bezierControlPoints(from, to, fromSide, toSide);
  let minD = Infinity;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const bx = u*u*u*from.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*to.x;
    const by = u*u*u*from.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*to.y;
    const d = Math.hypot(bx - test.x, by - test.y);
    if (d < minD) minD = d;
  }
  return minD;
}
