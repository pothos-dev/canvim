export type Point = { x: number; y: number };
export type Side = "top" | "right" | "bottom" | "left";

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TextNode {
  type: "text";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  text: string;
}

export interface FileNode {
  type: "file";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  file: string;
  subpath?: string;
}

export interface LinkNode {
  type: "link";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  url: string;
}

export interface GroupNode {
  type: "group";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  label?: string;
  background?: string;
  backgroundStyle?: string;
}

export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode;

export interface Edge {
  id: string;
  fromNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  fromEnd?: "none" | "arrow";
  toNode: string;
  toSide?: "top" | "right" | "bottom" | "left";
  toEnd?: "none" | "arrow";
  color?: string;
  label?: string;
}

export interface Canvas {
  nodes: CanvasNode[];
  edges: Edge[];
}

export interface ConfigColors {
  background: string;
  node_background: string;
  node_border: string;
  edge: string;
  text: string;
  crosshair: string;
  dot_grid: string;
  status_bar_bg: string;
  status_bar_text: string;
  node_font: string;
  node_font_size: number;
  red: string;
  orange: string;
  yellow: string;
  green: string;
  cyan: string;
  purple: string;
}

export interface NormalKeybindings {
  pan_left: string;
  pan_right: string;
  pan_up: string;
  pan_down: string;
  zoom_in: string;
  zoom_out: string;
  add_node: string;
  select: string;
  insert: string;
  delete: string;
  deselect: string;
  quit: string;
  enter_move: string;
  enter_resize: string;
  connect: string;
  toggle_select: string;
  deselect_all: string;
  enter_visual: string;
  color_red: string;
  color_orange: string;
  color_yellow: string;
  color_green: string;
  color_cyan: string;
  color_purple: string;
  color_clear: string;
  yank: string;
  paste: string;
  undo: string;
  redo: string;
  search: string;
}

export interface DirectionalKeybindings {
  left: string;
  right: string;
  up: string;
  down: string;
  exit: string;
}

export interface ConnectKeybindings extends DirectionalKeybindings {
  confirm: string;
}

export interface InsertKeybindings {
  exit: string;
}

export interface VisualKeybindings extends DirectionalKeybindings {
  confirm: string;
}

export interface ConfigKeybindings {
  normal: NormalKeybindings;
  move: DirectionalKeybindings;
  resize: DirectionalKeybindings;
  connect: ConnectKeybindings;
  insert: InsertKeybindings;
  visual: VisualKeybindings;
}

export interface Config {
  colors: ConfigColors;
  keybindings: ConfigKeybindings;
}
