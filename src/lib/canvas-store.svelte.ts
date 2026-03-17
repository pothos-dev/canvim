import { invoke } from "@tauri-apps/api/core";
import type { Canvas, CanvasNode, Config, Edge, Viewport } from "./types";

export type Mode = "normal" | "insert" | "connect";
export type Side = "top" | "right" | "bottom" | "left";

let nodes = $state<CanvasNode[]>([]);
let edges = $state<Edge[]>([]);
let viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
let selectedNodeId = $state<string | null>(null);
let selectedEdgeId = $state<string | null>(null);
let mode = $state<Mode>("normal");
let connectFromNodeId = $state<string | null>(null);
let connectFromSide = $state<Side | null>(null);
let filePath = $state<string | null>(null);
let config = $state<Config | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const GRID_STEP = 20;

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

async function loadConfig() {
  config = await invoke<Config>("get_config");
}

async function load(path: string) {
  filePath = path;
  const data = (await invoke("read_canvas", { path })) as Canvas;
  nodes = data.nodes;
  edges = data.edges;
}

function addNode(x: number, y: number): string {
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
  selectedNodeId = id;
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
  if (selectedNodeId === id) selectedNodeId = null;
  debouncedSave();
}

function moveNode(id: string, dx: number, dy: number) {
  const node = nodes.find((n) => n.id === id);
  if (node) {
    node.x += dx;
    node.y += dy;
    debouncedSave();
  }
}

function resizeNode(id: string, dw: number, dh: number) {
  const node = nodes.find((n) => n.id === id);
  if (node) {
    node.width = Math.max(50, node.width + dw);
    node.height = Math.max(30, node.height + dh);
    debouncedSave();
  }
}

function setNodeColor(id: string, color: string) {
  const node = nodes.find((n) => n.id === id);
  if (node) {
    node.color = color;
    debouncedSave();
  }
}

function selectNode(id: string) {
  selectedNodeId = id;
  selectedEdgeId = null;
}

function selectEdge(id: string) {
  selectedEdgeId = id;
  selectedNodeId = null;
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

function enterInsert() {
  if (selectedNodeId || selectedEdgeId) mode = "insert";
}

function exitInsert() {
  mode = "normal";
}

function deselect() {
  selectedNodeId = null;
  selectedEdgeId = null;
}

function snapViewport() {
  const spacing = GRID_STEP * viewport.zoom;
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
  viewport.x += cellsX * GRID_STEP * viewport.zoom;
  viewport.y += cellsY * GRID_STEP * viewport.zoom;
  snapViewport();
}

function zoom(delta: number) {
  viewport.zoom = Math.max(0.1, Math.min(5, viewport.zoom + delta));
  snapViewport();
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
    get selectedNodeId() { return selectedNodeId; },
    get selectedEdgeId() { return selectedEdgeId; },
    get mode() { return mode; },
    get connectFromNodeId() { return connectFromNodeId; },
    get connectFromSide() { return connectFromSide; },
    get filePath() { return filePath; },
    get config() { return config; },
    loadConfig,
    load,
    save,
    quit,
    addNode,
    updateNode,
    removeNode,
    moveNode,
    resizeNode,
    setNodeColor,
    selectNode,
    selectEdge,
    removeEdge,
    updateEdgeLabel,
    setEdgeColor,
    enterInsert,
    exitInsert,
    enterConnect,
    exitConnect,
    setConnectFromSide,
    addEdge,
    deselect,
    centerOn,
    pan,
    panGrid,
    zoom,
    resolveColor,
  };
}
