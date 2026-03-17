import { describe, it, expect } from "vitest";
import { buildKeyMap } from "$lib/commands";
import type { Config } from "$lib/types";

const DEFAULT_CONFIG: Config = {
  colors: {
    background: "#181825",
    node_background: "#1e1e1e",
    node_border: "#555555",
    edge: "#585b70",
    text: "#cdd6f4",
    crosshair: "rgba(205, 214, 244, 0.3)",
    dot_grid: "rgba(205, 214, 244, 0.08)",
    status_bar_bg: "#11111b",
    status_bar_text: "#6c7086",
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
      color_red: "1",
      color_orange: "2",
      color_yellow: "3",
      color_green: "4",
      color_cyan: "5",
      color_purple: "6",
      color_clear: "0",
      undo: "u",
      redo: "C-r",
    },
    move: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
    resize: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
    connect: { left: "h", right: "l", up: "k", down: "j", confirm: "Enter", exit: "Escape" },
    insert: { exit: "Escape" },
  },
};

describe("buildKeyMap", () => {
  it("maps undo key 'u' to normal:u", () => {
    const map = buildKeyMap(DEFAULT_CONFIG);
    const cmds = map.get("normal:u");
    expect(cmds).toBeDefined();
    expect(cmds!.some(c => c.id === "undo")).toBe(true);
  });

  it("maps redo key 'C-r' to normal:C-r", () => {
    const map = buildKeyMap(DEFAULT_CONFIG);
    const cmds = map.get("normal:C-r");
    expect(cmds).toBeDefined();
    expect(cmds!.some(c => c.id === "redo")).toBe(true);
  });

  it("does not map redo to normal:r (without Ctrl)", () => {
    const map = buildKeyMap(DEFAULT_CONFIG);
    const cmds = map.get("normal:r");
    // 'r' should be enter_resize, not redo
    if (cmds) {
      expect(cmds.every(c => c.id !== "redo")).toBe(true);
    }
  });
});
