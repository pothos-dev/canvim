export const UI_COLORS = {
  // Mode indicators
  mode_normal: "#7aa2f7",
  mode_insert: "#9ece6a",
  mode_connect: "#f7768e",
  mode_resize: "#e9973f",
  mode_move: "#e0de71",
  mode_search: "#bb9af7",
  mode_visual: "#ff9e64",

  // Selection & interaction
  selected: "#7aa2f7",
  selected_shadow: "rgba(122, 162, 247, 0.2)",
  selected_hover_shadow: "rgba(122, 162, 247, 0.3)",
  hover_shadow: "rgba(0, 0, 0, 0.4)",
  editing_shadow: "rgba(0, 0, 0, 0.5)",
  editing_border: "rgba(255, 255, 255, 0.15)",
  connect_source: "rgba(247, 118, 142, 0.5)",
  connect_target: "rgba(247, 118, 142, 0.6)",
  connect_color: "#f7768e",

  // Search
  search_match: "rgba(230, 180, 50, 0.4)",
  selection_bg: "rgba(122, 162, 247, 0.25)",
  selection_bg_focused: "rgba(122, 162, 247, 0.35)",

  // Misc UI
  group_bg: "rgba(255,255,255,0.03)",
  code_bg: "rgba(255, 255, 255, 0.06)",
  subtle_border: "rgba(255, 255, 255, 0.1)",

  // Loading page (before config is available)
  loading_bg: "#171717",
  loading_text: "#d4d4d4",
  error_text: "#f38ba8",
} as const;

export const STEP = 20;
export const ZOOM_STEP = 0.15;
export const BORDER_ZONE = 8;
export const EDGE_HIT_THRESHOLD = 24;
export const COLOR_PRESETS = ["red", "orange", "yellow", "green", "cyan", "purple"] as const;
export const PAN_ACCEL_MAX = 4;
export const PAN_ACCEL_RAMP = 16;
