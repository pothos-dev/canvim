import type { Point, Side, CanvasNode, Edge } from "./types";
import { STEP, BORDER_ZONE, EDGE_HIT_THRESHOLD } from "./constants";

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

export function snap(v: number): number {
  return Math.round(v / STEP) * STEP;
}

/** Find topmost node at a point, prioritizing non-groups over groups (reverse z-order) */
export function findNodeAt(nodes: CanvasNode[], point: Point): CanvasNode | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodes[i].type !== "group" && pointInNode(nodes[i], point)) return nodes[i];
  }
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (pointInNode(nodes[i], point)) return nodes[i];
  }
  return undefined;
}

/** Check if a child node is contained within a group (>50% overlap by area) */
export function isContainedInGroup(child: CanvasNode, group: CanvasNode): boolean {
  const overlapX = Math.max(0, Math.min(child.x + child.width, group.x + group.width) - Math.max(child.x, group.x));
  const overlapY = Math.max(0, Math.min(child.y + child.height, group.y + group.height) - Math.max(child.y, group.y));
  const overlapArea = overlapX * overlapY;
  const childArea = child.width * child.height;
  return childArea > 0 && overlapArea / childArea > 0.5;
}

export type ResizeEdge = { left: boolean; right: boolean; top: boolean; bottom: boolean };

/** Detect which border edges of a node the point is near (within BORDER_ZONE) */
export function getResizeEdge(node: CanvasNode, canvasX: number, canvasY: number, zoom: number): ResizeEdge | null {
  const zone = BORDER_ZONE / zoom;
  const left = canvasX - node.x < zone;
  const right = node.x + node.width - canvasX < zone;
  const top = canvasY - node.y < zone;
  const bottom = node.y + node.height - canvasY < zone;
  if (left || right || top || bottom) return { left, right, top, bottom };
  return null;
}

export function cursorForResizeEdge(edge: ResizeEdge): string {
  if ((edge.top && edge.left) || (edge.bottom && edge.right)) return "nwse-resize";
  if ((edge.top && edge.right) || (edge.bottom && edge.left)) return "nesw-resize";
  if (edge.left || edge.right) return "ew-resize";
  if (edge.top || edge.bottom) return "ns-resize";
  return "default";
}

/** Compute distance from a point to an edge's bezier curve, resolving sides automatically */
export function distToEdge(
  edge: Edge,
  point: Point,
  findNode: (id: string) => CanvasNode | undefined,
): number {
  const fromNode = findNode(edge.fromNode);
  const toNode = findNode(edge.toNode);
  if (!fromNode || !toNode) return Infinity;

  const auto = autoSides(fromNode, toNode);
  const fromSide = (edge.fromSide as Side | undefined) ?? auto.fromSide;
  const toSide = (edge.toSide as Side | undefined) ?? auto.toSide;

  const p0 = attachmentPoint(fromNode, fromSide);
  const p3 = attachmentPoint(toNode, toSide);
  return distToBezier(p0, p3, fromSide, toSide, point);
}

/** Find the nearest edge to a point within EDGE_HIT_THRESHOLD */
export function getEdgeNear(
  edges: Edge[],
  point: Point,
  findNode: (id: string) => CanvasNode | undefined,
): Edge | undefined {
  let best: Edge | undefined;
  let bestDist = EDGE_HIT_THRESHOLD;
  for (const e of edges) {
    const d = distToEdge(e, point, findNode);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}
