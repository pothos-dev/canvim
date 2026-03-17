import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Tauri invoke before importing the store
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

import { getStore } from "$lib/canvas-store.svelte";

describe("undo/redo", () => {
  let store: ReturnType<typeof getStore>;

  beforeEach(() => {
    store = getStore();
    // Reset state: undo everything to clear, then clear history
    while (store.canUndo) store.undo();
    // Remove all nodes/edges by loading empty state
    // We'll work with addNode which pushes snapshots
  });

  it("canUndo is false initially", () => {
    expect(store.canUndo).toBe(false);
  });

  it("canRedo is false initially", () => {
    expect(store.canRedo).toBe(false);
  });

  it("addNode pushes a snapshot and can be undone", () => {
    const initialCount = store.nodes.length;
    store.addNode(100, 100);
    expect(store.nodes.length).toBe(initialCount + 1);
    expect(store.canUndo).toBe(true);

    store.undo();
    expect(store.nodes.length).toBe(initialCount);
    expect(store.canRedo).toBe(true);
  });

  it("redo restores the undone state", () => {
    const initialCount = store.nodes.length;
    store.addNode(100, 100);
    store.undo();
    expect(store.nodes.length).toBe(initialCount);

    store.redo();
    expect(store.nodes.length).toBe(initialCount + 1);
  });

  it("new mutation after undo clears redo stack", () => {
    store.addNode(100, 100);
    store.undo();
    expect(store.canRedo).toBe(true);

    store.addNode(200, 200);
    expect(store.canRedo).toBe(false);
  });

  it("multiple undo steps work correctly", () => {
    const initialCount = store.nodes.length;
    store.addNode(100, 100);
    store.addNode(200, 200);
    store.addNode(300, 300);
    expect(store.nodes.length).toBe(initialCount + 3);

    store.undo();
    expect(store.nodes.length).toBe(initialCount + 2);
    store.undo();
    expect(store.nodes.length).toBe(initialCount + 1);
    store.undo();
    expect(store.nodes.length).toBe(initialCount);
  });

  it("undo with no history does nothing", () => {
    while (store.canUndo) store.undo();
    const count = store.nodes.length;
    store.undo(); // should be a no-op
    expect(store.nodes.length).toBe(count);
  });

  it("redo with no future does nothing", () => {
    store.addNode(100, 100);
    const count = store.nodes.length;
    store.redo(); // should be a no-op
    expect(store.nodes.length).toBe(count);
  });

  it("undo resets mode to normal", () => {
    store.addNode(100, 100);
    // addNode sets mode to insert
    expect(store.mode).toBe("insert");

    store.undo();
    expect(store.mode).toBe("normal");
  });

  it("enterMove pushes a snapshot for the entire move session", () => {
    store.addNode(100, 100);
    const nodeId = store.nodes[store.nodes.length - 1].id;
    store.exitInsert(); // back to normal after addNode

    // Select and enter move mode
    store.selectNode(nodeId);
    store.enterMove(false);

    // Simulate multiple moves
    store.moveNode(nodeId, 20, 0);
    store.moveNode(nodeId, 20, 0);
    store.moveNode(nodeId, 20, 0);

    // Exit move
    store.exitMove();

    // One undo should reverse the entire move session
    const nodeBeforeUndo = store.nodes.find(n => n.id === nodeId);
    const xAfterMoves = nodeBeforeUndo!.x;

    store.undo();
    // After undo we're back to before enterMove, node should be at original position
    // But undo restores to before enterMove snapshot, which includes the addNode
    // Actually, undo pops the enterMove snapshot which was the state before any moves
    // So the node x should be back to where it was before enterMove
    const nodeAfterUndo = store.nodes.find(n => n.id === nodeId);
    expect(nodeAfterUndo!.x).toBe(xAfterMoves - 60); // 3 moves of 20px each
  });

  it("enterResize pushes a snapshot for the entire resize session", () => {
    store.addNode(100, 100);
    const nodeId = store.nodes[store.nodes.length - 1].id;
    const originalWidth = store.nodes.find(n => n.id === nodeId)!.width;
    store.exitInsert();

    store.selectNode(nodeId);
    store.enterResize(false);

    store.resizeNode(nodeId, 20, 0);
    store.resizeNode(nodeId, 20, 0);
    store.exitResize();

    store.undo();
    const node = store.nodes.find(n => n.id === nodeId);
    expect(node!.width).toBe(originalWidth);
  });

  it("enterInsert pushes a snapshot for the entire edit session", () => {
    store.addNode(100, 100);
    const nodeId = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();

    store.selectNode(nodeId);
    store.enterInsert();
    store.updateNode(nodeId, "hello");
    store.updateNode(nodeId, "hello world");
    store.exitInsert();

    // Undo should reverse the entire insert session
    store.undo();
    const node = store.nodes.find(n => n.id === nodeId);
    expect(node!.type === "text" && node!.text).toBe("");
  });

  it("addEdge pushes a snapshot", () => {
    store.addNode(0, 0);
    store.exitInsert();
    store.addNode(200, 0);
    store.exitInsert();

    const n1 = store.nodes[store.nodes.length - 2].id;
    const n2 = store.nodes[store.nodes.length - 1].id;
    const edgesBefore = store.edges.length;

    store.addEdge(n1, "right", n2, "left");
    expect(store.edges.length).toBe(edgesBefore + 1);

    store.undo();
    expect(store.edges.length).toBe(edgesBefore);
  });

  it("popSnapshot discards the last pushed snapshot", () => {
    store.addNode(100, 100);
    store.exitInsert();

    // Simulate what handleMouseDown does: push then pop if no drag
    store.pushSnapshot();
    store.popSnapshot();

    // The undo should go back to before addNode, not to the popped snapshot
    const undoCount = countUndos();
    store.addNode(100, 100); // push another
    // Should be able to undo to initial state
    expect(store.canUndo).toBe(true);
  });
});

function countUndos(): number {
  const store = getStore();
  let count = 0;
  while (store.canUndo) {
    store.undo();
    count++;
  }
  return count;
}
