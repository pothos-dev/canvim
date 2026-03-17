import { invoke } from "@tauri-apps/api/core";
import type { Canvas, CanvasNode, Config, Edge, Side, Viewport } from "./types";
import { STEP } from "./constants";
import { initAnimation, kick, snapAll, removeNode as animRemoveNode, getViewportDisplay, getNodeDisplay } from "./animate.svelte";

export type Mode = "normal" | "insert" | "connect" | "move" | "resize" | "search";

let nodes = $state<CanvasNode[]>([]);
let edges = $state<Edge[]>([]);
let viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
let selectedNodeIds = $state<string[]>([]);
let selectedEdgeId = $state<string | null>(null);
let mode = $state<Mode>("normal");
let implicitSelect = false;
let connectFromNodeId = $state<string | null>(null);
let connectFromSide = $state<Side | null>(null);
let filePath = $state<string | null>(null);
let config = $state<Config | null>(null);
let clipboard: { nodes: CanvasNode[]; edges: Edge[] } | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Search state
let searchQuery = $state("");
let searchMatchIds = $state<string[]>([]);
let searchCurrentIndex = $state(0);
let searchConfirmed = $state(false);

const MAX_HISTORY = 100;
let history: Canvas[] = [];
let future: Canvas[] = [];

function cloneState(): Canvas {
  return JSON.parse(JSON.stringify({ nodes, edges }));
}

function pushSnapshot() {
  history.push(cloneState());
  if (history.length > MAX_HISTORY) history.shift();
  future.length = 0;
}

function restoreSnapshot(snapshot: Canvas) {
  nodes.length = 0;
  nodes.push(...snapshot.nodes);
  edges.length = 0;
  edges.push(...snapshot.edges);
  // Return to normal mode to avoid stale state
  mode = "normal";
  selectedNodeIds = [];
  selectedEdgeId = null;
  connectFromNodeId = null;
  connectFromSide = null;
  implicitSelect = false;
  snapAll();
  save();
}

function popSnapshot() {
  history.pop();
}

function undo() {
  if (history.length === 0) return;
  future.push(cloneState());
  const snapshot = history.pop()!;
  restoreSnapshot(snapshot);
}

function redo() {
  if (future.length === 0) return;
  history.push(cloneState());
  const snapshot = future.pop()!;
  restoreSnapshot(snapshot);
}

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => save(), 500);
}

async function save() {
  if (!filePath) return;
  if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
  const data: Canvas = { nodes, edges };
  await invoke("save_canvas", { path: filePath, data });
}

async function quit() {
  await save();
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  getCurrentWindow().close();
}

async function init() {
  const data = await invoke<{ config: Config; file_path: string | null }>("init");
  config = data.config;
  if (data.file_path) {
    await load(data.file_path);
  } else {
    initAnimation(viewport, () => nodes);
  }
}

async function load(path: string) {
  filePath = path;
  const data = (await invoke("read_canvas", { path })) as Canvas;
  nodes = data.nodes;
  edges = data.edges;
  initAnimation(viewport, () => nodes);
}

function addNode(x: number, y: number): string {
  pushSnapshot();
  const id = generateId();
  const node: CanvasNode = {
    type: "text",
    id,
    x: x - 125,
    y: y - 50,
    width: 250,
    height: 100,
    text: "",
  };
  nodes.push(node);
  selectedNodeIds = [id];
  mode = "insert";
  debouncedSave();
  return id;
}

function updateNode(id: string, text: string) {
  const node = nodes.find((n) => n.id === id);
  if (node && node.type === "text") {
    node.text = text;
    debouncedSave();
  }
}

function removeNode(id: string) {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx === -1) return;
  nodes.splice(idx, 1);
  const remainingEdges = edges.filter(e => e.fromNode !== id && e.toNode !== id);
  edges.length = 0;
  edges.push(...remainingEdges);
  selectedNodeIds = selectedNodeIds.filter(nid => nid !== id);
  animRemoveNode(id);
  debouncedSave();
}

function withNode(id: string, fn: (node: CanvasNode) => void) {
  const node = nodes.find((n) => n.id === id);
  if (node) { fn(node); debouncedSave(); }
}

function moveNode(id: string, dx: number, dy: number) {
  withNode(id, (node) => { node.x += dx; node.y += dy; });
  kick();
}

function resizeNode(id: string, dw: number, dh: number) {
  withNode(id, (node) => {
    node.width = Math.max(50, node.width + dw);
    node.height = Math.max(30, node.height + dh);
  });
  kick();
}

function setNodeSize(id: string, width: number, height: number) {
  withNode(id, (node) => {
    node.width = Math.max(50, width);
    node.height = Math.max(30, height);
  });
  kick();
}

function setNodeColor(id: string, color: string) {
  withNode(id, (node) => { node.color = color; });
}

function selectNode(id: string) {
  selectedNodeIds = [id];
  selectedEdgeId = null;
}

let cycleIndex = $state(-1);

function cycleNode(direction: 1 | -1) {
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

function removeEdge(id: string) {
  const idx = edges.findIndex((e) => e.id === id);
  if (idx === -1) return;
  edges.splice(idx, 1);
  if (selectedEdgeId === id) selectedEdgeId = null;
  debouncedSave();
}

function updateEdgeLabel(id: string, label: string) {
  const edge = edges.find((e) => e.id === id);
  if (edge) {
    edge.label = label || undefined;
    debouncedSave();
  }
}

function setEdgeColor(id: string, color: string) {
  const edge = edges.find((e) => e.id === id);
  if (edge) {
    edge.color = color || undefined;
    debouncedSave();
  }
}

function yankSelected() {
  const ids = new Set(selectedNodeIds);
  if (ids.size === 0) return;
  const clonedNodes: CanvasNode[] = JSON.parse(JSON.stringify(
    nodes.filter(n => ids.has(n.id))
  ));
  const clonedEdges: Edge[] = JSON.parse(JSON.stringify(
    edges.filter(e => ids.has(e.fromNode) && ids.has(e.toNode))
  ));
  clipboard = { nodes: clonedNodes, edges: clonedEdges };
}

function paste(centerX: number, centerY: number) {
  if (!clipboard || clipboard.nodes.length === 0) return;
  pushSnapshot();

  const idMap = new Map<string, string>();
  const clonedNodes: CanvasNode[] = JSON.parse(JSON.stringify(clipboard.nodes));
  const clonedEdges: Edge[] = JSON.parse(JSON.stringify(clipboard.edges));

  // Generate new IDs
  for (const node of clonedNodes) {
    const newId = generateId();
    idMap.set(node.id, newId);
    node.id = newId;
  }
  for (const edge of clonedEdges) {
    edge.id = generateId();
    edge.fromNode = idMap.get(edge.fromNode) ?? edge.fromNode;
    edge.toNode = idMap.get(edge.toNode) ?? edge.toNode;
  }

  // Calculate bounding box center of copied nodes, offset to target center
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of clonedNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const bboxCX = (minX + maxX) / 2;
  const bboxCY = (minY + maxY) / 2;
  const dx = centerX - bboxCX;
  const dy = centerY - bboxCY;
  for (const n of clonedNodes) {
    n.x += dx;
    n.y += dy;
  }

  nodes.push(...clonedNodes);
  edges.push(...clonedEdges);
  selectedNodeIds = clonedNodes.map(n => n.id);
  mode = "normal";
  snapAll();
  debouncedSave();
}

function enterInsert() {
  if (selectedNodeIds.length === 1 || selectedEdgeId) {
    pushSnapshot();
    mode = "insert";
  }
}

function enterMove(implicit: boolean) {
  pushSnapshot();
  implicitSelect = implicit;
  mode = "move";
}

function exitMove() {
  mode = "normal";
  if (implicitSelect) { deselectAll(); implicitSelect = false; }
}

function enterResize(implicit: boolean) {
  pushSnapshot();
  implicitSelect = implicit;
  mode = "resize";
}

function exitResize() {
  mode = "normal";
  if (implicitSelect) { deselectAll(); implicitSelect = false; }
}

function switchToResize() {
  mode = "resize";
}

function switchToMove() {
  mode = "move";
}

function exitInsert() {
  mode = "normal";
}

function snapViewport() {
  const spacing = STEP * viewport.zoom;
  viewport.x = Math.round(viewport.x / spacing) * spacing;
  viewport.y = Math.round(viewport.y / spacing) * spacing;
}

function centerOn(x: number, y: number) {
  viewport.x = -x * viewport.zoom;
  viewport.y = -y * viewport.zoom;
  snapViewport();
  kick();
}

function pan(dx: number, dy: number) {
  viewport.x += dx;
  viewport.y += dy;
  snapAll();
}

function panGrid(cellsX: number, cellsY: number) {
  viewport.x += cellsX * STEP * viewport.zoom;
  viewport.y += cellsY * STEP * viewport.zoom;
  snapViewport();
  kick();
}

function zoom(delta: number) {
  viewport.zoom = Math.max(0.1, Math.min(5, viewport.zoom + delta));
  snapViewport();
  kick();
}

function enterConnect(nodeId: string) {
  connectFromNodeId = nodeId;
  connectFromSide = null;
  mode = "connect";
}

function exitConnect() {
  connectFromNodeId = null;
  connectFromSide = null;
  mode = "normal";
}

function setConnectFromSide(side: Side) {
  connectFromSide = side;
}

function addEdge(fromId: string, fromSide: Side, toId: string, toSide: Side) {
  pushSnapshot();
  const id = generateId();
  const edge: Edge = {
    id,
    fromNode: fromId,
    fromSide,
    toNode: toId,
    toSide,
    toEnd: "arrow",
  };
  edges.push(edge);
  debouncedSave();
}

// --- Search ---

function getNodeText(node: CanvasNode): string {
  if (node.type === "text") return node.text;
  if (node.type === "file") return node.file;
  if (node.type === "link") return node.url;
  if (node.type === "group") return node.label ?? "";
  return "";
}

function centerOnNode(node: CanvasNode) {
  centerOn(node.x + node.width / 2, node.y + node.height / 2);
}

function enterSearch() {
  searchQuery = "";
  searchMatchIds = [];
  searchCurrentIndex = 0;
  searchConfirmed = false;
  mode = "search";
}

function exitSearch() {
  searchQuery = "";
  searchMatchIds = [];
  searchCurrentIndex = 0;
  searchConfirmed = false;
  mode = "normal";
}

function setSearchQuery(query: string) {
  searchQuery = query;
  if (!query) {
    searchMatchIds = [];
    searchCurrentIndex = 0;
    return;
  }
  const q = query.toLowerCase();
  searchMatchIds = nodes
    .filter(n => getNodeText(n).toLowerCase().includes(q))
    .map(n => n.id);
  searchCurrentIndex = 0;
  if (searchMatchIds.length > 0) {
    const node = nodes.find(n => n.id === searchMatchIds[0]);
    if (node) centerOnNode(node);
  }
}

function searchNext() {
  if (searchMatchIds.length === 0) return;
  searchCurrentIndex = (searchCurrentIndex + 1) % searchMatchIds.length;
  const node = nodes.find(n => n.id === searchMatchIds[searchCurrentIndex]);
  if (node) centerOnNode(node);
}

function searchPrev() {
  if (searchMatchIds.length === 0) return;
  searchCurrentIndex = (searchCurrentIndex - 1 + searchMatchIds.length) % searchMatchIds.length;
  const node = nodes.find(n => n.id === searchMatchIds[searchCurrentIndex]);
  if (node) centerOnNode(node);
}

function confirmSearch() {
  if (searchMatchIds.length > 0) {
    const id = searchMatchIds[searchCurrentIndex];
    selectNode(id);
  }
  searchConfirmed = true;
}

/** Map canvas spec color preset "1"-"6" to config color values */
function resolveColor(preset: string | undefined): string | undefined {
  if (!preset || !config) return undefined;
  const map: Record<string, string> = {
    "1": config.colors.red,
    "2": config.colors.orange,
    "3": config.colors.yellow,
    "4": config.colors.green,
    "5": config.colors.cyan,
    "6": config.colors.purple,
  };
  return map[preset] ?? preset;
}

export function getStore() {
  return {
    get nodes() { return nodes; },
    get edges() { return edges; },
    get viewport() { return viewport; },
    get viewportDisplay() { return getViewportDisplay(); },
    get nodeDisplay() { return getNodeDisplay(); },
    snapAll,
    get selectedNodeId() { return selectedNodeIds.length === 1 ? selectedNodeIds[0] : null; },
    get selectedNodeIds() { return selectedNodeIds; },
    get hasMultiSelect() { return selectedNodeIds.length > 1; },
    get selectedEdgeId() { return selectedEdgeId; },
    get mode() { return mode; },
    get connectFromNodeId() { return connectFromNodeId; },
    get connectFromSide() { return connectFromSide; },
    get filePath() { return filePath; },
    get config() { return config; },
    init,
    load,
    save,
    quit,
    addNode,
    updateNode,
    removeNode,
    moveNode,
    resizeNode,
    setNodeSize,
    setNodeColor,
    selectNode,
    cycleNode,
    toggleNodeSelection,
    deselectAll,
    selectEdge,
    removeEdge,
    updateEdgeLabel,
    setEdgeColor,
    enterInsert,
    exitInsert,
    enterMove,
    exitMove,
    enterResize,
    exitResize,
    switchToResize,
    switchToMove,
    enterConnect,
    exitConnect,
    setConnectFromSide,
    addEdge,
    centerOn,
    pan,
    panGrid,
    zoom,
    resolveColor,
    pushSnapshot,
    popSnapshot,
    yankSelected,
    paste,
    get canPaste() { return clipboard !== null; },
    undo,
    redo,
    get canUndo() { return history.length > 0; },
    get canRedo() { return future.length > 0; },
    // Search
    get searchQuery() { return searchQuery; },
    get searchMatchIds() { return searchMatchIds; },
    get searchCurrentIndex() { return searchCurrentIndex; },
    get searchConfirmed() { return searchConfirmed; },
    enterSearch,
    exitSearch,
    setSearchQuery,
    searchNext,
    searchPrev,
    confirmSearch,
  };
}
