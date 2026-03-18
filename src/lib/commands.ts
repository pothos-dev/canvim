import type { Config, CanvasNode, Edge, Point } from "./types";
import type { Mode } from "./canvas-store.svelte";
import { STEP, ZOOM_STEP } from "./constants";
import { detectSide, autoSides } from "./geometry";

export interface CommandContext {
  store: ReturnType<typeof import("./canvas-store.svelte").getStore>;
  config: Config;
  nodeUnderCursor: CanvasNode | undefined;
  edgeUnderCursor: Edge | undefined;
  addNodeAtCenter: () => void;
  startEdgeLabelEdit: () => void;
  finishEdgeLabelEdit: () => void;
  editingEdgeLabel: boolean;
  hideCursor: () => void;
  /** For connect mode: get node at viewport center */
  getNodeAtCenter: () => CanvasNode | undefined;
  /** Get canvas center point */
  getCanvasCenter: () => Point;
  /** Fit selected nodes' height to their content */
  fitNodesToContent: () => void;
  /** Multiplier for pan acceleration (1 = normal) */
  panMultiplier: number;
}

export interface Command {
  id: string;
  mode: Mode | Mode[];
  label: string;
  group?: string;
  configKey: string;
  hidden?: boolean;
  available: (ctx: CommandContext) => boolean;
  execute: (ctx: CommandContext) => void;
}

/** Resolve a dot-path config key to the actual keybinding string */
export function getCommandKey(cmd: Command, config: Config): string {
  const parts = cmd.configKey.split(".");
  let obj: any = config.keybindings;
  for (const p of parts) obj = obj?.[p];
  return obj as string;
}

const always = () => true;
const hasNode = (ctx: CommandContext) => !!ctx.nodeUnderCursor;
const hasEdge = (ctx: CommandContext) => !!ctx.edgeUnderCursor;
const hasNodeOrSelected = (ctx: CommandContext) =>
  !!ctx.nodeUnderCursor || ctx.store.selectedNodeIds.length > 0;
const noMultiSelect = (ctx: CommandContext) => !ctx.store.hasMultiSelect;
const singleNodeOrEdge = (ctx: CommandContext) =>
  noMultiSelect(ctx) && (!!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor);

function dirExecutor(dx: number, dy: number, action: "pan" | "move" | "resize" | "connect_pan") {
  return (ctx: CommandContext) => {
    ctx.hideCursor();
    if (action === "pan" || action === "connect_pan") {
      ctx.store.panGrid(-dx * ctx.panMultiplier, -dy * ctx.panMultiplier);
    } else if (action === "move") {
      for (const id of ctx.store.selectedNodeIds) {
        ctx.store.moveNode(id, dx * STEP, dy * STEP);
      }
      ctx.store.panGrid(-dx, -dy);
    } else if (action === "resize") {
      for (const id of ctx.store.selectedNodeIds) {
        ctx.store.resizeNode(id, dx * STEP, dy * STEP);
      }
    }
  };
}

function colorCommand(id: string, configKey: string, colorValue: string): Command {
  return {
    id,
    mode: "normal",
    label: id.replace("color_", ""),
    group: "color",
    configKey: `normal.${configKey}`,
    hidden: true,
    available: (ctx) => !!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor || ctx.store.selectedNodeIds.length > 0,
    execute: (ctx) => {
      ctx.store.pushSnapshot();
      if (ctx.store.selectedNodeIds.length > 0) {
        for (const nid of ctx.store.selectedNodeIds) {
          ctx.store.setNodeColor(nid, colorValue);
        }
      }
      if (ctx.nodeUnderCursor && !ctx.store.selectedNodeIds.includes(ctx.nodeUnderCursor.id)) {
        ctx.store.setNodeColor(ctx.nodeUnderCursor.id, colorValue);
      }
      if (ctx.edgeUnderCursor) {
        ctx.store.setEdgeColor(ctx.edgeUnderCursor.id, colorValue);
      }
    },
  };
}

export const commands: Command[] = [
  // === NORMAL MODE ===
  // Pan
  { id: "pan_left", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_left", available: always, execute: dirExecutor(-1, 0, "pan") },
  { id: "pan_right", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_right", available: always, execute: dirExecutor(1, 0, "pan") },
  { id: "pan_up", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_up", available: always, execute: dirExecutor(0, -1, "pan") },
  { id: "pan_down", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_down", available: always, execute: dirExecutor(0, 1, "pan") },
  // Arrow key aliases (hidden)
  { id: "pan_left_arrow", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_left", hidden: true, available: always, execute: dirExecutor(-1, 0, "pan") },
  { id: "pan_right_arrow", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_right", hidden: true, available: always, execute: dirExecutor(1, 0, "pan") },
  { id: "pan_up_arrow", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_up", hidden: true, available: always, execute: dirExecutor(0, -1, "pan") },
  { id: "pan_down_arrow", mode: "normal", label: "pan", group: "pan", configKey: "normal.pan_down", hidden: true, available: always, execute: dirExecutor(0, 1, "pan") },

  // Zoom
  { id: "zoom_in", mode: "normal", label: "zoom", group: "zoom", configKey: "normal.zoom_in", available: always,
    execute: (ctx) => ctx.store.zoom(ZOOM_STEP) },
  { id: "zoom_in_eq", mode: "normal", label: "zoom", group: "zoom", configKey: "normal.zoom_in", hidden: true, available: always,
    execute: (ctx) => ctx.store.zoom(ZOOM_STEP) },
  { id: "zoom_out", mode: "normal", label: "zoom", group: "zoom", configKey: "normal.zoom_out", available: always,
    execute: (ctx) => ctx.store.zoom(-ZOOM_STEP) },

  // Add node
  { id: "add_node", mode: "normal", label: "add", configKey: "normal.add_node", available: always,
    execute: (ctx) => ctx.addNodeAtCenter() },

  // Select (Enter) — selects node/edge without entering insert mode
  { id: "select", mode: "normal", label: "select", configKey: "normal.select",
    available: (ctx) => noMultiSelect(ctx) && (!!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor),
    execute: (ctx) => {
      if (ctx.nodeUnderCursor) {
        ctx.store.selectNode(ctx.nodeUnderCursor.id);
      } else if (ctx.edgeUnderCursor) {
        ctx.store.selectEdge(ctx.edgeUnderCursor.id);
      }
    },
  },

  // Insert mode shortcut
  { id: "insert", mode: "normal", label: "insert", configKey: "normal.insert", hidden: true,
    available: (ctx) => noMultiSelect(ctx) && !!ctx.nodeUnderCursor,
    execute: (ctx) => {
      if (ctx.nodeUnderCursor) {
        const implicit = !ctx.store.selectedNodeIds.includes(ctx.nodeUnderCursor.id);
        ctx.store.selectNode(ctx.nodeUnderCursor.id);
        ctx.store.enterInsert(implicit);
      }
    },
  },

  // Delete
  { id: "delete", mode: "normal", label: "del", configKey: "normal.delete",
    available: (ctx) => !!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor || ctx.store.selectedNodeIds.length > 0,
    execute: (ctx) => {
      ctx.store.pushSnapshot();
      if (ctx.store.selectedNodeIds.length > 0) {
        for (const id of [...ctx.store.selectedNodeIds]) {
          ctx.store.removeNode(id);
        }
        return;
      }
      if (ctx.nodeUnderCursor) {
        ctx.store.removeNode(ctx.nodeUnderCursor.id);
      } else if (ctx.edgeUnderCursor) {
        ctx.store.removeEdge(ctx.edgeUnderCursor.id);
      } else {
        const edge = ctx.store.selectedEdgeId
          ? ctx.store.edges.find(e => e.id === ctx.store.selectedEdgeId)
          : undefined;
        if (edge) ctx.store.removeEdge(edge.id);
      }
    },
  },
  // Delete key alias (hidden)
  { id: "delete_key", mode: "normal", label: "del", configKey: "normal.delete", hidden: true,
    available: (ctx) => !!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor || ctx.store.selectedNodeIds.length > 0,
    execute: (ctx) => {
      // Same as delete command
      const delCmd = commands.find(c => c.id === "delete")!;
      delCmd.execute(ctx);
    },
  },

  // Quit
  { id: "quit", mode: "normal", label: "quit", configKey: "normal.quit", available: always,
    execute: (ctx) => ctx.store.quit() },

  // Enter move mode
  { id: "enter_move", mode: "normal", label: "move", configKey: "normal.enter_move",
    available: hasNodeOrSelected,
    execute: (ctx) => {
      if (ctx.store.selectedNodeIds.length === 0 && ctx.nodeUnderCursor) {
        ctx.store.selectNode(ctx.nodeUnderCursor.id);
        ctx.store.enterMove(true);
      } else {
        ctx.store.enterMove(false);
      }
    },
  },

  // Enter resize mode
  { id: "enter_resize", mode: "normal", label: "resize", configKey: "normal.enter_resize",
    available: hasNodeOrSelected,
    execute: (ctx) => {
      if (ctx.store.selectedNodeIds.length === 0 && ctx.nodeUnderCursor) {
        ctx.store.selectNode(ctx.nodeUnderCursor.id);
        ctx.store.enterResize(true);
      } else {
        ctx.store.enterResize(false);
      }
    },
  },

  // Connect
  { id: "connect", mode: "normal", label: "connect", configKey: "normal.connect",
    available: (ctx) => noMultiSelect(ctx) && hasNode(ctx),
    execute: (ctx) => {
      if (ctx.nodeUnderCursor) ctx.store.enterConnect(ctx.nodeUnderCursor.id);
    },
  },

  // Visual mode (v) — selection rectangle
  { id: "enter_visual", mode: "normal", label: "visual", configKey: "normal.enter_visual",
    available: always,
    execute: (ctx) => {
      const center = ctx.getCanvasCenter();
      ctx.store.enterVisual(center.x, center.y);
    },
  },

  // Deselect all (V)
  { id: "deselect_all", mode: "normal", label: "deselect all", configKey: "normal.deselect_all",
    available: (ctx) => ctx.store.selectedNodeIds.length > 0,
    execute: (ctx) => ctx.store.deselectAll(),
  },

  // Deselect (Esc)
  { id: "deselect", mode: "normal", label: "deselect", configKey: "normal.deselect", hidden: true,
    available: always,
    execute: (ctx) => ctx.store.deselectAll(),
  },

  // Yank / Paste
  { id: "yank", mode: "normal", label: "yank", configKey: "normal.yank",
    available: hasNodeOrSelected,
    execute: (ctx) => {
      if (ctx.store.selectedNodeIds.length === 0 && ctx.nodeUnderCursor) {
        ctx.store.selectNode(ctx.nodeUnderCursor.id);
      }
      ctx.store.yankSelected();
    },
  },
  { id: "yank_ctrlc", mode: "normal", label: "yank", configKey: "normal.yank", hidden: true,
    available: hasNodeOrSelected,
    execute: (ctx) => {
      if (ctx.store.selectedNodeIds.length === 0 && ctx.nodeUnderCursor) {
        ctx.store.selectNode(ctx.nodeUnderCursor.id);
      }
      ctx.store.yankSelected();
    },
  },
  { id: "paste", mode: "normal", label: "paste", configKey: "normal.paste",
    available: (ctx) => ctx.store.canPaste,
    execute: (ctx) => {
      const center = ctx.getCanvasCenter();
      ctx.store.paste(center.x, center.y);
    },
  },
  { id: "paste_ctrlv", mode: "normal", label: "paste", configKey: "normal.paste", hidden: true,
    available: (ctx) => ctx.store.canPaste,
    execute: (ctx) => {
      const center = ctx.getCanvasCenter();
      ctx.store.paste(center.x, center.y);
    },
  },

  // Undo / Redo
  { id: "undo", mode: "normal", label: "undo", configKey: "normal.undo",
    available: (ctx) => ctx.store.canUndo,
    execute: (ctx) => ctx.store.undo(),
  },
  { id: "redo", mode: "normal", label: "redo", configKey: "normal.redo",
    available: (ctx) => ctx.store.canRedo,
    execute: (ctx) => ctx.store.redo(),
  },

  // Colors
  colorCommand("color_red", "color_red", "1"),
  colorCommand("color_orange", "color_orange", "2"),
  colorCommand("color_yellow", "color_yellow", "3"),
  colorCommand("color_green", "color_green", "4"),
  colorCommand("color_cyan", "color_cyan", "5"),
  colorCommand("color_purple", "color_purple", "6"),
  colorCommand("color_clear", "color_clear", ""),

  // === MOVE MODE ===
  { id: "move_left", mode: "move", label: "move", group: "move_dir", configKey: "move.left", available: always, execute: dirExecutor(-1, 0, "move") },
  { id: "move_right", mode: "move", label: "move", group: "move_dir", configKey: "move.right", available: always, execute: dirExecutor(1, 0, "move") },
  { id: "move_up", mode: "move", label: "move", group: "move_dir", configKey: "move.up", available: always, execute: dirExecutor(0, -1, "move") },
  { id: "move_down", mode: "move", label: "move", group: "move_dir", configKey: "move.down", available: always, execute: dirExecutor(0, 1, "move") },
  // Arrow aliases
  { id: "move_left_arrow", mode: "move", label: "move", group: "move_dir", configKey: "move.left", hidden: true, available: always, execute: dirExecutor(-1, 0, "move") },
  { id: "move_right_arrow", mode: "move", label: "move", group: "move_dir", configKey: "move.right", hidden: true, available: always, execute: dirExecutor(1, 0, "move") },
  { id: "move_up_arrow", mode: "move", label: "move", group: "move_dir", configKey: "move.up", hidden: true, available: always, execute: dirExecutor(0, -1, "move") },
  { id: "move_down_arrow", mode: "move", label: "move", group: "move_dir", configKey: "move.down", hidden: true, available: always, execute: dirExecutor(0, 1, "move") },
  { id: "move_to_resize", mode: "move", label: "resize", configKey: "normal.enter_resize", hidden: true, available: always,
    execute: (ctx) => { ctx.store.switchToResize(); } },
  { id: "move_exit", mode: "move", label: "exit", configKey: "move.exit", available: always,
    execute: (ctx) => ctx.store.exitMove() },
  { id: "move_exit_enter", mode: "move", label: "exit", configKey: "normal.select", hidden: true, available: always,
    execute: (ctx) => ctx.store.exitMove() },
  { id: "move_to_insert", mode: "move", label: "insert", configKey: "normal.insert", hidden: true, available: always,
    execute: (ctx) => { ctx.store.exitMove(); ctx.store.enterInsert(); } },

  // === RESIZE MODE ===
  { id: "resize_left", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.left", available: always, execute: dirExecutor(-1, 0, "resize") },
  { id: "resize_right", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.right", available: always, execute: dirExecutor(1, 0, "resize") },
  { id: "resize_up", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.up", available: always, execute: dirExecutor(0, -1, "resize") },
  { id: "resize_down", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.down", available: always, execute: dirExecutor(0, 1, "resize") },
  // Arrow aliases
  { id: "resize_left_arrow", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.left", hidden: true, available: always, execute: dirExecutor(-1, 0, "resize") },
  { id: "resize_right_arrow", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.right", hidden: true, available: always, execute: dirExecutor(1, 0, "resize") },
  { id: "resize_up_arrow", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.up", hidden: true, available: always, execute: dirExecutor(0, -1, "resize") },
  { id: "resize_down_arrow", mode: "resize", label: "resize", group: "resize_dir", configKey: "resize.down", hidden: true, available: always, execute: dirExecutor(0, 1, "resize") },
  { id: "resize_fit", mode: "resize", label: "fit", configKey: "normal.enter_resize", available: always,
    execute: (ctx) => { ctx.fitNodesToContent(); ctx.store.exitResize(); } },
  { id: "resize_to_move", mode: "resize", label: "move", configKey: "normal.enter_move", hidden: true, available: always,
    execute: (ctx) => { ctx.store.switchToMove(); } },
  { id: "resize_exit", mode: "resize", label: "exit", configKey: "resize.exit", available: always,
    execute: (ctx) => ctx.store.exitResize() },
  { id: "resize_exit_enter", mode: "resize", label: "exit", configKey: "normal.select", hidden: true, available: always,
    execute: (ctx) => ctx.store.exitResize() },
  { id: "resize_to_insert", mode: "resize", label: "insert", configKey: "normal.insert", hidden: true, available: always,
    execute: (ctx) => { ctx.store.exitResize(); ctx.store.enterInsert(); } },

  // === CONNECT MODE ===
  { id: "connect_left", mode: "connect", label: "move", group: "connect_dir", configKey: "connect.left", available: always, execute: dirExecutor(-1, 0, "connect_pan") },
  { id: "connect_right", mode: "connect", label: "move", group: "connect_dir", configKey: "connect.right", available: always, execute: dirExecutor(1, 0, "connect_pan") },
  { id: "connect_up", mode: "connect", label: "move", group: "connect_dir", configKey: "connect.up", available: always, execute: dirExecutor(0, -1, "connect_pan") },
  { id: "connect_down", mode: "connect", label: "move", group: "connect_dir", configKey: "connect.down", available: always, execute: dirExecutor(0, 1, "connect_pan") },
  { id: "connect_confirm", mode: "connect", label: "connect", configKey: "connect.confirm", available: always,
    execute: (ctx) => {
      const target = ctx.getNodeAtCenter();
      if (!target || target.id === ctx.store.connectFromNodeId) {
        if (!target) ctx.store.exitConnect();
        return;
      }
      const fromNode = ctx.store.nodes.find(n => n.id === ctx.store.connectFromNodeId);
      if (!fromNode) { ctx.store.exitConnect(); return; }
      const fromSide = ctx.store.connectFromSide ?? autoSides(fromNode, target).fromSide;
      const center = ctx.getCanvasCenter();
      const toSide = detectSide(target, center);
      ctx.store.addEdge(fromNode.id, fromSide, target.id, toSide);
      ctx.store.exitConnect();
    },
  },
  { id: "connect_exit", mode: "connect", label: "cancel", configKey: "connect.exit", available: always,
    execute: (ctx) => ctx.store.exitConnect() },

  // Cycle nodes
  { id: "cycle_next", mode: "normal", label: "next node", configKey: "normal.pan_down", hidden: true,
    available: (ctx) => ctx.store.nodes.length > 0,
    execute: (ctx) => ctx.store.cycleNode(1) },
  { id: "cycle_prev", mode: "normal", label: "prev node", configKey: "normal.pan_up", hidden: true,
    available: (ctx) => ctx.store.nodes.length > 0,
    execute: (ctx) => ctx.store.cycleNode(-1) },

  // Search
  { id: "search", mode: "normal", label: "search", configKey: "normal.search", available: always,
    execute: (ctx) => ctx.store.enterSearch() },
  { id: "search_ctrlf", mode: "normal", label: "search", configKey: "normal.search", hidden: true,
    available: always, execute: (ctx) => ctx.store.enterSearch() },

  // === SEARCH MODE (navigation phase — after Enter confirms query) ===
  { id: "search_next", mode: "search", label: "next", configKey: "normal.pan_down", hidden: true,
    available: always, execute: (ctx) => ctx.store.searchNext() },
  { id: "search_prev", mode: "search", label: "prev", configKey: "normal.pan_up", hidden: true,
    available: always, execute: (ctx) => ctx.store.searchPrev() },
  { id: "search_exit", mode: "search", label: "exit", configKey: "normal.deselect", hidden: true,
    available: always, execute: (ctx) => ctx.store.exitSearch() },

  // === VISUAL MODE ===
  { id: "visual_left", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.left", available: always, execute: dirExecutor(-1, 0, "pan") },
  { id: "visual_right", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.right", available: always, execute: dirExecutor(1, 0, "pan") },
  { id: "visual_up", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.up", available: always, execute: dirExecutor(0, -1, "pan") },
  { id: "visual_down", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.down", available: always, execute: dirExecutor(0, 1, "pan") },
  // Arrow aliases
  { id: "visual_left_arrow", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.left", hidden: true, available: always, execute: dirExecutor(-1, 0, "pan") },
  { id: "visual_right_arrow", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.right", hidden: true, available: always, execute: dirExecutor(1, 0, "pan") },
  { id: "visual_up_arrow", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.up", hidden: true, available: always, execute: dirExecutor(0, -1, "pan") },
  { id: "visual_down_arrow", mode: "visual", label: "move", group: "visual_dir", configKey: "visual.down", hidden: true, available: always, execute: dirExecutor(0, 1, "pan") },
  { id: "visual_confirm", mode: "visual", label: "select", configKey: "visual.confirm", available: always,
    execute: (ctx) => {
      const center = ctx.getCanvasCenter();
      ctx.store.confirmVisual(center.x, center.y);
    },
  },
  { id: "visual_exit", mode: "visual", label: "cancel", configKey: "visual.exit", available: always,
    execute: (ctx) => ctx.store.exitVisual() },

  // === INSERT MODE ===
  { id: "insert_exit", mode: "insert", label: "exit", configKey: "insert.exit", available: always,
    execute: (ctx) => {
      if (ctx.editingEdgeLabel) ctx.finishEdgeLabelEdit();
      else ctx.store.exitInsert();
    },
  },
];

/** Build key lookup map for current config. Arrow keys are added as aliases. */
export function buildKeyMap(config: Config): Map<string, Command[]> {
  const map = new Map<string, Command[]>();

  const arrowAliases: Record<string, string> = {
    "pan_left_arrow": "ArrowLeft",
    "pan_right_arrow": "ArrowRight",
    "pan_up_arrow": "ArrowUp",
    "pan_down_arrow": "ArrowDown",
    "move_left_arrow": "ArrowLeft",
    "move_right_arrow": "ArrowRight",
    "move_up_arrow": "ArrowUp",
    "move_down_arrow": "ArrowDown",
    "resize_left_arrow": "ArrowLeft",
    "resize_right_arrow": "ArrowRight",
    "resize_up_arrow": "ArrowUp",
    "resize_down_arrow": "ArrowDown",
    "visual_left_arrow": "ArrowLeft",
    "visual_right_arrow": "ArrowRight",
    "visual_up_arrow": "ArrowUp",
    "visual_down_arrow": "ArrowDown",
    "delete_key": "Delete",
    "zoom_in_eq": "=",
    "yank_ctrlc": "C-c",
    "paste_ctrlv": "C-v",
    "search_ctrlf": "C-f",
    "search_next": "n",
    "search_prev": "N",
    "cycle_next": "Tab",
    "cycle_prev": "S-Tab",
  };

  for (const cmd of commands) {
    const modes = Array.isArray(cmd.mode) ? cmd.mode : [cmd.mode];
    const rawKey = arrowAliases[cmd.id] ?? getCommandKey(cmd, config);
    const key = rawKey;
    for (const m of modes) {
      const mapKey = `${m}:${key}`;
      const existing = map.get(mapKey) ?? [];
      existing.push(cmd);
      map.set(mapKey, existing);
    }
  }
  return map;
}

/** Plain-value snapshot for hint computation — avoids reactive proxy reads */
export interface HintSnapshot {
  hasNode: boolean;
  hasEdge: boolean;
  selectedCount: number;
}

/** Check command availability from plain snapshot values (no reactive proxy) */
function isAvailableFromSnapshot(cmd: Command, snap: HintSnapshot): boolean {
  const fn = cmd.available;
  // We can't call available() with full ctx because it reads reactive proxies.
  // Instead, replicate the logic with plain values.
  // The available functions only check: nodeUnderCursor, edgeUnderCursor,
  // selectedNodeIds.length, and hasMultiSelect (selectedNodeIds.length > 1).
  const hasNodeOrSelected = snap.hasNode || snap.selectedCount > 0;
  const noMulti = snap.selectedCount <= 1;

  switch (cmd.id) {
    case "select":
    case "insert":
      return noMulti && snap.hasNode;
    case "enter_move":
    case "enter_resize":
      return hasNodeOrSelected;
    case "connect":
      return noMulti && snap.hasNode;
    case "enter_visual":
      return true;
    case "deselect_all":
      return snap.selectedCount > 0;
    case "delete":
    case "delete_key":
      return snap.hasNode || snap.hasEdge || snap.selectedCount > 0;
    case "color_red": case "color_orange": case "color_yellow":
    case "color_green": case "color_cyan": case "color_purple":
    case "color_clear":
      return snap.hasNode || snap.hasEdge || snap.selectedCount > 0;
    case "search":
      return true;
    case "yank":
      return hasNodeOrSelected;
    case "paste":
      return true; // Can't check clipboard in snapshot, always show hint
    case "undo":
    case "redo":
      return true; // Can't check history in snapshot, always show hint
    default:
      return true; // pan, zoom, add_node, quit, mode exits, etc.
  }
}

/** Generate hint strings for the status bar using a plain snapshot */
export function getHints(config: Config, mode: Mode, snap: HintSnapshot): string[] {
  const seen = new Set<string>();
  const hints: string[] = [];

  for (const cmd of commands) {
    if (cmd.hidden) continue;
    const modes = Array.isArray(cmd.mode) ? cmd.mode : [cmd.mode];
    if (!modes.includes(mode)) continue;
    if (!isAvailableFromSnapshot(cmd, snap)) continue;

    const groupKey = cmd.group ?? cmd.id;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);

    // Collect all keys for this group
    const keys: string[] = [];
    for (const c of commands) {
      if (c.hidden) continue;
      const cModes = Array.isArray(c.mode) ? c.mode : [c.mode];
      if (!cModes.includes(mode)) continue;
      const cGroup = c.group ?? c.id;
      if (cGroup !== groupKey) continue;
      const k = getCommandKey(c, config);
      if (!keys.includes(k)) keys.push(k);
    }

    hints.push(`${keys.join("")}:${cmd.label}`);
  }
  return hints;
}
