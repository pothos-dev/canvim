import type { CanvasNode } from "../types";
import { getViewportStore } from "./viewport.svelte";

let selectedNodeIds = $state<string[]>([]);
let selectedEdgeId = $state<string | null>(null);
let cycleIndex = $state(-1);

function selectNode(id: string) {
  selectedNodeIds = [id];
  selectedEdgeId = null;
}

function cycleNode(direction: 1 | -1, nodes: CanvasNode[], centerOnNode: (node: CanvasNode) => void) {
  if (nodes.length === 0) return;
  if (cycleIndex === -1) {
    cycleIndex = direction === 1 ? 0 : nodes.length - 1;
  } else {
    cycleIndex = (cycleIndex + direction + nodes.length) % nodes.length;
  }
  const node = nodes[cycleIndex];
  centerOnNode(node);
}

function toggleNodeSelection(id: string) {
  const idx = selectedNodeIds.indexOf(id);
  if (idx >= 0) {
    selectedNodeIds = selectedNodeIds.filter(nid => nid !== id);
  } else {
    selectedNodeIds = [...selectedNodeIds, id];
  }
  selectedEdgeId = null;
}

function deselectAll() {
  selectedNodeIds = [];
  selectedEdgeId = null;
}

function selectEdge(id: string) {
  selectedEdgeId = id;
  selectedNodeIds = [];
}

export function getSelectionStore() {
  return {
    get selectedNodeIds() { return selectedNodeIds; },
    set selectedNodeIds(v: string[]) { selectedNodeIds = v; },
    get selectedEdgeId() { return selectedEdgeId; },
    set selectedEdgeId(v: string | null) { selectedEdgeId = v; },
    get cycleIndex() { return cycleIndex; },
    selectNode,
    cycleNode,
    toggleNodeSelection,
    deselectAll,
    selectEdge,
  };
}
