<script lang="ts">
  import { onMount } from "svelte";
  import NodeComponent from "./Node.svelte";
  import EdgeComponent from "./Edge.svelte";
  import type { CanvasNode, Edge, Point, Side } from "./types";
  import { getStore } from "./canvas-store.svelte";
  import { buildKeyMap, getHints, type CommandContext, type HintSnapshot } from "./commands";
  import { STEP, ZOOM_STEP, BORDER_ZONE, EDGE_HIT_THRESHOLD, UI_COLORS } from "./constants";
  import { marked } from "./markdown";
  import { pointInNode, attachmentPoint, detectSide, autoSides, distToBezier } from "./geometry";

  const store = getStore();

  type DragType = "move" | "resize" | "pan" | "visual";
  type ResizeEdge = { left: boolean; right: boolean; top: boolean; bottom: boolean };

  type DragNodeStart = { id: string; startX: number; startY: number; startW: number; startH: number };

  let dragging = $state<{
    type: DragType;
    startMouseX: number;
    startMouseY: number;
    nodes: DragNodeStart[];
    resizeEdge?: ResizeEdge;
    startViewportX: number;
    startViewportY: number;
    tempSelected: boolean;
  } | null>(null);
  let didDrag = false; // true if a drag actually moved/resized
  let mouseVisualEnd = $state<{ x: number; y: number } | null>(null);

  // Input mode: determines which cursor is visible and how "under cursor" is resolved
  type InputMode = "mouse" | "keyboard";
  let inputMode = $state<InputMode>("keyboard");
  let mouseCanvasPos = $state<Point>({ x: 0, y: 0 });

  // Command system
  const commandKeyMap = $derived(store.config ? buildKeyMap(store.config) : new Map());

  // Pan acceleration: holding a direction key ramps up the multiplier
  const PAN_ACCEL_MAX = 4;
  const PAN_ACCEL_RAMP = 16; // repeats to reach max
  let panRepeatKey = "";
  let panRepeatCount = 0;

  function getPanMultiplier(key: string, isRepeat: boolean): number {
    if (!isRepeat) {
      panRepeatKey = key;
      panRepeatCount = 0;
      return 1;
    }
    if (key !== panRepeatKey) {
      panRepeatKey = key;
      panRepeatCount = 0;
      return 1;
    }
    panRepeatCount++;
    const t = Math.min(panRepeatCount / PAN_ACCEL_RAMP, 1);
    return Math.round(1 + t * (PAN_ACCEL_MAX - 1));
  }

  function resetPanAccel() {
    panRepeatKey = "";
    panRepeatCount = 0;
  }

  function getCanvasCenter(): Point {
    return {
      x: -store.viewport.x / store.viewport.zoom,
      y: -store.viewport.y / store.viewport.zoom,
    };
  }

  /** The active cursor point: mouse position in mouse mode, screen center in keyboard mode */
  const cursorPoint = $derived(inputMode === "mouse" ? mouseCanvasPos : getCanvasCenter());

  function getNodeAtCenter() {
    const center = getCanvasCenter();
    // Prefer non-group nodes over group nodes
    const nonGroup = store.nodes.find((n) => n.type !== "group" && pointInNode(n, center));
    if (nonGroup) return nonGroup;
    return store.nodes.find((n) => pointInNode(n, center));
  }

  // Track when cursor leaves fromNode to detect fromSide
  let wasInsideFromNode = false;

  $effect(() => {
    if (store.mode !== "connect" || !store.connectFromNodeId) {
      wasInsideFromNode = false;
      return;
    }
    const fromNode = store.nodes.find(n => n.id === store.connectFromNodeId);
    if (!fromNode) return;
    const center = getCanvasCenter();
    const inside = pointInNode(fromNode, center);
    if (wasInsideFromNode && !inside) {
      store.setConnectFromSide(detectSide(fromNode, center));
    }
    wasInsideFromNode = inside;
  });

  function addNodeAtCenter() {
    const center = getCanvasCenter();
    store.addNode(center.x, center.y);
  }

  function getNodeDisplayText(node: CanvasNode): string {
    if (node.type === "text") return node.text;
    if (node.type === "file") return node.file;
    if (node.type === "link") return node.url;
    if (node.type === "group") return node.label ?? "Group";
    return "";
  }

  function fitNodesToContent() {
    const ids = store.selectedNodeIds;
    if (ids.length === 0) return;

    const fontFamily = colors.node_font;
    const fontSize = colors.node_font_size;

    // Create off-screen measurement div
    const measure = document.createElement("div");
    measure.style.cssText = `
      position: absolute; left: -9999px; top: -9999px;
      font-family: ${fontFamily}; font-size: ${fontSize}px;
      line-height: 1.5; padding: 8px 12px;
      box-sizing: border-box; border: 2px solid transparent;
    `;
    document.body.appendChild(measure);

    store.pushSnapshot();
    for (const id of ids) {
      const node = store.nodes.find(n => n.id === id);
      if (!node) continue;
      measure.style.width = `${node.width}px`;
      const html = marked.parse(getNodeDisplayText(node), { async: false }) as string;
      measure.innerHTML = html;
      const height = Math.ceil(measure.scrollHeight / STEP) * STEP;
      store.setNodeSize(id, node.width, height);
    }
    document.body.removeChild(measure);
  }

  function distToEdge(edge: Edge, point: Point): number {
    const fromNode = store.nodes.find(n => n.id === edge.fromNode);
    const toNode = store.nodes.find(n => n.id === edge.toNode);
    if (!fromNode || !toNode) return Infinity;

    const auto = autoSides(fromNode, toNode);
    const fromSide = (edge.fromSide as Side | undefined) ?? auto.fromSide;
    const toSide = (edge.toSide as Side | undefined) ?? auto.toSide;

    const p0 = attachmentPoint(fromNode, fromSide);
    const p3 = attachmentPoint(toNode, toSide);
    return distToBezier(p0, p3, fromSide, toSide, point);
  }

  function getEdgeNear(point: Point): Edge | undefined {
    let best: Edge | undefined;
    let bestDist = EDGE_HIT_THRESHOLD;
    for (const edge of store.edges) {
      const d = distToEdge(edge, point);
      if (d < bestDist) {
        bestDist = d;
        best = edge;
      }
    }
    return best;
  }

  let editingEdgeLabel = $state(false);
  let edgeLabelValue = $state("");
  let edgeLabelInputEl: HTMLInputElement | undefined = $state();

  function startEdgeLabelEdit() {
    const edgeId = store.selectedEdgeId;
    if (!edgeId) return;
    const edge = store.edges.find(e => e.id === edgeId);
    edgeLabelValue = edge?.label ?? "";
    editingEdgeLabel = true;
    store.enterInsert();
    // Focus after DOM update
    requestAnimationFrame(() => edgeLabelInputEl?.focus());
  }

  function finishEdgeLabelEdit() {
    if (store.selectedEdgeId) {
      store.updateEdgeLabel(store.selectedEdgeId, edgeLabelValue);
    }
    editingEdgeLabel = false;
    store.exitInsert();
  }

  // Priority: non-group node > edge > group node
  // Uses cursorPoint which follows mouse in mouse mode, screen center in keyboard mode
  const nonGroupNodeUnderCursor = $derived.by(() => {
    const p = cursorPoint;
    return store.nodes.find((n) => n.type !== "group" && pointInNode(n, p));
  });
  const edgeUnderCursor = $derived(nonGroupNodeUnderCursor ? undefined : getEdgeNear(cursorPoint));
  const nodeUnderCursor = $derived(nonGroupNodeUnderCursor ?? (edgeUnderCursor ? undefined : (() => {
    const p = cursorPoint;
    return store.nodes.find((n) => pointInNode(n, p));
  })()));

  // Nodes fully enclosed by the visual selection rectangle
  const visualEnclosedIds = $derived.by(() => {
    if (store.mode !== "visual" || !store.visualOrigin) return new Set<string>();
    const end = mouseVisualEnd ?? getCanvasCenter();
    const minX = Math.min(store.visualOrigin.x, end.x);
    const minY = Math.min(store.visualOrigin.y, end.y);
    const maxX = Math.max(store.visualOrigin.x, end.x);
    const maxY = Math.max(store.visualOrigin.y, end.y);
    const ids = new Set<string>();
    for (const n of store.nodes) {
      if (n.x >= minX && n.y >= minY && n.x + n.width <= maxX && n.y + n.height <= maxY) {
        ids.add(n.id);
      }
    }
    return ids;
  });

  function makeCommandContext(panMultiplier = 1): CommandContext {
    return {
      store,
      config: store.config!,
      nodeUnderCursor,
      edgeUnderCursor,
      addNodeAtCenter,
      startEdgeLabelEdit,
      finishEdgeLabelEdit,
      editingEdgeLabel,
      hideCursor: () => { inputMode = "keyboard"; },
      getNodeAtCenter,
      getCanvasCenter,
      fitNodesToContent,
      panMultiplier,
    };
  }

  const hints = $derived.by(() => {
    if (!store.config) return [];
    // Use plain snapshot values to avoid reactive proxy reads in available() checks
    const snap: HintSnapshot = {
      hasNode: !!nodeUnderCursor,
      hasEdge: !!edgeUnderCursor,
      selectedCount: store.selectedNodeIds.length,
    };
    return getHints(store.config, store.mode, snap);
  });

  function handleKeydown(e: KeyboardEvent) {
    // Prevent browser defaults on Ctrl+key combos we handle
    if (e.key === "Tab") {
      e.preventDefault();
    }
    if (e.ctrlKey && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0" || e.key === "r" || e.key === "c" || e.key === "v" || e.key === "f")) {
      e.preventDefault();
    }

    if (!store.config) return;

    const prefix = e.ctrlKey ? "C-" : e.shiftKey && e.key !== e.key.toUpperCase() ? "S-" : "";
    const mapKey = `${store.mode}:${prefix}${e.key}`;
    const candidates = commandKeyMap.get(mapKey);
    if (!candidates) return;

    const multiplier = getPanMultiplier(e.key, e.repeat);
    const ctx = makeCommandContext(multiplier);
    for (const cmd of candidates) {
      if (cmd.available(ctx)) {
        e.preventDefault();
        cmd.execute(ctx);
        return;
      }
    }
  }

  function handleEdgeClick(id: string) {
    store.selectEdge(id);
  }

  function handleNodeClick(id: string, e: MouseEvent) {
    if (didDrag) { didDrag = false; return; }
    if (e.ctrlKey) {
      store.toggleNodeSelection(id);
    } else {
      store.selectNode(id);
    }
  }

  function handleDblClick(e: MouseEvent) {
    const canvas = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(canvas.x, canvas.y);
    if (!node) return;
    store.selectNode(node.id);
    store.enterInsert();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    // Zoom toward mouse cursor position
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const oldZoom = store.viewport.zoom;
    const newZoom = Math.max(0.1, Math.min(5, oldZoom + delta));
    if (newZoom === oldZoom) return;
    // Mouse position relative to viewport center (screen coords)
    const mx = e.clientX - window.innerWidth / 2;
    const my = e.clientY - window.innerHeight / 2;
    // Adjust viewport so canvas point under cursor stays fixed
    store.viewport.x = mx - (mx - store.viewport.x) * (newZoom / oldZoom);
    store.viewport.y = my - (my - store.viewport.y) * (newZoom / oldZoom);
    store.viewport.zoom = newZoom;
  }

  function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - window.innerWidth / 2 - store.viewport.x) / store.viewport.zoom,
      y: (screenY - window.innerHeight / 2 - store.viewport.y) / store.viewport.zoom,
    };
  }

  function snap(v: number): number {
    return Math.round(v / STEP) * STEP;
  }

  function getResizeEdge(node: CanvasNode, canvasX: number, canvasY: number): ResizeEdge | null {
    const zone = BORDER_ZONE / store.viewport.zoom;
    const left = canvasX - node.x < zone;
    const right = node.x + node.width - canvasX < zone;
    const top = canvasY - node.y < zone;
    const bottom = node.y + node.height - canvasY < zone;
    if (left || right || top || bottom) return { left, right, top, bottom };
    return null;
  }

  function findNodeAt(canvasX: number, canvasY: number): CanvasNode | undefined {
    const p = { x: canvasX, y: canvasY };
    // Prefer non-group nodes over group nodes
    for (let i = store.nodes.length - 1; i >= 0; i--) {
      if (store.nodes[i].type !== "group" && pointInNode(store.nodes[i], p)) return store.nodes[i];
    }
    for (let i = store.nodes.length - 1; i >= 0; i--) {
      if (pointInNode(store.nodes[i], p)) return store.nodes[i];
    }
    return undefined;
  }

  function cursorForResizeEdge(edge: ResizeEdge): string {
    if ((edge.top && edge.left) || (edge.bottom && edge.right)) return "nwse-resize";
    if ((edge.top && edge.right) || (edge.bottom && edge.left)) return "nesw-resize";
    if (edge.left || edge.right) return "ew-resize";
    if (edge.top || edge.bottom) return "ns-resize";
    return "default";
  }

  /** Returns true if >50% of child's area overlaps the group */
  function isContainedInGroup(child: CanvasNode, group: CanvasNode): boolean {
    const overlapX = Math.max(0, Math.min(child.x + child.width, group.x + group.width) - Math.max(child.x, group.x));
    const overlapY = Math.max(0, Math.min(child.y + child.height, group.y + group.height) - Math.max(child.y, group.y));
    const overlapArea = overlapX * overlapY;
    const childArea = child.width * child.height;
    return childArea > 0 && overlapArea / childArea > 0.5;
  }

  function collectDragNodes(anchorId: string): DragNodeStart[] {
    // If anchor is part of multi-selection, drag all selected nodes
    const baseIds = store.selectedNodeIds.includes(anchorId) && store.selectedNodeIds.length > 1
      ? [...store.selectedNodeIds]
      : [anchorId];

    // For any group nodes in the set, add contained children
    const idSet = new Set(baseIds);
    for (const id of baseIds) {
      const node = store.nodes.find(n => n.id === id);
      if (node?.type === "group") {
        for (const child of store.nodes) {
          if (child.id !== id && !idSet.has(child.id) && isContainedInGroup(child, node)) {
            idSet.add(child.id);
          }
        }
      }
    }

    return [...idSet].map(id => {
      const n = store.nodes.find(nn => nn.id === id)!;
      return { id, startX: n.x, startY: n.y, startW: n.width, startH: n.height };
    });
  }

  function handleMouseDown(e: MouseEvent) {
    // Middle mouse always pans, regardless of mode
    if (e.button === 1) {
      e.preventDefault();
      didDrag = false;
      dragging = {
        type: "pan",
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        nodes: [],
        startViewportX: store.viewport.x,
        startViewportY: store.viewport.y,
        tempSelected: false,
      };
      document.body.style.cursor = "grabbing";
      return;
    }
    if (store.mode === "insert" || store.mode === "connect" || store.mode === "move" || store.mode === "resize" || store.mode === "search" || store.mode === "visual") return;

    const canvas = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(canvas.x, canvas.y);

    if (e.button === 0) {
      // Left click
      e.preventDefault();
      didDrag = false;

      if (node) {
        // Ctrl+click: toggle selection only, no drag
        if (e.ctrlKey) return;
        // Left drag on node → move (all selected if part of selection)
        const wasSelected = store.selectedNodeIds.includes(node.id);
        if (!wasSelected) store.selectNode(node.id);
        store.pushSnapshot();
        dragging = {
          type: "move",
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          nodes: collectDragNodes(node.id),
          startViewportX: 0,
          startViewportY: 0,
          tempSelected: !wasSelected,
        };
        document.body.style.cursor = "grabbing";
      } else {
        // Left drag on background → pan
        dragging = {
          type: "pan",
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          nodes: [],
          startViewportX: store.viewport.x,
          startViewportY: store.viewport.y,
          tempSelected: false,
        };
        document.body.style.cursor = "grabbing";
      }
    } else if (e.button === 2) {
      // Right click
      e.preventDefault();
      didDrag = false;

      if (node) {
        // Right drag on node → resize (all selected if part of selection)
        if (!store.selectedNodeIds.includes(node.id)) store.selectNode(node.id);
        store.pushSnapshot();
        const midX = node.x + node.width / 2;
        const midY = node.y + node.height / 2;
        const resizeEdge: ResizeEdge = {
          left: canvas.x < midX,
          right: canvas.x >= midX,
          top: canvas.y < midY,
          bottom: canvas.y >= midY,
        };
        dragging = {
          type: "resize",
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          nodes: collectDragNodes(node.id),
          resizeEdge,
          startViewportX: 0,
          startViewportY: 0,
          tempSelected: false,
        };
        document.body.style.cursor = cursorForResizeEdge(resizeEdge);
      } else {
        // Right drag on background → visual selection
        store.enterVisual(canvas.x, canvas.y);
        mouseVisualEnd = { x: canvas.x, y: canvas.y };
        dragging = {
          type: "visual",
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          nodes: [],
          startViewportX: 0,
          startViewportY: 0,
          tempSelected: false,
        };
        document.body.style.cursor = "crosshair";
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    inputMode = "mouse";
    mouseCanvasPos = screenToCanvas(e.clientX, e.clientY);
    if (!dragging) {
      updateCursor(e);
      return;
    }

    e.preventDefault();
    const dx = (e.clientX - dragging.startMouseX) / store.viewport.zoom;
    const dy = (e.clientY - dragging.startMouseY) / store.viewport.zoom;

    if (dragging.type === "move") {
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
      for (const dn of dragging.nodes) {
        const node = store.nodes.find(n => n.id === dn.id);
        if (!node) continue;
        node.x = snap(dn.startX + dx);
        node.y = snap(dn.startY + dy);
      }
    } else if (dragging.type === "resize" && dragging.resizeEdge) {
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
      const edge = dragging.resizeEdge;
      for (const dn of dragging.nodes) {
        const node = store.nodes.find(n => n.id === dn.id);
        if (!node) continue;
        if (edge.right) {
          node.width = Math.max(STEP * 2, snap(dn.startW + dx));
        }
        if (edge.bottom) {
          node.height = Math.max(STEP * 2, snap(dn.startH + dy));
        }
        if (edge.left) {
          const newW = Math.max(STEP * 2, snap(dn.startW - dx));
          node.x = dn.startX + dn.startW - newW;
          node.width = newW;
        }
        if (edge.top) {
          const newH = Math.max(STEP * 2, snap(dn.startH - dy));
          node.y = dn.startY + dn.startH - newH;
          node.height = newH;
        }
      }
    } else if (dragging.type === "pan") {
      didDrag = true;
      store.viewport.x = dragging.startViewportX + (e.clientX - dragging.startMouseX);
      store.viewport.y = dragging.startViewportY + (e.clientY - dragging.startMouseY);
    } else if (dragging.type === "visual") {
      didDrag = true;
      const canvas = screenToCanvas(e.clientX, e.clientY);
      mouseVisualEnd = { x: canvas.x, y: canvas.y };
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (!dragging) return;

    if (dragging.type === "move" || dragging.type === "resize") {
      let anyChanged = false;
      for (const dn of dragging.nodes) {
        const node = store.nodes.find(n => n.id === dn.id);
        if (node && (node.x !== dn.startX || node.y !== dn.startY || node.width !== dn.startW || node.height !== dn.startH)) {
          anyChanged = true;
          break;
        }
      }
      if (anyChanged) {
        store.save();
      } else {
        store.popSnapshot();
      }
      // Deselect if it was a temporary selection during drag
      if (dragging.tempSelected && didDrag) {
        store.deselectAll();
      }
    } else if (dragging.type === "visual") {
      if (mouseVisualEnd && didDrag) {
        store.confirmVisual(mouseVisualEnd.x, mouseVisualEnd.y);
      } else {
        store.exitVisual();
      }
      mouseVisualEnd = null;
    }

    dragging = null;
    document.body.style.cursor = "";
  }

  function updateCursor(e: MouseEvent) {
    if (!containerEl || store.mode === "insert") return;
    const canvas = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(canvas.x, canvas.y);
    containerEl.style.cursor = node ? "crosshair" : "grab";
  }

  function handleBackgroundClick(e: MouseEvent) {
    if (didDrag) { didDrag = false; return; }
    if (store.mode === "insert") store.exitInsert();
    store.deselectAll();
  }

  const MODE_LABELS: Record<string, string> = {
    normal: "NORMAL", insert: "INSERT", connect: "CONNECT", move: "MOVE", resize: "RESIZE", search: "SEARCH", visual: "VISUAL",
  };
  const MODE_COLORS: Record<string, string> = {
    normal: UI_COLORS.mode_normal, insert: UI_COLORS.mode_insert, connect: UI_COLORS.mode_connect,
    move: UI_COLORS.mode_move, resize: UI_COLORS.mode_resize, search: UI_COLORS.mode_search,
    visual: UI_COLORS.mode_visual,
  };
  const modeLabel = $derived(MODE_LABELS[store.mode] ?? "NORMAL");
  const modeColor = $derived(MODE_COLORS[store.mode] ?? UI_COLORS.mode_normal);
  const colors = $derived(store.config!.colors);

  let containerEl: HTMLDivElement | undefined = $state();
  let searchInputEl: HTMLInputElement | undefined = $state();

  // Derive search-related values for Node props
  const isSearchMode = $derived(store.mode === "search");
  const searchMatchSet = $derived(new Set(store.searchMatchIds));
  const currentMatchId = $derived(
    store.searchMatchIds.length > 0 ? store.searchMatchIds[store.searchCurrentIndex] : null
  );

  // Focus search input when entering search mode
  $effect(() => {
    if (isSearchMode && !store.searchConfirmed) {
      requestAnimationFrame(() => searchInputEl?.focus());
    }
  });

  function handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      store.confirmSearch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      store.exitSearch();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) store.searchPrev();
      else store.searchNext();
    }
  }

  onMount(() => {
    containerEl?.focus();
    // Must add wheel listener with passive:false to allow preventDefault on pinch-zoom
    containerEl?.addEventListener("wheel", handleWheel, { passive: false });
    return () => containerEl?.removeEventListener("wheel", handleWheel);
  });
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={resetPanAccel} onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="canvas-container"
  class:cursor-hidden={inputMode === "keyboard"}
  bind:this={containerEl}
  onmousedown={handleMouseDown}
  onclick={handleBackgroundClick}
  ondblclick={handleDblClick}
  oncontextmenu={(e) => e.preventDefault()}
  style="
    --connect-color: {UI_COLORS.connect_color};
    --visual-color: {UI_COLORS.mode_visual};
    --selected-color: {UI_COLORS.selected};
    --subtle-border: {UI_COLORS.subtle_border};
    --edge-label-bg: {colors.background};
    --edge-label-text: {colors.text};
    background-color: {colors.background};
  "
>
  <!-- Crosshair -->
  <div class="crosshair" class:hidden={store.mode === "insert" || inputMode === "mouse"} class:connect-crosshair={store.mode === "connect"} class:visual-crosshair={store.mode === "visual"}>
    <div class="crosshair-h" style="--ch-color: {colors.crosshair};"></div>
    <div class="crosshair-v" style="--ch-color: {colors.crosshair};"></div>
  </div>

  <!-- Canvas plane -->
  <div
    class="canvas-plane"
    style="transform: translate(calc(50vw + {store.viewport.x}px), calc(50vh + {store.viewport.y}px)) scale({store.viewport.zoom});"
  >
    <!-- SVG layer for edges -->
    <svg class="edge-layer" viewBox="-10000 -10000 20000 20000">
      {#each store.edges as edge (edge.id)}
        <EdgeComponent
          {edge}
          nodes={store.nodes}
          defaultColor={colors.edge}
          labelBgColor={colors.background}
          labelTextColor={colors.text}
          selected={store.selectedEdgeId === edge.id}
          hovered={edgeUnderCursor?.id === edge.id && store.mode === "normal"}
          editing={editingEdgeLabel && store.selectedEdgeId === edge.id}
          onClick={handleEdgeClick}
          resolveColor={store.resolveColor}
        />
      {/each}
      {#if store.mode === "connect" && store.connectFromNodeId}
        {@const fromNode = store.nodes.find(n => n.id === store.connectFromNodeId)}
        {#if fromNode}
          {@const center = getCanvasCenter()}
          {@const target = getNodeAtCenter()}
          {@const from = store.connectFromSide ? attachmentPoint(fromNode, store.connectFromSide) : { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 }}
          {@const to = (target && target.id !== store.connectFromNodeId) ? attachmentPoint(target, detectSide(target, center)) : center}
          {@const dx = to.x - from.x}
          {@const bezierPath = `M ${from.x} ${from.y} C ${from.x + dx * 0.5} ${from.y}, ${to.x - dx * 0.5} ${to.y}, ${to.x} ${to.y}`}
          {@const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)}
          <path d={bezierPath} stroke={UI_COLORS.connect_color} stroke-width="2" fill="none" stroke-dasharray="6 4" opacity="0.8" />
          <polygon
            points="-8,-4 0,0 -8,4"
            fill={UI_COLORS.connect_color}
            opacity="0.8"
            transform="translate({to.x},{to.y}) rotate({angle})"
          />
        {/if}
      {/if}
    </svg>

    <!-- Visual mode selection rectangle -->
    {#if store.mode === "visual" && store.visualOrigin}
      {@const end = mouseVisualEnd ?? getCanvasCenter()}
      {@const rx = Math.min(store.visualOrigin.x, end.x)}
      {@const ry = Math.min(store.visualOrigin.y, end.y)}
      {@const rw = Math.abs(end.x - store.visualOrigin.x)}
      {@const rh = Math.abs(end.y - store.visualOrigin.y)}
      <div
        class="visual-rect"
        style="left: {rx}px; top: {ry}px; width: {rw}px; height: {rh}px;"
      ></div>
    {/if}

    <!-- Node layer: groups first (behind), then regular nodes on top -->
    {#each store.nodes.filter(n => n.type === "group") as node (node.id)}
      <NodeComponent
        {node}
        editing={store.selectedNodeId === node.id && store.mode === "insert"}
        selected={store.selectedNodeIds.includes(node.id) || currentMatchId === node.id}
        hovered={nodeUnderCursor?.id === node.id && store.mode === "normal"}
        connectSource={store.mode === "connect" && store.connectFromNodeId === node.id}
        connectTarget={store.mode === "connect" && nodeUnderCursor?.id === node.id && node.id !== store.connectFromNodeId}
        dimmed={(isSearchMode && store.searchQuery.length > 0 && !searchMatchSet.has(node.id)) || (visualEnclosedIds.size > 0 && !visualEnclosedIds.has(node.id)) || (store.selectedNodeIds.length > 0 && !store.selectedNodeIds.includes(node.id))}
        searchQuery={isSearchMode ? store.searchQuery : ""}
        onSelect={handleNodeClick}
        onUpdate={store.updateNode}
        onExitInsert={() => store.exitInsert()}
        colors={colors}
        resolveColor={store.resolveColor}
      />
    {/each}
    {#each store.nodes.filter(n => n.type !== "group") as node (node.id)}
      <NodeComponent
        {node}
        editing={store.selectedNodeId === node.id && store.mode === "insert"}
        selected={store.selectedNodeIds.includes(node.id) || currentMatchId === node.id}
        hovered={nodeUnderCursor?.id === node.id && store.mode === "normal"}
        connectSource={store.mode === "connect" && store.connectFromNodeId === node.id}
        connectTarget={store.mode === "connect" && nodeUnderCursor?.id === node.id && node.id !== store.connectFromNodeId}
        dimmed={(isSearchMode && store.searchQuery.length > 0 && !searchMatchSet.has(node.id)) || (visualEnclosedIds.size > 0 && !visualEnclosedIds.has(node.id)) || (store.selectedNodeIds.length > 0 && !store.selectedNodeIds.includes(node.id))}
        searchQuery={isSearchMode ? store.searchQuery : ""}
        onSelect={handleNodeClick}
        onUpdate={store.updateNode}
        onExitInsert={() => store.exitInsert()}
        colors={colors}
        resolveColor={store.resolveColor}
      />
    {/each}

    <!-- Edge label editor overlay -->
    {#if editingEdgeLabel && store.selectedEdgeId}
      {@const selEdge = store.edges.find(e => e.id === store.selectedEdgeId)}
      {#if selEdge}
        {@const fn = store.nodes.find(n => n.id === selEdge.fromNode)}
        {@const tn = store.nodes.find(n => n.id === selEdge.toNode)}
        {#if fn && tn}
          {@const mx = (fn.x + fn.width / 2 + tn.x + tn.width / 2) / 2}
          {@const my = (fn.y + fn.height / 2 + tn.y + tn.height / 2) / 2}
          <div class="edge-label-editor" style="left: {mx}px; top: {my}px;">
            <input
              bind:this={edgeLabelInputEl}
              bind:value={edgeLabelValue}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishEdgeLabelEdit(); }}}
              class="edge-label-input"
              placeholder=""
            />
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <!-- Search bar -->
  {#if store.mode === "search"}
    <div class="search-bar" style="background: {colors.status_bar_bg}; color: {colors.text};">
      <span class="search-prefix">/</span>
      {#if store.searchConfirmed}
        <span class="search-query">{store.searchQuery}</span>
      {:else}
        <input
          bind:this={searchInputEl}
          class="search-input"
          type="text"
          value={store.searchQuery}
          oninput={(e) => store.setSearchQuery(e.currentTarget.value)}
          onkeydown={handleSearchKeydown}
          placeholder="search..."
          style="color: {colors.text};"
        />
      {/if}
      <span class="search-count">
        {#if store.searchQuery.length === 0}
          type to search
        {:else if store.searchMatchIds.length === 0}
          no matches
        {:else}
          {store.searchCurrentIndex + 1}/{store.searchMatchIds.length}
        {/if}
      </span>
      {#if store.searchConfirmed}
        <span class="search-hint">n/N:navigate Esc:close</span>
      {:else}
        <span class="search-hint">Tab/S-Tab:cycle Enter:confirm Esc:cancel</span>
      {/if}
    </div>
  {/if}

  <!-- Status bar -->
  <div class="status-bar" style="background: {colors.status_bar_bg}; color: {colors.status_bar_text};">
    <span class="mode-indicator" style="color: {modeColor}; border-color: {modeColor};">
      {modeLabel}
    </span>
    <span>
      ({Math.round(-store.viewport.x / store.viewport.zoom)}, {Math.round(-store.viewport.y / store.viewport.zoom)})
    </span>
    <span>{Math.round(store.viewport.zoom * 100)}%</span>
    <span>{store.nodes.length} nodes</span>
    {#if hints.length > 0}
      <span class="hint">{hints.join(" ")}</span>
    {/if}
    {#if store.filePath}
      <span class="filepath">{store.filePath}</span>
    {/if}
  </div>
</div>

<style>
  .canvas-container {
    width: 100vw;
    height: 100vh;
    overflow: clip;
    position: relative;
    cursor: grab;
  }

  .canvas-container.cursor-hidden, .canvas-container.cursor-hidden * {
    cursor: none !important;
  }

  .canvas-plane {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
  }

  .edge-layer {
    position: absolute;
    top: -10000px;
    left: -10000px;
    width: 20000px;
    height: 20000px;
    pointer-events: none;
    overflow: visible;
  }

  .edge-layer :global(path) {
    pointer-events: stroke;
  }

  .crosshair {
    position: fixed;
    top: 50%;
    left: 50%;
    pointer-events: none;
    z-index: 100;
  }

  .crosshair.hidden {
    display: none;
  }

  .crosshair.connect-crosshair .crosshair-h,
  .crosshair.connect-crosshair .crosshair-v {
    background: var(--connect-color) !important;
  }

  .crosshair.visual-crosshair .crosshair-h,
  .crosshair.visual-crosshair .crosshair-v {
    background: var(--visual-color) !important;
  }

  .crosshair-h,
  .crosshair-v {
    position: absolute;
    background: var(--ch-color);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7);
  }

  .crosshair-h {
    width: 20px;
    height: 2px;
    top: -1px;
    left: -10px;
  }

  .crosshair-v {
    width: 2px;
    height: 20px;
    top: -10px;
    left: -1px;
  }

  .status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 28px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 12px;
    font-size: 12px;
    font-family: monospace;
    z-index: 200;
  }

  .mode-indicator {
    font-weight: bold;
    border: 1px solid;
    padding: 1px 6px;
    border-radius: 3px;
  }

  .hint {
    opacity: 0.6;
  }

  .filepath {
    margin-left: auto;
    opacity: 0.4;
  }

  .edge-label-editor {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 50;
  }

  .search-bar {
    position: fixed;
    bottom: 28px;
    left: 0;
    right: 0;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    font-size: 14px;
    font-family: monospace;
    z-index: 200;
    border-top: 1px solid var(--subtle-border);
  }

  .search-prefix {
    opacity: 0.5;
    font-weight: bold;
  }

  .search-input {
    background: transparent;
    border: none;
    outline: none;
    font-family: monospace;
    font-size: 14px;
    flex: 1;
    min-width: 0;
  }

  .search-query {
    flex: 1;
    min-width: 0;
  }

  .search-count {
    opacity: 0.6;
    font-size: 12px;
    white-space: nowrap;
  }

  .search-hint {
    opacity: 0.4;
    font-size: 11px;
    white-space: nowrap;
  }

  .visual-rect {
    position: absolute;
    border: 2px dashed var(--visual-color);
    background: rgba(255, 158, 100, 0.08);
    pointer-events: none;
    z-index: 10;
  }

  .edge-label-input {
    background: var(--edge-label-bg);
    color: var(--edge-label-text);
    border: 1px solid var(--selected-color);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    font-family: monospace;
    text-align: center;
    outline: none;
    min-width: 80px;
  }
</style>
