import type { Viewport } from "./types";

const LERP_FACTOR = 0.25;
const SNAP_THRESHOLD = 0.5;
const ZOOM_SNAP_THRESHOLD = 0.001;

interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

let viewportDisplay = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
let nodeDisplay = $state<Map<string, NodeRect>>(new Map());

let targetViewport: Viewport = { x: 0, y: 0, zoom: 1 };
let targetNodes: () => Array<{ id: string; x: number; y: number; width: number; height: number }> = () => [];
let running = false;
let rafId = 0;

function lerpScalar(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

function isSettled(): boolean {
  if (
    Math.abs(viewportDisplay.x - targetViewport.x) > SNAP_THRESHOLD ||
    Math.abs(viewportDisplay.y - targetViewport.y) > SNAP_THRESHOLD ||
    Math.abs(viewportDisplay.zoom - targetViewport.zoom) > ZOOM_SNAP_THRESHOLD
  ) {
    return false;
  }

  const nodes = targetNodes();
  for (const node of nodes) {
    const d = nodeDisplay.get(node.id);
    if (!d) continue;
    if (
      Math.abs(d.x - node.x) > SNAP_THRESHOLD ||
      Math.abs(d.y - node.y) > SNAP_THRESHOLD ||
      Math.abs(d.width - node.width) > SNAP_THRESHOLD ||
      Math.abs(d.height - node.height) > SNAP_THRESHOLD
    ) {
      return false;
    }
  }

  return true;
}

function tick() {
  // Lerp viewport
  viewportDisplay.x = lerpScalar(viewportDisplay.x, targetViewport.x, LERP_FACTOR);
  viewportDisplay.y = lerpScalar(viewportDisplay.y, targetViewport.y, LERP_FACTOR);
  viewportDisplay.zoom = lerpScalar(viewportDisplay.zoom, targetViewport.zoom, LERP_FACTOR);

  // Lerp nodes
  const nodes = targetNodes();
  for (const node of nodes) {
    let d = nodeDisplay.get(node.id);
    if (!d) {
      // New node — snap instantly
      nodeDisplay.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height });
      continue;
    }
    d.x = lerpScalar(d.x, node.x, LERP_FACTOR);
    d.y = lerpScalar(d.y, node.y, LERP_FACTOR);
    d.width = lerpScalar(d.width, node.width, LERP_FACTOR);
    d.height = lerpScalar(d.height, node.height, LERP_FACTOR);
  }

  if (isSettled()) {
    // Snap to exact targets
    viewportDisplay.x = targetViewport.x;
    viewportDisplay.y = targetViewport.y;
    viewportDisplay.zoom = targetViewport.zoom;
    for (const node of nodes) {
      const d = nodeDisplay.get(node.id);
      if (d) {
        d.x = node.x;
        d.y = node.y;
        d.width = node.width;
        d.height = node.height;
      }
    }
    running = false;
    return;
  }

  rafId = requestAnimationFrame(tick);
}

export function kick() {
  if (running) return;
  running = true;
  rafId = requestAnimationFrame(tick);
}

export function snapAll() {
  if (running) {
    cancelAnimationFrame(rafId);
    running = false;
  }

  viewportDisplay.x = targetViewport.x;
  viewportDisplay.y = targetViewport.y;
  viewportDisplay.zoom = targetViewport.zoom;

  const nodes = targetNodes();
  for (const node of nodes) {
    const d = nodeDisplay.get(node.id);
    if (d) {
      d.x = node.x;
      d.y = node.y;
      d.width = node.width;
      d.height = node.height;
    } else {
      nodeDisplay.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height });
    }
  }
}

export function removeNode(id: string) {
  nodeDisplay.delete(id);
}

export function initAnimation(
  viewportRef: Viewport,
  getNodes: () => Array<{ id: string; x: number; y: number; width: number; height: number }>,
) {
  targetViewport = viewportRef;
  targetNodes = getNodes;
  // Initial snap
  viewportDisplay.x = viewportRef.x;
  viewportDisplay.y = viewportRef.y;
  viewportDisplay.zoom = viewportRef.zoom;
  // Populate node display
  for (const node of getNodes()) {
    nodeDisplay.set(node.id, { x: node.x, y: node.y, width: node.width, height: node.height });
  }
}

export function getViewportDisplay(): Viewport {
  return viewportDisplay;
}

export function getNodeDisplay(): Map<string, NodeRect> {
  return nodeDisplay;
}
