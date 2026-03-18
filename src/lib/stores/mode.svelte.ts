import { getSelectionStore } from "./selection.svelte";

export type Mode = "normal" | "insert" | "connect" | "move" | "resize" | "search" | "visual";

let mode = $state<Mode>("normal");
let implicitSelect = false;

function enterInsert(implicit = false) {
  const sel = getSelectionStore();
  if (sel.selectedNodeIds.length === 1 || sel.selectedEdgeId) {
    implicitSelect = implicit;
    mode = "insert";
  }
}

function exitInsert() {
  mode = "normal";
  if (implicitSelect) { getSelectionStore().deselectAll(); implicitSelect = false; }
}

function enterMove(implicit: boolean) {
  implicitSelect = implicit;
  mode = "move";
}

function exitMove() {
  mode = "normal";
  if (implicitSelect) { getSelectionStore().deselectAll(); implicitSelect = false; }
}

function enterResize(implicit: boolean) {
  implicitSelect = implicit;
  mode = "resize";
}

function exitResize() {
  mode = "normal";
  if (implicitSelect) { getSelectionStore().deselectAll(); implicitSelect = false; }
}

function switchToResize() {
  mode = "resize";
}

function switchToMove() {
  mode = "move";
}

function setMode(m: Mode) {
  mode = m;
}

function resetImplicitSelect() {
  implicitSelect = false;
}

export function getModeStore() {
  return {
    get mode() { return mode; },
    get implicitSelect() { return implicitSelect; },
    enterInsert,
    exitInsert,
    enterMove,
    exitMove,
    enterResize,
    exitResize,
    switchToResize,
    switchToMove,
    setMode,
    resetImplicitSelect,
  };
}
