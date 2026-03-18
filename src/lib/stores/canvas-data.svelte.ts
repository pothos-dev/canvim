import { invoke } from "@tauri-apps/api/core";
import type { Canvas, CanvasNode, Config, Edge, Side } from "../types";
import { getNodeText } from "../utils";
import { getModeStore } from "./mode.svelte";
import { getSelectionStore } from "./selection.svelte";
import { getConnectStore } from "./connect.svelte";
import { getSearchStore } from "./search.svelte";
import { getViewportStore } from "./viewport.svelte";

let nodes = $state<CanvasNode[]>([]);
let edges = $state<Edge[]>([]);
let filePath = $state<string | null>(null);
let config = $state<Config | null>(null);
let clipboard: { nodes: CanvasNode[]; edges: Edge[] } | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
  getModeStore().setMode("normal");
  const sel = getSelectionStore();
  sel.selectedNodeIds = [];
  sel.selectedEdgeId = null;
  const conn = getConnectStore();
  conn.connectFromNodeId = null;
  conn.connectFromSide = null;
  getModeStore().resetImplicitSelect();
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
  }
}

async function load(path: string) {
  filePath = path;
  const data = (await invoke("read_canvas", { path })) as Canvas;
  nodes = data.nodes;
  edges = data.edges;
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
  getSelectionStore().selectedNodeIds = [id];
  getModeStore().setMode("insert");
  debouncedSave();
  return id;
}

function findNode(id: string): CanvasNode | undefined {
  return nodes.find((n) => n.id === id);
}

function updateNode(id: string, text: string) {
  const node = findNode(id);
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
  const sel = getSelectionStore();
  sel.selectedNodeIds = sel.selectedNodeIds.filter(nid => nid !== id);
  debouncedSave();
}

function withNode(id: string, fn: (node: CanvasNode) => void) {
  const node = findNode(id);
  if (node) { fn(node); debouncedSave(); }
}

function moveNode(id: string, dx: number, dy: number) {
  withNode(id, (node) => { node.x += dx; node.y += dy; });
}

function resizeNode(id: string, dw: number, dh: number) {
  withNode(id, (node) => {
    node.width = Math.max(50, node.width + dw);
    node.height = Math.max(30, node.height + dh);
  });
}

function setNodeSize(id: string, width: number, height: number) {
  withNode(id, (node) => {
    node.width = Math.max(50, width);
    node.height = Math.max(30, height);
  });
}

function setNodeColor(id: string, color: string) {
  withNode(id, (node) => { node.color = color; });
}

function removeEdge(id: string) {
  const idx = edges.findIndex((e) => e.id === id);
  if (idx === -1) return;
  edges.splice(idx, 1);
  const sel = getSelectionStore();
  if (sel.selectedEdgeId === id) sel.selectedEdgeId = null;
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

function updateEdgeEndpoint(id: string, end: "from" | "to", nodeId: string, side: Side) {
  const edge = edges.find((e) => e.id === id);
  if (!edge) return;
  if (end === "from") {
    edge.fromNode = nodeId;
    edge.fromSide = side;
  } else {
    edge.toNode = nodeId;
    edge.toSide = side;
  }
  debouncedSave();
}

function addEdge(fromId: string, fromSide: Side, toId: string, toSide: Side): string {
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
  return id;
}

function yankSelected() {
  const sel = getSelectionStore();
  const ids = new Set(sel.selectedNodeIds);
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
  getSelectionStore().selectedNodeIds = clonedNodes.map(n => n.id);
  getModeStore().setMode("normal");
  debouncedSave();
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

export function getCanvasDataStore() {
  return {
    get nodes() { return nodes; },
    get edges() { return edges; },
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
    removeEdge,
    updateEdgeLabel,
    setEdgeColor,
    addEdge,
    updateEdgeEndpoint,
    pushSnapshot,
    popSnapshot,
    yankSelected,
    paste,
    get canPaste() { return clipboard !== null; },
    undo,
    redo,
    get canUndo() { return history.length > 0; },
    get canRedo() { return future.length > 0; },
    resolveColor,
    findNode,
  };
}
