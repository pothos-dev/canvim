/**
 * Tauri API mock for running the app in a regular browser (outside Tauri).
 * Intercepts @tauri-apps/api/core invoke() and @tauri-apps/api/window calls.
 */

import type { Canvas, Config } from "./types";

const DEFAULT_CONFIG: Config = {
  colors: {
    background: "#171717",
    node_background: "#262626",
    node_border: "#404040",
    edge: "#525252",
    text: "#d4d4d4",
    crosshair: "rgba(163, 163, 163, 0.3)",
    dot_grid: "rgba(163, 163, 163, 0.08)",
    status_bar_bg: "#0a0a0a",
    status_bar_text: "#737373",
    node_font: "system-ui, sans-serif",
    node_font_size: 14,
    red: "#fb464c",
    orange: "#e9973f",
    yellow: "#e0de71",
    green: "#44cf6e",
    cyan: "#53dfdd",
    purple: "#a882ff",
  },
  keybindings: {
    normal: {
      pan_left: "h",
      pan_right: "l",
      pan_up: "k",
      pan_down: "j",
      zoom_in: "+",
      zoom_out: "-",
      add_node: "a",
      select: "Enter",
      insert: "i",
      delete: "d",
      deselect: "Escape",
      quit: "q",
      enter_move: "m",
      enter_resize: "r",
      connect: "c",
      toggle_select: "v",
      deselect_all: "V",
      enter_visual: "v",
      color_red: "1",
      color_orange: "2",
      color_yellow: "3",
      color_green: "4",
      color_cyan: "5",
      color_purple: "6",
      color_clear: "0",
      yank: "y",
      paste: "p",
      undo: "u",
      redo: "C-r",
      search: "/",
    },
    move: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
    resize: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
    connect: { left: "h", right: "l", up: "k", down: "j", confirm: "Enter", exit: "Escape" },
    visual: { left: "h", right: "l", up: "k", down: "j", confirm: "Enter", exit: "Escape" },
    insert: {
      exit: "Escape",
    },
  },
};

const FALLBACK_CANVAS: Canvas = {
  nodes: [
    {
      type: "text",
      id: "a1b2c3d4e5f67890",
      x: -100,
      y: -260,
      width: 440,
      height: 260,
      text: "# Node A\n\nThis is the first test node with some content.",
    },
    {
      type: "text",
      id: "c3d4e5f678901234",
      x: 300,
      y: -200,
      width: 250,
      height: 180,
      text: "# Node B\n\nSecond node, connected to Node A.",
    },
  ],
  edges: [
    {
      id: "ed9ec4941ca04633",
      fromNode: "a1b2c3d4e5f67890",
      fromSide: "right",
      toNode: "c3d4e5f678901234",
      toSide: "left",
      toEnd: "arrow",
    },
    {
      id: "121d7fc0a23142e6",
      fromNode: "c3d4e5f678901234",
      fromSide: "top",
      toNode: "a1b2c3d4e5f67890",
      toSide: "bottom",
      toEnd: "arrow",
    },
  ],
};

let loadedCanvas: Canvas | null = null;

async function fetchCanvasFromFile(): Promise<Canvas> {
  if (loadedCanvas) return loadedCanvas;
  try {
    const resp = await fetch("/architecture.canvas");
    if (resp.ok) {
      loadedCanvas = await resp.json();
      return loadedCanvas!;
    }
  } catch { /* ignore */ }
  return FALLBACK_CANVAS;
}

const MOCK_HANDLERS: Record<string, (...args: unknown[]) => unknown> = {
  init: () => ({ config: DEFAULT_CONFIG, file_path: "mock://architecture.canvas" }),
  log: (args: any) => console.log("[webview]", args?.message),
  read_canvas: () => fetchCanvasFromFile(),
  save_canvas: () => {},
};

/** Returns true if we're running outside Tauri (plain browser). */
export function isBrowser(): boolean {
  return !(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

/**
 * Install the mock by patching window.__TAURI_INTERNALS__ so that
 * @tauri-apps/api/core invoke() routes through our handlers.
 */
export function installMock(): void {
  if (!isBrowser()) return;

  // The Tauri JS API checks for __TAURI_INTERNALS__.invoke
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
    invoke: (cmd: string, args?: unknown) => {
      const handler = MOCK_HANDLERS[cmd];
      if (handler) {
        return Promise.resolve(handler(args));
      }
      console.warn(`[tauri-mock] Unhandled invoke: ${cmd}`, args);
      return Promise.resolve(null);
    },
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main", windowLabel: "main" },
    },
    convertFileSrc: (path: string) => path,
  };
}
