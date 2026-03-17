import { describe, it, expect, beforeEach, vi } from "vitest";
import type { getStore } from "$lib/canvas-store.svelte";

// Mock @tauri-apps/api/core — all invoke calls resolve to sensible defaults
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
            undo: "u", redo: "C-r",
          },
          move: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
          resize: { left: "h", right: "l", up: "k", down: "j", exit: "Escape" },
          connect: { left: "h", right: "l", up: "k", down: "j", confirm: "Enter", exit: "Escape" },
          insert: { exit: "Escape" },
        },
      },
      file_path: null,
    };
    if (cmd === "get_config") return {
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
          color_red: "1", color_orange: "2", color_yellow: "3", color_green: "4",
          color_cyan: "5", color_purple: "6", color_clear: "0",
          modifiers: { move_node: "Shift", resize_node: "Ctrl" },
        },
        insert: { exit: "Escape" },
      },
    };
    if (cmd === "read_canvas") return {
      nodes: [
        { type: "text", id: "node1", x: 0, y: 0, width: 200, height: 100, text: "Hello" },
        { type: "text", id: "node2", x: 300, y: 0, width: 200, height: 100, text: "World" },
      ],
      edges: [
        { id: "edge1", fromNode: "node1", fromSide: "right", toNode: "node2", toSide: "left", toEnd: "arrow" },
      ],
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
});

describe("canvas-store", () => {
  describe("initial state", () => {
    it("starts with empty nodes and edges", () => {
      expect(store.nodes).toEqual([]);
      expect(store.edges).toEqual([]);
    });

    it("starts in normal mode", () => {
      expect(store.mode).toBe("normal");
    });

    it("starts with default viewport", () => {
      expect(store.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it("starts with no selection", () => {
      expect(store.selectedNodeId).toBeNull();
    });
  });

  describe("addNode", () => {
    it("creates a node centered at the given position", () => {
      store.addNode(100, 50);
      expect(store.nodes).toHaveLength(1);
      const node = store.nodes[0];
      // Node is centered: x = 100-125 = -25, y = 50-50 = 0
      expect(node.x).toBe(-25);
      expect(node.y).toBe(0);
      expect(node.width).toBe(250);
      expect(node.height).toBe(100);
    });

    it("generates a unique id", () => {
      store.addNode(0, 0);
      expect(store.nodes[0].id).toBeTruthy();
      expect(store.nodes[0].id.length).toBe(16);
    });

    it("selects the new node and enters insert mode", () => {
      store.addNode(0, 0);
      expect(store.selectedNodeId).toBe(store.nodes[0].id);
      expect(store.mode).toBe("insert");
    });

    it("creates a text node with empty text", () => {
      store.addNode(0, 0);
      const node = store.nodes[0];
      expect(node.type).toBe("text");
      if (node.type === "text") expect(node.text).toBe("");
    });
  });

  describe("removeNode", () => {
    it("removes the node by id", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.exitInsert();
      store.removeNode(id);
      expect(store.nodes).toHaveLength(0);
    });

    it("removes associated edges", () => {
      store.addNode(0, 0);
      const id1 = store.nodes[0].id;
      store.exitInsert();
      store.addNode(300, 0);
      const id2 = store.nodes[1].id;
      store.exitInsert();
      store.addEdge(id1, "right", id2, "left");
      expect(store.edges).toHaveLength(1);
      store.removeNode(id1);
      expect(store.edges).toHaveLength(0);
    });

    it("clears selection if removed node was selected", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      // addNode auto-selects
      expect(store.selectedNodeId).toBe(id);
      store.removeNode(id);
      expect(store.selectedNodeId).toBeNull();
    });

    it("does nothing for nonexistent id", () => {
      store.addNode(0, 0);
      store.removeNode("nonexistent");
      expect(store.nodes).toHaveLength(1);
    });
  });

  describe("moveNode", () => {
    it("moves node by delta", () => {
      store.addNode(100, 100);
      const id = store.nodes[0].id;
      const origX = store.nodes[0].x;
      const origY = store.nodes[0].y;
      store.moveNode(id, 20, -40);
      expect(store.nodes[0].x).toBe(origX + 20);
      expect(store.nodes[0].y).toBe(origY - 40);
    });
  });

  describe("resizeNode", () => {
    it("resizes node by delta", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.resizeNode(id, 50, 30);
      expect(store.nodes[0].width).toBe(300);
      expect(store.nodes[0].height).toBe(130);
    });

    it("enforces minimum width of 50", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.resizeNode(id, -500, 0);
      expect(store.nodes[0].width).toBe(50);
    });

    it("enforces minimum height of 30", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.resizeNode(id, 0, -500);
      expect(store.nodes[0].height).toBe(30);
    });
  });

  describe("setNodeColor", () => {
    it("sets color on a node", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.setNodeColor(id, "1");
      expect(store.nodes[0].color).toBe("1");
    });

    it("clears color with empty string", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.setNodeColor(id, "3");
      store.setNodeColor(id, "");
      expect(store.nodes[0].color).toBe("");
    });
  });

  describe("selection", () => {
    it("selectNode sets selectedNodeId", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.exitInsert();
      store.deselectAll();
      expect(store.selectedNodeId).toBeNull();
      store.selectNode(id);
      expect(store.selectedNodeId).toBe(id);
    });

    it("deselect clears selection", () => {
      store.addNode(0, 0);
      store.deselectAll();
      expect(store.selectedNodeId).toBeNull();
    });
  });

  describe("mode transitions", () => {
    it("enterInsert requires a selected node", () => {
      store.enterInsert();
      expect(store.mode).toBe("normal");
    });

    it("enterInsert switches to insert mode when node selected", () => {
      store.addNode(0, 0);
      store.exitInsert(); // addNode enters insert
      expect(store.mode).toBe("normal");
      store.enterInsert();
      expect(store.mode).toBe("insert");
    });

    it("exitInsert returns to normal mode", () => {
      store.addNode(0, 0); // enters insert
      expect(store.mode).toBe("insert");
      store.exitInsert();
      expect(store.mode).toBe("normal");
    });

    it("enterConnect sets connect mode and source node", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.exitInsert();
      store.enterConnect(id);
      expect(store.mode).toBe("connect");
      expect(store.connectFromNodeId).toBe(id);
      expect(store.connectFromSide).toBeNull();
    });

    it("exitConnect returns to normal and clears connect state", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.exitInsert();
      store.enterConnect(id);
      store.setConnectFromSide("right");
      store.exitConnect();
      expect(store.mode).toBe("normal");
      expect(store.connectFromNodeId).toBeNull();
      expect(store.connectFromSide).toBeNull();
    });

    it("setConnectFromSide stores the side", () => {
      store.addNode(0, 0);
      store.exitInsert();
      store.enterConnect(store.nodes[0].id);
      store.setConnectFromSide("bottom");
      expect(store.connectFromSide).toBe("bottom");
    });
  });

  describe("addEdge", () => {
    it("creates an edge between two nodes", () => {
      store.addNode(0, 0);
      const id1 = store.nodes[0].id;
      store.exitInsert();
      store.addNode(300, 0);
      const id2 = store.nodes[1].id;
      store.exitInsert();

      store.addEdge(id1, "right", id2, "left");
      expect(store.edges).toHaveLength(1);
      expect(store.edges[0].fromNode).toBe(id1);
      expect(store.edges[0].fromSide).toBe("right");
      expect(store.edges[0].toNode).toBe(id2);
      expect(store.edges[0].toSide).toBe("left");
      expect(store.edges[0].toEnd).toBe("arrow");
    });

    it("generates a unique edge id", () => {
      store.addNode(0, 0);
      store.exitInsert();
      store.addNode(300, 0);
      store.exitInsert();
      store.addEdge(store.nodes[0].id, "right", store.nodes[1].id, "left");
      expect(store.edges[0].id).toBeTruthy();
      expect(store.edges[0].id.length).toBe(16);
    });
  });

  describe("viewport", () => {
    it("pan adjusts viewport position", () => {
      store.pan(50, -30);
      expect(store.viewport.x).toBe(50);
      expect(store.viewport.y).toBe(-30);
    });

    it("pan accumulates", () => {
      store.pan(10, 20);
      store.pan(30, -5);
      expect(store.viewport.x).toBe(40);
      expect(store.viewport.y).toBe(15);
    });

    it("zoom adjusts viewport zoom", () => {
      store.zoom(0.5);
      expect(store.viewport.zoom).toBe(1.5);
    });

    it("zoom clamps to min 0.1", () => {
      store.zoom(-5);
      expect(store.viewport.zoom).toBe(0.1);
    });

    it("zoom clamps to max 5", () => {
      store.zoom(10);
      expect(store.viewport.zoom).toBe(5);
    });

    it("centerOn sets viewport to center on a point", () => {
      store.centerOn(100, 200);
      expect(store.viewport.x).toBe(-100);
      expect(store.viewport.y).toBe(-200);
    });

    it("centerOn accounts for zoom level", () => {
      store.zoom(1); // zoom = 2
      store.centerOn(100, 200);
      expect(store.viewport.x).toBe(-200);
      expect(store.viewport.y).toBe(-400);
    });
  });

  describe("load", () => {
    it("loads nodes and edges from invoke", async () => {
      await store.load("/test.canvas");
      expect(store.nodes).toHaveLength(2);
      expect(store.edges).toHaveLength(1);
      expect(store.filePath).toBe("/test.canvas");
    });

    it("sets filePath", async () => {
      await store.load("/my/canvas.canvas");
      expect(store.filePath).toBe("/my/canvas.canvas");
    });
  });

  describe("init", () => {
    it("loads config from invoke", async () => {
      await store.init();
      expect(store.config).toBeTruthy();
      expect(store.config!.colors.background).toBe("#181825");
      expect(store.config!.keybindings.normal.pan_left).toBe("h");
    });
  });

  describe("resolveColor", () => {
    it("returns undefined for empty preset", async () => {
      await store.init();
      expect(store.resolveColor("")).toBeUndefined();
      expect(store.resolveColor(undefined)).toBeUndefined();
    });

    it("maps preset numbers to config colors", async () => {
      await store.init();
      expect(store.resolveColor("1")).toBe("#fb464c");
      expect(store.resolveColor("2")).toBe("#e9973f");
      expect(store.resolveColor("3")).toBe("#e0de71");
      expect(store.resolveColor("4")).toBe("#44cf6e");
      expect(store.resolveColor("5")).toBe("#53dfdd");
      expect(store.resolveColor("6")).toBe("#a882ff");
    });

    it("returns unknown presets as-is", async () => {
      await store.init();
      expect(store.resolveColor("#ff0000")).toBe("#ff0000");
    });
  });

  describe("save", () => {
    it("calls invoke with correct data", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      await store.load("/test.canvas");
      vi.mocked(invoke).mockClear();

      await store.save();
      expect(invoke).toHaveBeenCalledWith("save_canvas", {
        path: "/test.canvas",
        data: { nodes: store.nodes, edges: store.edges },
      });
    });

    it("does nothing without a filePath", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      vi.mocked(invoke).mockClear();

      await store.save();
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe("updateNode", () => {
    it("updates text content of a text node", () => {
      store.addNode(0, 0);
      const id = store.nodes[0].id;
      store.updateNode(id, "new content");
      const node = store.nodes[0];
      if (node.type === "text") {
        expect(node.text).toBe("new content");
      }
    });

    it("does nothing for nonexistent node", () => {
      store.addNode(0, 0);
      store.updateNode("nonexistent", "text");
      expect(store.nodes).toHaveLength(1);
    });
  });
});
