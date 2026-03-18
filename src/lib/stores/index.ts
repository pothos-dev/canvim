import { getCanvasDataStore } from "./canvas-data.svelte";
import { getViewportStore } from "./viewport.svelte";
import { getModeStore } from "./mode.svelte";
import { getSelectionStore } from "./selection.svelte";
import { getSearchStore } from "./search.svelte";
import { getVisualStore } from "./visual.svelte";
import { getConnectStore } from "./connect.svelte";

export type { Mode } from "./mode.svelte";

export function getStore() {
  const data = getCanvasDataStore();
  const vp = getViewportStore();
  const mode = getModeStore();
  const sel = getSelectionStore();
  const search = getSearchStore(() => data.nodes);
  const visual = getVisualStore();
  const connect = getConnectStore();

  return {
    // Canvas data
    get nodes() { return data.nodes; },
    get edges() { return data.edges; },
    get filePath() { return data.filePath; },
    get config() { return data.config; },
    init: data.init,
    load: data.load,
    save: data.save,
    quit: data.quit,
    addNode: data.addNode,
    updateNode: data.updateNode,
    removeNode: data.removeNode,
    moveNode: data.moveNode,
    resizeNode: data.resizeNode,
    setNodeSize: data.setNodeSize,
    setNodeColor: data.setNodeColor,
    removeEdge: data.removeEdge,
    updateEdgeLabel: data.updateEdgeLabel,
    setEdgeColor: data.setEdgeColor,
    addEdge: data.addEdge,
    pushSnapshot: data.pushSnapshot,
    popSnapshot: data.popSnapshot,
    yankSelected: data.yankSelected,
    paste: data.paste,
    get canPaste() { return data.canPaste; },
    undo: data.undo,
    redo: data.redo,
    get canUndo() { return data.canUndo; },
    get canRedo() { return data.canRedo; },
    resolveColor: data.resolveColor,

    // Viewport
    get viewport() { return vp.viewport; },
    centerOn: vp.centerOn,
    centerOnNode: vp.centerOnNode,
    pan: vp.pan,
    panGrid: vp.panGrid,
    zoom: vp.zoom,
    zoomAtPoint: vp.zoomAtPoint,
    screenToCanvas: vp.screenToCanvas,
    getCanvasCenter: vp.getCanvasCenter,

    // Mode
    get mode() { return mode.mode; },
    enterInsert: mode.enterInsert,
    exitInsert: mode.exitInsert,
    enterMove: mode.enterMove,
    exitMove: mode.exitMove,
    enterResize: mode.enterResize,
    exitResize: mode.exitResize,
    switchToResize: mode.switchToResize,
    switchToMove: mode.switchToMove,

    // Selection
    get selectedNodeId() { return sel.selectedNodeIds.length === 1 ? sel.selectedNodeIds[0] : null; },
    get selectedNodeIds() { return sel.selectedNodeIds; },
    get hasMultiSelect() { return sel.selectedNodeIds.length > 1; },
    get selectedEdgeId() { return sel.selectedEdgeId; },
    selectNode: sel.selectNode,
    cycleNode(direction: 1 | -1) { sel.cycleNode(direction, data.nodes, vp.centerOnNode); },
    toggleNodeSelection: sel.toggleNodeSelection,
    deselectAll: sel.deselectAll,
    selectEdge: sel.selectEdge,

    // Connect
    get connectFromNodeId() { return connect.connectFromNodeId; },
    get connectFromSide() { return connect.connectFromSide; },
    enterConnect: connect.enterConnect,
    exitConnect: connect.exitConnect,
    setConnectFromSide: connect.setConnectFromSide,

    // Search
    get searchQuery() { return search.searchQuery; },
    get searchMatchIds() { return search.searchMatchIds; },
    get searchCurrentIndex() { return search.searchCurrentIndex; },
    get searchConfirmed() { return search.searchConfirmed; },
    enterSearch: search.enterSearch,
    exitSearch: search.exitSearch,
    setSearchQuery: search.setSearchQuery,
    searchNext: search.searchNext,
    searchPrev: search.searchPrev,
    confirmSearch: search.confirmSearch,

    // Visual
    get visualOrigin() { return visual.visualOrigin; },
    enterVisual: visual.enterVisual,
    confirmVisual(currentX: number, currentY: number) { visual.confirmVisual(currentX, currentY, data.nodes); },
    exitVisual: visual.exitVisual,
  };
}
