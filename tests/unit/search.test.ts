import { describe, it, expect, beforeEach, vi } from "vitest";
import type { getStore } from "$lib/canvas-store.svelte";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === "save_canvas") return;
    if (cmd === "init") return {
      config: {
        colors: {
          background: "#181825", node_background: "#1e1e1e", node_border: "#555555",
          edge: "#585b70", text: "#cdd6f4", crosshair: "rgba(205,214,244,0.3)",
          dot_grid: "rgba(205,214,244,0.08)", status_bar_bg: "#11111b",
          status_bar_text: "#6c7086", node_font: "system-ui", node_font_size: 14,
          red: "#fb464c", orange: "#e9973f", yellow: "#e0de71",
          green: "#44cf6e", cyan: "#53dfdd", purple: "#a882ff",
        },
        keybindings: {
          normal: {
            pan_left: "h", pan_right: "l", pan_up: "k", pan_down: "j",
            zoom_in: "+", zoom_out: "-", add_node: "a", select: "Enter",
            insert: "i", delete: "d", deselect: "Escape", quit: "q",
            enter_move: "m", enter_resize: "r", connect: "c",
            toggle_select: "v", deselect_all: "V",
            color_red: "1", color_orange: "2", color_yellow: "3", color_green: "4",
            color_cyan: "5", color_purple: "6", color_clear: "0",
            yank: "y", paste: "p", undo: "u", redo: "C-r", search: "/",
          },
          move: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
          resize: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
          connect: { left: "h", right: "l", up: "k", down: "j", confirm: "Enter", exit: "Escape" },
          insert: { exit: "Escape" },
        },
      },
      file_path: null,
    };
    if (cmd === "read_canvas") return {
      nodes: [
        { type: "text", id: "n1", x: 0, y: 0, width: 200, height: 100, text: "Hello world" },
        { type: "text", id: "n2", x: 300, y: 0, width: 200, height: 100, text: "Goodbye world" },
        { type: "text", id: "n3", x: 600, y: 0, width: 200, height: 100, text: "Something else" },
        { type: "file", id: "n4", x: 0, y: 200, width: 200, height: 100, file: "path/to/hello.md" },
        { type: "link", id: "n5", x: 300, y: 200, width: 200, height: 100, url: "https://hello.example.com" },
        { type: "group", id: "n6", x: 0, y: 400, width: 400, height: 300, label: "Hello Group" },
      ],
      edges: [],
    };
    return null;
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ close: vi.fn() }),
}));

type Store = ReturnType<typeof getStore>;
let store: Store;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  const mod = await import("$lib/canvas-store.svelte");
  store = mod.getStore();
  await store.init();
  await store.load("test.canvas");
});

describe("search", () => {
  it("enterSearch sets mode to search", () => {
    store.enterSearch();
    expect(store.mode).toBe("search");
    expect(store.searchQuery).toBe("");
    expect(store.searchMatchIds).toEqual([]);
  });

  it("setSearchQuery finds matching nodes (case-insensitive)", () => {
    store.enterSearch();
    store.setSearchQuery("hello");
    // n1 "Hello world", n4 "path/to/hello.md", n5 "https://hello.example.com", n6 "Hello Group"
    expect(store.searchMatchIds).toContain("n1");
    expect(store.searchMatchIds).toContain("n4");
    expect(store.searchMatchIds).toContain("n5");
    expect(store.searchMatchIds).toContain("n6");
    expect(store.searchMatchIds).not.toContain("n2");
    expect(store.searchMatchIds).not.toContain("n3");
  });

  it("empty query matches nothing", () => {
    store.enterSearch();
    store.setSearchQuery("hello");
    expect(store.searchMatchIds.length).toBeGreaterThan(0);
    store.setSearchQuery("");
    expect(store.searchMatchIds).toEqual([]);
  });

  it("searchNext cycles through matches wrapping", () => {
    store.enterSearch();
    store.setSearchQuery("world");
    expect(store.searchMatchIds).toEqual(["n1", "n2"]);
    expect(store.searchCurrentIndex).toBe(0);

    store.searchNext();
    expect(store.searchCurrentIndex).toBe(1);

    store.searchNext();
    expect(store.searchCurrentIndex).toBe(0); // wraps
  });

  it("searchPrev cycles through matches wrapping", () => {
    store.enterSearch();
    store.setSearchQuery("world");
    expect(store.searchCurrentIndex).toBe(0);

    store.searchPrev();
    expect(store.searchCurrentIndex).toBe(1); // wraps to end

    store.searchPrev();
    expect(store.searchCurrentIndex).toBe(0);
  });

  it("confirmSearch selects current match", () => {
    store.enterSearch();
    store.setSearchQuery("world");
    store.searchNext(); // index 1 = n2
    store.confirmSearch();
    expect(store.selectedNodeId).toBe("n2");
    expect(store.searchConfirmed).toBe(true);
  });

  it("exitSearch clears state and returns to normal", () => {
    store.enterSearch();
    store.setSearchQuery("hello");
    store.exitSearch();
    expect(store.mode).toBe("normal");
    expect(store.searchQuery).toBe("");
    expect(store.searchMatchIds).toEqual([]);
    expect(store.searchCurrentIndex).toBe(0);
  });

  it("no-op searchNext/searchPrev with no matches", () => {
    store.enterSearch();
    store.setSearchQuery("zzzznonexistent");
    expect(store.searchMatchIds).toEqual([]);
    store.searchNext();
    store.searchPrev();
    expect(store.searchCurrentIndex).toBe(0);
  });

  it("matches substring in group label", () => {
    store.enterSearch();
    store.setSearchQuery("Group");
    expect(store.searchMatchIds).toContain("n6");
  });
});
