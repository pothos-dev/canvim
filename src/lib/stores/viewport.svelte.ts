import type { CanvasNode, Viewport } from "../types";
import { STEP } from "../constants";

let viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });

function snapViewport() {
  const spacing = STEP * viewport.zoom;
  viewport.x = Math.round(viewport.x / spacing) * spacing;
  viewport.y = Math.round(viewport.y / spacing) * spacing;
}

function centerOn(x: number, y: number) {
  viewport.x = -x * viewport.zoom;
  viewport.y = -y * viewport.zoom;
  snapViewport();
}

function pan(dx: number, dy: number) {
  viewport.x += dx;
  viewport.y += dy;
}

function panGrid(cellsX: number, cellsY: number) {
  viewport.x += cellsX * STEP * viewport.zoom;
  viewport.y += cellsY * STEP * viewport.zoom;
  snapViewport();
}

function zoom(delta: number) {
  viewport.zoom = Math.max(0.1, Math.min(5, viewport.zoom + delta));
  snapViewport();
}

function zoomAtPoint(delta: number, screenX: number, screenY: number) {
  const oldZoom = viewport.zoom;
  const newZoom = Math.max(0.1, Math.min(5, oldZoom + delta));
  if (newZoom === oldZoom) return;
  const mx = screenX - window.innerWidth / 2;
  const my = screenY - window.innerHeight / 2;
  viewport.x = mx - (mx - viewport.x) * (newZoom / oldZoom);
  viewport.y = my - (my - viewport.y) * (newZoom / oldZoom);
  viewport.zoom = newZoom;
}

function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: (screenX - window.innerWidth / 2 - viewport.x) / viewport.zoom,
    y: (screenY - window.innerHeight / 2 - viewport.y) / viewport.zoom,
  };
}

function getCanvasCenter(): { x: number; y: number } {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
  };
}

function centerOnNode(node: CanvasNode) {
  centerOn(node.x + node.width / 2, node.y + node.height / 2);
}

export function getViewportStore() {
  return {
    get viewport() { return viewport; },
    centerOn,
    centerOnNode,
    pan,
    panGrid,
    zoom,
    zoomAtPoint,
    screenToCanvas,
    getCanvasCenter,
    snapViewport,
  };
}
