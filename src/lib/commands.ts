import type { Config, CanvasNode, Edge, Point } from "./types";
import type { Mode } from "./stores/mode.svelte";
import { STEP, ZOOM_STEP } from "./constants";
import { detectSide, autoSides } from "./geometry";

export interface CommandContext {
  store: ReturnType<typeof import("./stores/index").getStore>;
  config: Config;
  nodeUnderCursor: CanvasNode | undefined;
  edgeUnderCursor: Edge | undefined;
  addNodeAtCenter: () => void;
  startEdgeLabelEdit: () => void;
  finishEdgeLabelEdit: () => void;
  editingEdgeLabel: boolean;
  hideCursor: () => void;
  getNodeAtCenter: () => CanvasNode | undefined;
  getCanvasCenter: () => Point;
  fitNodesToContent: () => void;
  panMultiplier: number;
}

/** Plain-value snapshot for hint computation — avoids reactive proxy reads */
export interface HintSnapshot {
  hasNode: boolean;
  hasEdge: boolean;
  selectedCount: number;
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
  /** Snapshot-based availability for hints (avoids reactive proxy reads) */
  hintAvailable?: (snap: HintSnapshot) => boolean;
}

/** Resolve a dot-path config key to the actual keybinding string */
export function getCommandKey(cmd: Command, config: Config): string {
  const parts = cmd.configKey.split(".");
  let obj: any = config.keybindings;
  for (const p of parts) obj = obj?.[p];
  return obj as string;
}

// --- Shared availability predicates ---

const always = () => true;
const hasNode = (ctx: CommandContext) => !!ctx.nodeUnderCursor;
const hasNodeOrSelected = (ctx: CommandContext) =>
  !!ctx.nodeUnderCursor || ctx.store.selectedNodeIds.length > 0;
const noMultiSelect = (ctx: CommandContext) => !ctx.store.hasMultiSelect;

// Snapshot versions
const hintAlways = () => true;
const hintHasNodeOrSelected = (snap: HintSnapshot) => snap.hasNode || snap.selectedCount > 0;
const hintHasNodeOrEdgeOrSelected = (snap: HintSnapshot) => snap.hasNode || snap.hasEdge || snap.selectedCount > 0;

// --- Factories ---

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

/** Generate 8 directional commands (4 hjkl + 4 arrow aliases) for a mode */
function directionalCommands(
  mode: Mode,
  prefix: string,
  label: string,
  group: string,
  configPrefix: string,
  action: "pan" | "move" | "resize" | "connect_pan",
): Command[] {
  const dirs = [
    { suffix: "left", dx: -1, dy: 0, arrow: "ArrowLeft" },
    { suffix: "right", dx: 1, dy: 0, arrow: "ArrowRight" },
    { suffix: "up", dx: 0, dy: -1, arrow: "ArrowUp" },
    { suffix: "down", dx: 0, dy: 1, arrow: "ArrowDown" },
  ];
  const cmds: Command[] = [];
  for (const d of dirs) {
    cmds.push({
      id: `${prefix}_${d.suffix}`,
      mode,
      label,
      group,
      configKey: `${configPrefix}.${d.suffix}`,
      available: always,
      execute: dirExecutor(d.dx, d.dy, action),
    });
    cmds.push({
      id: `${prefix}_${d.suffix}_arrow`,
      mode,
      label,
      group,
      configKey: `${configPrefix}.${d.suffix}`,
      hidden: true,
      available: always,
      execute: dirExecutor(d.dx, d.dy, action),
    });
  }
  return cmds;
}

function colorCommand(id: string, configKey: string, colorValue: string): Command {
  const avail = (ctx: CommandContext) => !!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor || ctx.store.selectedNodeIds.length > 0;
  return {
    id,
    mode: "normal",
    label: id.replace("color_", ""),
    group: "color",
    configKey: `normal.${configKey}`,
    hidden: true,
    available: avail,
    hintAvailable: hintHasNodeOrEdgeOrSelected,
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

// --- Shared executors for aliased commands ---

function executeYank(ctx: CommandContext) {
  if (ctx.store.selectedNodeIds.length === 0 && ctx.nodeUnderCursor) {
    ctx.store.selectNode(ctx.nodeUnderCursor.id);
  }
  ctx.store.yankSelected();
}

function executePaste(ctx: CommandContext) {
  const center = ctx.getCanvasCenter();
  ctx.store.paste(center.x, center.y);
}

function executeDelete(ctx: CommandContext) {
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
}

const deleteAvailable = (ctx: CommandContext) => !!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor || ctx.store.selectedNodeIds.length > 0;

// --- Command definitions ---

export const commands: Command[] = [
  // === NORMAL MODE ===
  ...directionalCommands("normal", "pan", "pan", "pan", "normal.pan", "pan"),

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

  // Select (Enter)
  { id: "select", mode: "normal", label: "select", configKey: "normal.select",
    available: (ctx) => noMultiSelect(ctx) && (!!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor),
    hintAvailable: (snap) => snap.selectedCount <= 1 && snap.hasNode,
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
    available: (ctx) => noMultiSelect(ctx) && (!!ctx.nodeUnderCursor || !!ctx.edgeUnderCursor),
    hintAvailable: (snap) => snap.selectedCount <= 1 && snap.hasNode,
    execute: (ctx) => {
      if (ctx.nodeUnderCursor) {
        const implicit = !ctx.store.selectedNodeIds.includes(ctx.nodeUnderCursor.id);
        ctx.store.selectNode(ctx.nodeUnderCursor.id);
        ctx.store.enterInsert(implicit);
      } else if (ctx.edgeUnderCursor) {
        ctx.store.selectEdge(ctx.edgeUnderCursor.id);
        ctx.startEdgeLabelEdit();
      }
    },
  },

  // Delete
  { id: "delete", mode: "normal", label: "del", configKey: "normal.delete",
    available: deleteAvailable,
    hintAvailable: hintHasNodeOrEdgeOrSelected,
    execute: executeDelete,
  },
  { id: "delete_key", mode: "normal", label: "del", configKey: "normal.delete", hidden: true,
    available: deleteAvailable,
    execute: executeDelete,
  },

  // Quit
  { id: "quit", mode: "normal", label: "quit", configKey: "normal.quit", available: always,
    execute: (ctx) => ctx.store.quit() },

  // Enter move mode
  { id: "enter_move", mode: "normal", label: "move", configKey: "normal.enter_move",
    available: hasNodeOrSelected,
    hintAvailable: hintHasNodeOrSelected,
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
    hintAvailable: hintHasNodeOrSelected,
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
    hintAvailable: (snap) => snap.selectedCount <= 1 && snap.hasNode,
    execute: (ctx) => {
      if (ctx.nodeUnderCursor) ctx.store.enterConnect(ctx.nodeUnderCursor.id);
    },
  },

  // Visual mode
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
    hintAvailable: (snap) => snap.selectedCount > 0,
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
    hintAvailable: hintHasNodeOrSelected,
    execute: executeYank,
  },
  { id: "yank_ctrlc", mode: "normal", label: "yank", configKey: "normal.yank", hidden: true,
    available: hasNodeOrSelected,
    execute: executeYank,
  },
  { id: "paste", mode: "normal", label: "paste", configKey: "normal.paste",
    available: (ctx) => ctx.store.canPaste,
    execute: executePaste,
  },
  { id: "paste_ctrlv", mode: "normal", label: "paste", configKey: "normal.paste", hidden: true,
    available: (ctx) => ctx.store.canPaste,
    execute: executePaste,
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
  ...directionalCommands("move", "move", "move", "move_dir", "move", "move"),
  { id: "move_to_resize", mode: "move", label: "resize", configKey: "normal.enter_resize", hidden: true, available: always,
    execute: (ctx) => { ctx.store.switchToResize(); } },
  { id: "move_exit", mode: "move", label: "exit", configKey: "move.exit", available: always,
    execute: (ctx) => ctx.store.exitMove() },
  { id: "move_exit_enter", mode: "move", label: "exit", configKey: "normal.select", hidden: true, available: always,
    execute: (ctx) => ctx.store.exitMove() },
  { id: "move_to_insert", mode: "move", label: "insert", configKey: "normal.insert", hidden: true, available: always,
    execute: (ctx) => { ctx.store.exitMove(); ctx.store.enterInsert(); } },

  // === RESIZE MODE ===
  ...directionalCommands("resize", "resize", "resize", "resize_dir", "resize", "resize"),
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
  ...directionalCommands("connect", "connect", "move", "connect_dir", "connect", "connect_pan"),
  { id: "connect_confirm", mode: "connect", label: "connect", configKey: "connect.confirm", available: always,
    execute: (ctx) => {
      const target = ctx.getNodeAtCenter();
      if (!target || target.id === ctx.store.connectFromNodeId) {
        if (!target) ctx.store.exitConnect();
        return;
      }
      const fromNode = ctx.store.findNode(ctx.store.connectFromNodeId!);
      if (!fromNode) { ctx.store.exitConnect(); return; }
      const fromSide = ctx.store.connectFromSide ?? autoSides(fromNode, target).fromSide;
      const center = ctx.getCanvasCenter();
      const toSide = detectSide(target, center);
      const edgeId = ctx.store.addEdge(fromNode.id, fromSide, target.id, toSide);
      ctx.store.exitConnect();
      ctx.store.selectEdge(edgeId);
      ctx.startEdgeLabelEdit();
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

  // === SEARCH MODE ===
  { id: "search_next", mode: "search", label: "next", configKey: "normal.pan_down", hidden: true,
    available: always, execute: (ctx) => ctx.store.searchNext() },
  { id: "search_prev", mode: "search", label: "prev", configKey: "normal.pan_up", hidden: true,
    available: always, execute: (ctx) => ctx.store.searchPrev() },
  { id: "search_exit", mode: "search", label: "exit", configKey: "normal.deselect", hidden: true,
    available: always, execute: (ctx) => ctx.store.exitSearch() },

  // === VISUAL MODE ===
  ...directionalCommands("visual", "visual", "move", "visual_dir", "visual", "pan"),
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
    "connect_left_arrow": "ArrowLeft",
    "connect_right_arrow": "ArrowRight",
    "connect_up_arrow": "ArrowUp",
    "connect_down_arrow": "ArrowDown",
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
    const key = arrowAliases[cmd.id] ?? getCommandKey(cmd, config);
    for (const m of modes) {
      const mapKey = `${m}:${key}`;
      const existing = map.get(mapKey) ?? [];
      existing.push(cmd);
      map.set(mapKey, existing);
    }
  }
  return map;
}

/** Generate hint strings for the status bar using a plain snapshot */
export function getHints(config: Config, mode: Mode, snap: HintSnapshot): string[] {
  const seen = new Set<string>();
  const hints: string[] = [];

  for (const cmd of commands) {
    if (cmd.hidden) continue;
    const modes = Array.isArray(cmd.mode) ? cmd.mode : [cmd.mode];
    if (!modes.includes(mode)) continue;
    // Use per-command hintAvailable if defined, otherwise assume available
    if (cmd.hintAvailable && !cmd.hintAvailable(snap)) continue;

    const groupKey = cmd.group ?? cmd.id;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);

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
