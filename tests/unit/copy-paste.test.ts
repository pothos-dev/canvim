import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

import { getStore } from "$lib/canvas-store.svelte";

describe("copy/paste (yank/put)", () => {
  let store: ReturnType<typeof getStore>;

  beforeEach(() => {
    store = getStore();
    while (store.canUndo) store.undo();
  });

  // This test MUST be first — clipboard is module-level and persists
  it("paste when clipboard empty does nothing", () => {
    expect(store.canPaste).toBe(false);
    const countBefore = store.nodes.length;
    store.paste(100, 100);
    expect(store.nodes.length).toBe(countBefore);
  });

  it("yank single node, paste creates new node with new ID", () => {
    store.addNode(100, 100);
    const nodeId = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();
    store.selectNode(nodeId);

    store.yankSelected();
    expect(store.canPaste).toBe(true);

    const countBefore = store.nodes.length;
    store.paste(200, 200);

    expect(store.nodes.length).toBe(countBefore + 1);
    const pasted = store.nodes[store.nodes.length - 1];
    expect(pasted.id).not.toBe(nodeId);
  });

  it("yank multi-select, paste copies all nodes", () => {
    store.addNode(0, 0);
    const id1 = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();
    store.addNode(200, 0);
    const id2 = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();

    store.selectNode(id1);
    store.toggleNodeSelection(id2);
    store.yankSelected();

    const countBefore = store.nodes.length;
    store.paste(400, 400);
    expect(store.nodes.length).toBe(countBefore + 2);
  });

  it("yank nodes with internal edges copies edges with remapped IDs", () => {
    store.addNode(0, 0);
    const id1 = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();
    store.addNode(200, 0);
    const id2 = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();

    store.addEdge(id1, "right", id2, "left");
    const edgesBefore = store.edges.length;

    store.selectNode(id1);
    store.toggleNodeSelection(id2);
    store.yankSelected();
    store.paste(500, 500);

    expect(store.edges.length).toBe(edgesBefore + 1);
    const newEdge = store.edges[store.edges.length - 1];
    expect(newEdge.fromNode).not.toBe(id1);
    expect(newEdge.toNode).not.toBe(id2);
    // The remapped IDs should point to the pasted nodes
    const pastedIds = store.selectedNodeIds;
    expect(pastedIds).toContain(newEdge.fromNode);
    expect(pastedIds).toContain(newEdge.toNode);
  });

  it("yank nodes with external edges does NOT copy external edges", () => {
    store.addNode(0, 0);
    const id1 = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();
    store.addNode(200, 0);
    const id2 = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();
    store.addNode(400, 0);
    const id3 = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();

    store.addEdge(id1, "right", id2, "left");
    store.addEdge(id2, "right", id3, "left"); // external to selection

    // Only select id1 and id2
    store.selectNode(id1);
    store.toggleNodeSelection(id2);
    store.yankSelected();

    const edgesBefore = store.edges.length;
    store.paste(500, 500);
    // Only the internal edge (id1→id2) should be copied, not id2→id3
    expect(store.edges.length).toBe(edgesBefore + 1);
  });

  it("paste pushes undo snapshot", () => {
    store.addNode(100, 100);
    const nodeId = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();
    store.selectNode(nodeId);
    store.yankSelected();

    const countBefore = store.nodes.length;
    store.paste(200, 200);
    expect(store.nodes.length).toBe(countBefore + 1);

    store.undo();
    expect(store.nodes.length).toBe(countBefore);
  });

  it("pasted nodes are selected", () => {
    store.addNode(100, 100);
    const nodeId = store.nodes[store.nodes.length - 1].id;
    store.exitInsert();
    store.selectNode(nodeId);
    store.yankSelected();

    store.paste(300, 300);
    expect(store.selectedNodeIds.length).toBe(1);
    expect(store.selectedNodeIds[0]).not.toBe(nodeId);
  });
});
