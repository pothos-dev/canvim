import type { Viewport } from "../types";
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

export function getViewportStore() {
  return {
    get viewport() { return viewport; },
    centerOn,
    pan,
    panGrid,
    zoom,
    snapViewport,
  };
}
