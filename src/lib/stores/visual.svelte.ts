import type { CanvasNode } from "../types";
import { nodesInRect } from "../geometry";
import { getModeStore } from "./mode.svelte";
import { getSelectionStore } from "./selection.svelte";

let visualOrigin = $state<{ x: number; y: number } | null>(null);

function enterVisual(originX: number, originY: number) {
  visualOrigin = { x: originX, y: originY };
  getModeStore().setMode("visual");
}

function confirmVisual(currentX: number, currentY: number, nodes: CanvasNode[]) {
  if (!visualOrigin) { getModeStore().setMode("normal"); return; }
  const minX = Math.min(visualOrigin.x, currentX);
  const minY = Math.min(visualOrigin.y, currentY);
  const maxX = Math.max(visualOrigin.x, currentX);
  const maxY = Math.max(visualOrigin.y, currentY);
  const ids = nodesInRect(nodes, minX, minY, maxX, maxY);
  const sel = getSelectionStore();
  sel.selectedNodeIds = ids;
  sel.selectedEdgeId = null;
  visualOrigin = null;
  getModeStore().setMode("normal");
}

function exitVisual() {
  visualOrigin = null;
  getModeStore().setMode("normal");
}

export function getVisualStore() {
  return {
    get visualOrigin() { return visualOrigin; },
    enterVisual,
    confirmVisual,
    exitVisual,
  };
}
