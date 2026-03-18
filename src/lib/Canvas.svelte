<script lang="ts">
  import { onMount } from "svelte";
  import NodeComponent from "./Node.svelte";
  import EdgeComponent from "./Edge.svelte";
  import Crosshair from "./components/Crosshair.svelte";
  import VisualRect from "./components/VisualRect.svelte";
  import ConnectPreview from "./components/ConnectPreview.svelte";
  import EdgeLabelEditor from "./components/EdgeLabelEditor.svelte";
  import SearchBar from "./components/SearchBar.svelte";
  import StatusBar from "./components/StatusBar.svelte";
  import type { CanvasNode, Edge, Point } from "./types";
  import { getStore } from "./stores/index";
  import { buildKeyMap, getHints, type CommandContext, type HintSnapshot } from "./commands";
  import { STEP, UI_COLORS, PAN_ACCEL_MAX, PAN_ACCEL_RAMP, ZOOM_STEP } from "./constants";
  import { marked } from "./markdown";
  import { pointInNode, detectSide, nodesInRect, findNodeAt, isContainedInGroup, cursorForResizeEdge, getEdgeNear, snap, type ResizeEdge } from "./geometry";
  import { getNodeDisplayText } from "./utils";

  const store = getStore();

  type DragType = "move" | "resize" | "pan" | "visual";

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
  let didDrag = false;
  let mouseVisualEnd = $state<{ x: number; y: number } | null>(null);

  type InputMode = "mouse" | "keyboard";
  let inputMode = $state<InputMode>("keyboard");
  let mouseCanvasPos = $state<Point>({ x: 0, y: 0 });

  const commandKeyMap = $derived(store.config ? buildKeyMap(store.config) : new Map());

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

  const cursorPoint = $derived(inputMode === "mouse" ? mouseCanvasPos : store.getCanvasCenter());

  function getNodeAtCenter() {
    return findNodeAt(store.nodes, store.getCanvasCenter());
  }

  let wasInsideFromNode = false;

  $effect(() => {
    if (store.mode !== "connect" || !store.connectFromNodeId) {
      wasInsideFromNode = false;
      return;
    }
    const fromNode = store.findNode(store.connectFromNodeId!);
    if (!fromNode) return;
    const center = store.getCanvasCenter();
    const inside = pointInNode(fromNode, center);
    if (wasInsideFromNode && !inside) {
      store.setConnectFromSide(detectSide(fromNode, center));
    }
    wasInsideFromNode = inside;
  });

  function addNodeAtCenter() {
    const center = store.getCanvasCenter();
    store.addNode(center.x, center.y);
  }

  function fitNodesToContent() {
    const ids = store.selectedNodeIds;
    if (ids.length === 0) return;

    const fontFamily = colors.node_font;
    const fontSize = colors.node_font_size;

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
      const node = store.findNode(id);
      if (!node) continue;
      measure.style.width = `${node.width}px`;
      const html = marked.parse(getNodeDisplayText(node), { async: false }) as string;
      measure.innerHTML = html;
      const height = Math.ceil(measure.scrollHeight / STEP) * STEP;
      store.setNodeSize(id, node.width, height);
    }
    document.body.removeChild(measure);
  }

  function findEdgeNear(point: Point): Edge | undefined {
    return getEdgeNear(store.edges, point, store.findNode);
  }

  // Edge label editing state
  let editingEdgeLabel = $state(false);
  let edgeLabelValue = $state("");
  let edgeLabelEditorRef: EdgeLabelEditor | undefined = $state();

  function startEdgeLabelEdit() {
    const edgeId = store.selectedEdgeId;
    if (!edgeId) return;
    const edge = store.edges.find(e => e.id === edgeId);
    edgeLabelValue = edge?.label ?? "";
    editingEdgeLabel = true;
    store.enterInsert();
    requestAnimationFrame(() => edgeLabelEditorRef?.focus());
  }

  function finishEdgeLabelEdit() {
    if (store.selectedEdgeId) {
      store.updateEdgeLabel(store.selectedEdgeId, edgeLabelValue);
    }
    editingEdgeLabel = false;
    store.exitInsert();
  }

  // Hover detection
  const nonGroupNodeUnderCursor = $derived.by(() => {
    const p = cursorPoint;
    return store.nodes.find((n) => n.type !== "group" && pointInNode(n, p));
  });
  const edgeUnderCursor = $derived(nonGroupNodeUnderCursor ? undefined : findEdgeNear(cursorPoint));
  const nodeUnderCursor = $derived(nonGroupNodeUnderCursor ?? (edgeUnderCursor ? undefined : (() => {
    const p = cursorPoint;
    return store.nodes.find((n) => pointInNode(n, p));
  })()));

  const visualEnclosedIds = $derived.by(() => {
    if (store.mode !== "visual" || !store.visualOrigin) return new Set<string>();
    const end = mouseVisualEnd ?? store.getCanvasCenter();
    const minX = Math.min(store.visualOrigin.x, end.x);
    const minY = Math.min(store.visualOrigin.y, end.y);
    const maxX = Math.max(store.visualOrigin.x, end.x);
    const maxY = Math.max(store.visualOrigin.y, end.y);
    return new Set(nodesInRect(store.nodes, minX, minY, maxX, maxY));
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
      getCanvasCenter: store.getCanvasCenter,
      fitNodesToContent,
      panMultiplier,
    };
  }

  const hints = $derived.by(() => {
    if (!store.config) return [];
    const snap: HintSnapshot = {
      hasNode: !!nodeUnderCursor,
      hasEdge: !!edgeUnderCursor,
      selectedCount: store.selectedNodeIds.length,
    };
    return getHints(store.config, store.mode, snap);
  });

  function handleKeydown(e: KeyboardEvent) {
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
    const canvas = store.screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(store.nodes, canvas);
    if (!node) return;
    store.selectNode(node.id);
    store.enterInsert();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    store.zoomAtPoint(delta, e.clientX, e.clientY);
  }


  function collectDragNodes(anchorId: string): DragNodeStart[] {
    const baseIds = store.selectedNodeIds.includes(anchorId) && store.selectedNodeIds.length > 1
      ? [...store.selectedNodeIds]
      : [anchorId];

    const idSet = new Set(baseIds);
    for (const id of baseIds) {
      const node = store.findNode(id);
      if (node?.type === "group") {
        for (const child of store.nodes) {
          if (child.id !== id && !idSet.has(child.id) && isContainedInGroup(child, node)) {
            idSet.add(child.id);
          }
        }
      }
    }

    return [...idSet].map(id => {
      const n = store.findNode(id)!;
      return { id, startX: n.x, startY: n.y, startW: n.width, startH: n.height };
    });
  }

  function collectDragNodesNoChildren(anchorId: string): DragNodeStart[] {
    const ids = store.selectedNodeIds.includes(anchorId) && store.selectedNodeIds.length > 1
      ? store.selectedNodeIds
      : [anchorId];
    return ids.map(id => {
      const n = store.findNode(id)!;
      return { id, startX: n.x, startY: n.y, startW: n.width, startH: n.height };
    });
  }

  function handleMouseDown(e: MouseEvent) {
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

    const canvas = store.screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(store.nodes, canvas);

    if (e.button === 0) {
      e.preventDefault();
      didDrag = false;

      if (node) {
        if (e.ctrlKey) return;
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
      e.preventDefault();
      didDrag = false;

      if (node) {
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
          nodes: collectDragNodesNoChildren(node.id),
          resizeEdge,
          startViewportX: 0,
          startViewportY: 0,
          tempSelected: false,
        };
        document.body.style.cursor = cursorForResizeEdge(resizeEdge);
      } else {
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
    mouseCanvasPos = store.screenToCanvas(e.clientX, e.clientY);
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
        const node = store.findNode(dn.id);
        if (!node) continue;
        node.x = snap(dn.startX + dx);
        node.y = snap(dn.startY + dy);
      }
    } else if (dragging.type === "resize" && dragging.resizeEdge) {
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
      const edge = dragging.resizeEdge;
      for (const dn of dragging.nodes) {
        const node = store.findNode(dn.id);
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
      const canvas = store.screenToCanvas(e.clientX, e.clientY);
      mouseVisualEnd = { x: canvas.x, y: canvas.y };
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (!dragging) return;

    if (dragging.type === "move" || dragging.type === "resize") {
      let anyChanged = false;
      for (const dn of dragging.nodes) {
        const node = store.findNode(dn.id);
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
    const canvas = store.screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(store.nodes, canvas);
    containerEl.style.cursor = node ? "crosshair" : "grab";
  }

  function handleBackgroundClick(e: MouseEvent) {
    if (didDrag) { didDrag = false; return; }
    if (store.mode === "insert") store.exitInsert();
    store.deselectAll();
  }

  const colors = $derived(store.config!.colors);

  let containerEl: HTMLDivElement | undefined = $state();
  let searchBarRef: SearchBar | undefined = $state();

  // Pre-sorted nodes: groups first (behind), then regular nodes on top
  const sortedNodes = $derived([
    ...store.nodes.filter(n => n.type === "group"),
    ...store.nodes.filter(n => n.type !== "group"),
  ]);

  const isSearchMode = $derived(store.mode === "search");
  const searchMatchSet = $derived(new Set(store.searchMatchIds));
  const currentMatchId = $derived(
    store.searchMatchIds.length > 0 ? store.searchMatchIds[store.searchCurrentIndex] : null
  );

  function isNodeDimmed(nodeId: string): boolean {
    return (isSearchMode && store.searchQuery.length > 0 && !searchMatchSet.has(nodeId))
      || (visualEnclosedIds.size > 0 && !visualEnclosedIds.has(nodeId))
      || (store.selectedNodeIds.length > 0 && !store.selectedNodeIds.includes(nodeId));
  }

  // Focus search input when entering search mode
  $effect(() => {
    if (isSearchMode && !store.searchConfirmed) {
      requestAnimationFrame(() => searchBarRef?.focus());
    }
  });

  onMount(() => {
    containerEl?.focus();
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
  <Crosshair mode={store.mode} {inputMode} crosshairColor={colors.crosshair} />

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
        {@const fromNode = store.findNode(store.connectFromNodeId!)}
        {#if fromNode}
          <ConnectPreview
            {fromNode}
            connectFromSide={store.connectFromSide}
            center={store.getCanvasCenter()}
            targetNode={getNodeAtCenter()}
          />
        {/if}
      {/if}
    </svg>

    <!-- Visual mode selection rectangle -->
    {#if store.mode === "visual" && store.visualOrigin}
      <VisualRect origin={store.visualOrigin} end={mouseVisualEnd ?? store.getCanvasCenter()} />
    {/if}

    <!-- Node layer: groups first (behind), then regular nodes on top -->
    {#each sortedNodes as node (node.id)}
      <NodeComponent
        {node}
        editing={store.selectedNodeId === node.id && store.mode === "insert"}
        selected={store.selectedNodeIds.includes(node.id) || currentMatchId === node.id}
        hovered={nodeUnderCursor?.id === node.id && store.mode === "normal"}
        connectSource={store.mode === "connect" && store.connectFromNodeId === node.id}
        connectTarget={store.mode === "connect" && nodeUnderCursor?.id === node.id && node.id !== store.connectFromNodeId}
        dimmed={isNodeDimmed(node.id)}
        searchQuery={isSearchMode ? store.searchQuery : ""}
        onSelect={handleNodeClick}
        onUpdate={store.updateNode}
        onExitInsert={() => store.exitInsert()}
        {colors}
        resolveColor={store.resolveColor}
        zoom={store.viewport.zoom}
      />
    {/each}

    <!-- Edge label editor overlay -->
    {#if editingEdgeLabel && store.selectedEdgeId}
      {@const selEdge = store.edges.find(e => e.id === store.selectedEdgeId)}
      {#if selEdge}
        {@const fn = store.findNode(selEdge.fromNode)}
        {@const tn = store.findNode(selEdge.toNode)}
        {#if fn && tn}
          <EdgeLabelEditor
            bind:this={edgeLabelEditorRef}
            edge={selEdge}
            fromNode={fn}
            toNode={tn}
            value={edgeLabelValue}
            onValueChange={(v) => edgeLabelValue = v}
            onFinish={finishEdgeLabelEdit}
          />
        {/if}
      {/if}
    {/if}
  </div>

  {#if store.mode === "search"}
    <SearchBar
      bind:this={searchBarRef}
      searchQuery={store.searchQuery}
      searchConfirmed={store.searchConfirmed}
      searchMatchIds={store.searchMatchIds}
      searchCurrentIndex={store.searchCurrentIndex}
      {colors}
      onInput={store.setSearchQuery}
      onConfirm={store.confirmSearch}
      onExit={store.exitSearch}
      onNext={store.searchNext}
      onPrev={store.searchPrev}
    />
  {/if}

  <StatusBar
    mode={store.mode}
    viewport={store.viewport}
    nodeCount={store.nodes.length}
    {hints}
    filePath={store.filePath}
    statusBarBg={colors.status_bar_bg}
    statusBarText={colors.status_bar_text}
  />
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
</style>
