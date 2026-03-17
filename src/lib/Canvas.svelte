<script lang="ts">
  import { onMount } from "svelte";
  import NodeComponent from "./Node.svelte";
  import EdgeComponent from "./Edge.svelte";
  import type { CanvasNode } from "./types";
  import type { Side } from "./canvas-store.svelte";
  import { getStore } from "./canvas-store.svelte";

  const store = getStore();

  const STEP = 20;
  const ZOOM_STEP = 0.15;
  const BORDER_ZONE = 8; // px from edge for resize detection

  type DragType = "move" | "resize";
  type ResizeEdge = { left: boolean; right: boolean; top: boolean; bottom: boolean };

  // Locks focus to a node during Shift+hjkl move/resize so overlapping nodes don't steal focus
  let focusedNodeId = $state<string | null>(null);

  let dragging = $state<{
    type: DragType;
    nodeId: string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
    startNodeW: number;
    startNodeH: number;
    resizeEdge?: ResizeEdge;
  } | null>(null);
  let didDrag = false; // true if a drag actually moved/resized
  let mouseCursorHidden = $state(false);

  function dirFromKey(key: string): [number, number] | null {
    if (!store.config) return null;
    const kb = store.config.keybindings.normal;
    if (key === kb.pan_left || key === "ArrowLeft") return [-1, 0];
    if (key === kb.pan_right || key === "ArrowRight") return [1, 0];
    if (key === kb.pan_up || key === "ArrowUp") return [0, -1];
    if (key === kb.pan_down || key === "ArrowDown") return [0, 1];
    return null;
  }

  function modifierActive(e: KeyboardEvent, mod: string): boolean {
    switch (mod) {
      case "Shift": return e.shiftKey;
      case "Ctrl": return e.ctrlKey;
      case "Alt": return e.altKey;
      case "Meta": return e.metaKey;
      default: return false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Prevent browser zoom on Ctrl+=/Ctrl+-/Ctrl+0
    if (e.ctrlKey && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0")) {
      e.preventDefault();
    }

    if (!store.config) return;
    const kb = store.config.keybindings;

    if (store.mode === "insert") {
      if (e.key === kb.insert.exit) { e.preventDefault(); store.exitInsert(); }
      return;
    }

    if (store.mode === "connect") {
      e.preventDefault();
      if (e.key === "Escape") {
        store.exitConnect();
        return;
      }
      const cdir = dirFromKey(e.key);
      if (cdir) {
        if (!mouseCursorHidden) mouseCursorHidden = true;
        store.pan(-cdir[0] * STEP, -cdir[1] * STEP);
        return;
      }
      if (e.key === "Enter") {
        const target = getNodeAtCenter();
        if (!target || target.id === store.connectFromNodeId) {
          // No valid target or self-edge — cancel
          if (!target) store.exitConnect();
          return;
        }
        const fromNode = store.nodes.find(n => n.id === store.connectFromNodeId);
        if (!fromNode) { store.exitConnect(); return; }
        const fromSide = store.connectFromSide ?? sideBetweenNodes(fromNode, target);
        const center = getCanvasCenter();
        const toSide = detectSide(target, center);
        store.addEdge(fromNode.id, fromSide, target.id, toSide);
        store.exitConnect();
        return;
      }
      return; // swallow all other keys
    }

    const mods = kb.normal.modifiers;
    const dir = dirFromKey(e.key);
    // Use focusedNodeId during Shift/Ctrl+hjkl to prevent focus from jumping to overlapping nodes
    const focusedNode = focusedNodeId ? store.nodes.find(n => n.id === focusedNodeId) : null;
    const targetNode = focusedNode ?? nodeUnderCursor;

    if (dir && targetNode) {
      if (modifierActive(e, mods.resize_node)) {
        e.preventDefault();
        focusedNodeId = targetNode.id;
        store.resizeNode(targetNode.id, dir[0] * STEP, dir[1] * STEP);
        return;
      }
      if (modifierActive(e, mods.move_node)) {
        e.preventDefault();
        focusedNodeId = targetNode.id;
        store.moveNode(targetNode.id, dir[0] * STEP, dir[1] * STEP);
        store.pan(-dir[0] * STEP, -dir[1] * STEP);
        return;
      }
    }

    // Clear focus lock on plain navigation or any non-modifier key
    focusedNodeId = null;

    if (dir) {
      if (!mouseCursorHidden) mouseCursorHidden = true;
      store.pan(-dir[0] * STEP, -dir[1] * STEP);
      return;
    }

    const nk = kb.normal;
    switch (e.key) {
      case nk.zoom_in:
      case "=":
        store.zoom(ZOOM_STEP);
        break;
      case nk.zoom_out:
        store.zoom(-ZOOM_STEP);
        break;
      case nk.add_node:
        e.preventDefault();
        addNodeAtCenter();
        break;
      case nk.select: {
        e.preventDefault();
        if (targetNode) {
          store.selectNode(targetNode.id);
          store.enterInsert();
        }
        break;
      }
      case nk.delete:
      case "Delete":
        if (targetNode) store.removeNode(targetNode.id);
        break;
      case nk.color_red:
        if (targetNode) store.setNodeColor(targetNode.id, "1");
        break;
      case nk.color_orange:
        if (targetNode) store.setNodeColor(targetNode.id, "2");
        break;
      case nk.color_yellow:
        if (targetNode) store.setNodeColor(targetNode.id, "3");
        break;
      case nk.color_green:
        if (targetNode) store.setNodeColor(targetNode.id, "4");
        break;
      case nk.color_cyan:
        if (targetNode) store.setNodeColor(targetNode.id, "5");
        break;
      case nk.color_purple:
        if (targetNode) store.setNodeColor(targetNode.id, "6");
        break;
      case nk.color_clear:
        if (targetNode) store.setNodeColor(targetNode.id, "");
        break;
      case nk.quit:
        store.quit();
        break;
      case "c":
        if (targetNode) store.enterConnect(targetNode.id);
        break;
    }
  }

  function getCanvasCenter(): { x: number; y: number } {
    return {
      x: -store.viewport.x / store.viewport.zoom,
      y: -store.viewport.y / store.viewport.zoom,
    };
  }

  function isNodeUnderCursor(id: string): boolean {
    const center = getCanvasCenter();
    const node = store.nodes.find((n) => n.id === id);
    if (!node) return false;
    return center.x >= node.x && center.x <= node.x + node.width &&
           center.y >= node.y && center.y <= node.y + node.height;
  }

  function getNodeAtCenter() {
    const center = getCanvasCenter();
    return store.nodes.find(
      (n) =>
        center.x >= n.x &&
        center.x <= n.x + n.width &&
        center.y >= n.y &&
        center.y <= n.y + n.height
    );
  }

  function detectSide(node: CanvasNode, point: { x: number; y: number }): Side {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const dx = (point.x - cx) / node.width;
    const dy = (point.y - cy) / node.height;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    }
    return dy > 0 ? "bottom" : "top";
  }

  function getAttachmentPoint(node: CanvasNode, side: Side): { x: number; y: number } {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    switch (side) {
      case "top": return { x: cx, y: node.y };
      case "bottom": return { x: cx, y: node.y + node.height };
      case "left": return { x: node.x, y: cy };
      case "right": return { x: node.x + node.width, y: cy };
    }
  }

  function sideBetweenNodes(from: CanvasNode, to: CanvasNode): Side {
    const fcx = from.x + from.width / 2;
    const fcy = from.y + from.height / 2;
    const tcx = to.x + to.width / 2;
    const tcy = to.y + to.height / 2;
    const dx = (tcx - fcx) / from.width;
    const dy = (tcy - fcy) / from.height;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    }
    return dy > 0 ? "bottom" : "top";
  }

  // Track when cursor leaves fromNode to detect fromSide
  let wasInsideFromNode = $state(false);

  $effect(() => {
    if (store.mode !== "connect" || !store.connectFromNodeId) {
      wasInsideFromNode = false;
      return;
    }
    const fromNode = store.nodes.find(n => n.id === store.connectFromNodeId);
    if (!fromNode) return;
    const center = getCanvasCenter();
    const inside = center.x >= fromNode.x && center.x <= fromNode.x + fromNode.width &&
                   center.y >= fromNode.y && center.y <= fromNode.y + fromNode.height;
    if (wasInsideFromNode && !inside) {
      store.setConnectFromSide(detectSide(fromNode, center));
    }
    wasInsideFromNode = inside;
  });

  function addNodeAtCenter() {
    const center = getCanvasCenter();
    store.addNode(center.x, center.y);
  }

  function handleNodeClick(id: string) {
    if (didDrag) { didDrag = false; return; }
    const node = store.nodes.find((n) => n.id === id);
    if (!node) return;
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    store.viewport.x = -cx * store.viewport.zoom;
    store.viewport.y = -cy * store.viewport.zoom;
    store.selectNode(id);
    store.enterInsert();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey) {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      store.zoom(delta);
    } else {
      store.pan(-e.deltaX, -e.deltaY);
    }
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
    // Reverse order so topmost (last rendered) is found first
    for (let i = store.nodes.length - 1; i >= 0; i--) {
      const n = store.nodes[i];
      if (canvasX >= n.x && canvasX <= n.x + n.width &&
          canvasY >= n.y && canvasY <= n.y + n.height) {
        return n;
      }
    }
    return undefined;
  }

  function getCursorForDrag(type: DragType, edge?: ResizeEdge): string {
    if (type === "move") return "grabbing";
    if (!edge) return "grabbing";
    if ((edge.top && edge.left) || (edge.bottom && edge.right)) return "nwse-resize";
    if ((edge.top && edge.right) || (edge.bottom && edge.left)) return "nesw-resize";
    if (edge.left || edge.right) return "ew-resize";
    if (edge.top || edge.bottom) return "ns-resize";
    return "grabbing";
  }

  function handleMouseDown(e: MouseEvent) {
    if (store.mode === "insert" || store.mode === "connect") return;
    if (e.button !== 0) return;

    const canvas = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(canvas.x, canvas.y);
    if (!node) return;

    e.preventDefault();
    e.stopPropagation();

    didDrag = false;
    const resizeEdge = getResizeEdge(node, canvas.x, canvas.y);
    const type: DragType = resizeEdge ? "resize" : "move";
    dragging = {
      type,
      nodeId: node.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
      startNodeW: node.width,
      startNodeH: node.height,
      resizeEdge: resizeEdge ?? undefined,
    };
    // Force cursor on body so nothing can override it during drag
    document.body.style.cursor = getCursorForDrag(type, resizeEdge ?? undefined);
  }

  function handleMouseMove(e: MouseEvent) {
    if (mouseCursorHidden) mouseCursorHidden = false;
    if (!dragging) {
      updateCursor(e);
      return;
    }

    e.preventDefault();
    const dx = (e.clientX - dragging.startMouseX) / store.viewport.zoom;
    const dy = (e.clientY - dragging.startMouseY) / store.viewport.zoom;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
    const node = store.nodes.find(n => n.id === dragging!.nodeId);
    if (!node) return;

    if (dragging.type === "move") {
      node.x = snap(dragging.startNodeX + dx);
      node.y = snap(dragging.startNodeY + dy);
    } else if (dragging.type === "resize" && dragging.resizeEdge) {
      const edge = dragging.resizeEdge;
      if (edge.right) {
        node.width = Math.max(STEP * 2, snap(dragging.startNodeW + dx));
      }
      if (edge.bottom) {
        node.height = Math.max(STEP * 2, snap(dragging.startNodeH + dy));
      }
      if (edge.left) {
        const newW = Math.max(STEP * 2, snap(dragging.startNodeW - dx));
        node.x = dragging.startNodeX + dragging.startNodeW - newW;
        node.width = newW;
      }
      if (edge.top) {
        const newH = Math.max(STEP * 2, snap(dragging.startNodeH - dy));
        node.y = dragging.startNodeY + dragging.startNodeH - newH;
        node.height = newH;
      }
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (!dragging) return;
    // Only trigger save if the node actually moved/resized
    const node = store.nodes.find(n => n.id === dragging!.nodeId);
    if (node) {
      const moved = node.x !== dragging.startNodeX || node.y !== dragging.startNodeY ||
                    node.width !== dragging.startNodeW || node.height !== dragging.startNodeH;
      if (moved) store.save();
    }
    dragging = null;
    document.body.style.cursor = "";
  }

  function updateCursor(e: MouseEvent) {
    if (!containerEl || store.mode === "insert") return;
    const canvas = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(canvas.x, canvas.y);
    if (!node) {
      containerEl.style.cursor = "crosshair";
      return;
    }
    const edge = getResizeEdge(node, canvas.x, canvas.y);
    if (!edge) {
      containerEl.style.cursor = "grab";
      return;
    }
    if ((edge.top && edge.left) || (edge.bottom && edge.right)) containerEl.style.cursor = "nwse-resize";
    else if ((edge.top && edge.right) || (edge.bottom && edge.left)) containerEl.style.cursor = "nesw-resize";
    else if (edge.left || edge.right) containerEl.style.cursor = "ew-resize";
    else if (edge.top || edge.bottom) containerEl.style.cursor = "ns-resize";
  }

  function handleBackgroundClick(e: MouseEvent) {
    if (didDrag) { didDrag = false; return; }
    store.deselect();
  }

  const modeLabel = $derived(
    store.mode === "normal" ? "NORMAL" : store.mode === "insert" ? "INSERT" : "CONNECT"
  );
  const modeColor = $derived(
    store.mode === "normal" ? "#7aa2f7" : store.mode === "insert" ? "#9ece6a" : "#f7768e"
  );
  const colors = $derived(store.config?.colors);
  const nodeUnderCursor = $derived(getNodeAtCenter());

  let containerEl: HTMLDivElement | undefined = $state();

  onMount(() => {
    containerEl?.focus();
    // Must add wheel listener with passive:false to allow preventDefault on pinch-zoom
    containerEl?.addEventListener("wheel", handleWheel, { passive: false });
    return () => containerEl?.removeEventListener("wheel", handleWheel);
  });
</script>

<svelte:window onkeydown={handleKeydown} onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="canvas-container"
  class:cursor-hidden={mouseCursorHidden}
  bind:this={containerEl}
  onmousedown={handleMouseDown}
  onclick={handleBackgroundClick}
  style="
    background-color: {colors?.background ?? '#181825'};
    background-image:
      radial-gradient(circle, {colors?.dot_grid ?? 'rgba(205,214,244,0.18)'} 2px, transparent 2px),
      radial-gradient(circle, {colors?.dot_grid ?? 'rgba(205,214,244,0.08)'} 1px, transparent 1px);
    background-position:
      calc(50vw + {store.viewport.x % (5 * STEP * store.viewport.zoom)}px) calc(50vh + {store.viewport.y % (5 * STEP * store.viewport.zoom)}px),
      calc(50vw + {store.viewport.x % (STEP * store.viewport.zoom)}px) calc(50vh + {store.viewport.y % (STEP * store.viewport.zoom)}px);
    background-size:
      {5 * STEP * store.viewport.zoom}px {5 * STEP * store.viewport.zoom}px,
      {STEP * store.viewport.zoom}px {STEP * store.viewport.zoom}px;
  "
>
  <!-- Crosshair -->
  <div class="crosshair" class:hidden={store.mode === "insert"} class:connect-crosshair={store.mode === "connect"}>
    <div class="crosshair-h" style="background: {colors?.crosshair ?? 'rgba(205,214,244,0.3)'};"></div>
    <div class="crosshair-v" style="background: {colors?.crosshair ?? 'rgba(205,214,244,0.3)'};"></div>
  </div>

  <!-- Canvas plane -->
  <div
    class="canvas-plane"
    style="transform: translate(calc(50vw + {store.viewport.x}px), calc(50vh + {store.viewport.y}px)) scale({store.viewport.zoom});"
  >
    <!-- SVG layer for edges -->
    <svg class="edge-layer">
      {#each store.edges as edge (edge.id)}
        <EdgeComponent {edge} nodes={store.nodes} defaultColor={colors?.edge ?? '#585b70'} />
      {/each}
      {#if store.mode === "connect" && store.connectFromNodeId}
        {@const fromNode = store.nodes.find(n => n.id === store.connectFromNodeId)}
        {#if fromNode}
          {@const center = getCanvasCenter()}
          {@const target = getNodeAtCenter()}
          {@const from = store.connectFromSide ? getAttachmentPoint(fromNode, store.connectFromSide) : { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 }}
          {@const to = (target && target.id !== store.connectFromNodeId) ? getAttachmentPoint(target, detectSide(target, center)) : center}
          {@const dx = to.x - from.x}
          {@const bezierPath = `M ${from.x} ${from.y} C ${from.x + dx * 0.5} ${from.y}, ${to.x - dx * 0.5} ${to.y}, ${to.x} ${to.y}`}
          {@const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)}
          <path d={bezierPath} stroke="#f7768e" stroke-width="2" fill="none" stroke-dasharray="6 4" opacity="0.8" />
          <polygon
            points="-8,-4 0,0 -8,4"
            fill="#f7768e"
            opacity="0.8"
            transform="translate({to.x},{to.y}) rotate({angle})"
          />
        {/if}
      {/if}
    </svg>

    <!-- Node layer -->
    {#each store.nodes as node (node.id)}
      <NodeComponent
        {node}
        editing={store.selectedNodeId === node.id && store.mode === "insert"}
        hovered={nodeUnderCursor?.id === node.id && store.mode === "normal" && !focusedNodeId}
        connectSource={store.mode === "connect" && store.connectFromNodeId === node.id}
        connectTarget={store.mode === "connect" && nodeUnderCursor?.id === node.id && node.id !== store.connectFromNodeId}
        onSelect={handleNodeClick}
        onUpdate={store.updateNode}
        onExitInsert={() => store.exitInsert()}
        colors={colors}
        resolveColor={store.resolveColor}
      />
    {/each}
  </div>

  <!-- Status bar -->
  <div class="status-bar" style="background: {colors?.status_bar_bg ?? '#11111b'}; color: {colors?.status_bar_text ?? '#6c7086'};">
    <span class="mode-indicator" style="color: {modeColor}; border-color: {modeColor};">
      {modeLabel}
    </span>
    <span>
      ({Math.round(-store.viewport.x / store.viewport.zoom)}, {Math.round(-store.viewport.y / store.viewport.zoom)})
    </span>
    <span>{Math.round(store.viewport.zoom * 100)}%</span>
    <span>{store.nodes.length} nodes</span>
    {#if store.mode === "insert"}
      <span class="hint">Esc:exit</span>
    {:else if store.mode === "connect"}
      <span class="hint">hjkl:move Enter:connect Esc:cancel</span>
    {:else if nodeUnderCursor}
      <span class="hint">hjkl:pan Shift:move Ctrl:resize Enter:edit c:connect d:del 1-6:color</span>
    {:else}
      <span class="hint">hjkl:pan a:add +/-:zoom q:quit</span>
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
    overflow: hidden;
    position: relative;
    cursor: crosshair; /* default, overridden dynamically */
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
    background: #f7768e !important;
  }

  .crosshair-h,
  .crosshair-v {
    position: absolute;
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
</style>
