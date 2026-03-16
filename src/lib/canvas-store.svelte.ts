import { invoke } from "@tauri-apps/api/core";
import type { Canvas, CanvasNode, Config, Edge, Viewport } from "./types";

export type Mode = "normal" | "insert";

let nodes = $state<CanvasNode[]>([]);
let edges = $state<Edge[]>([]);
let viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
let selectedNodeId = $state<string | null>(null);
let mode = $state<Mode>("normal");
let filePath = $state<string | null>(null);
let config = $state<Config | null>(null);
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
  if (idx !== -1) {
    nodes.splice(idx, 1);
    const edgeIdxs: number[] = [];
    edges.forEach((e, i) => {
      if (e.fromNode === id || e.toNode === id) edgeIdxs.push(i);
    });
    for (let i = edgeIdxs.length - 1; i >= 0; i--) {
      edges.splice(edgeIdxs[i], 1);
    }
    if (selectedNodeId === id) selectedNodeId = null;
    debouncedSave();
  }
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
}

function enterInsert() {
  if (selectedNodeId) mode = "insert";
}

function exitInsert() {
  mode = "normal";
}

function deselect() {
  selectedNodeId = null;
}

function pan(dx: number, dy: number) {
  viewport.x += dx;
  viewport.y += dy;
}

function zoom(delta: number) {
  viewport.zoom = Math.max(0.1, Math.min(5, viewport.zoom + delta));
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
    get mode() { return mode; },
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
    enterInsert,
    exitInsert,
    deselect,
    pan,
    zoom,
    resolveColor,
  };
}
