<script lang="ts">
  import { onMount } from "svelte";
  import NodeComponent from "./Node.svelte";
  import EdgeComponent from "./Edge.svelte";
  import type { CanvasNode, Edge, Point, Side } from "./types";
  import { getStore } from "./canvas-store.svelte";
  import { buildKeyMap, getHints, type CommandContext, type HintSnapshot } from "./commands";
  import { STEP, ZOOM_STEP, BORDER_ZONE, EDGE_HIT_THRESHOLD } from "./constants";
  import { marked } from "./markdown";
  import { pointInNode, attachmentPoint, detectSide, autoSides, distToBezier } from "./geometry";

  const store = getStore();

  type DragType = "move" | "resize";
  type ResizeEdge = { left: boolean; right: boolean; top: boolean; bottom: boolean };

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

  // Command system
  const commandKeyMap = $derived(store.config ? buildKeyMap(store.config) : new Map());

  function getCanvasCenter(): Point {
    return {
      x: -store.viewport.x / store.viewport.zoom,
      y: -store.viewport.y / store.viewport.zoom,
    };
  }

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

    const fontFamily = colors?.node_font ?? "system-ui, sans-serif";
    const fontSize = colors?.node_font_size ?? 14;

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

  function getEdgeAtCenter(): Edge | undefined {
    const center = getCanvasCenter();
    let best: Edge | undefined;
    let bestDist = EDGE_HIT_THRESHOLD;
    for (const edge of store.edges) {
      const d = distToEdge(edge, center);
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

  const nodeUnderCursor = $derived(getNodeAtCenter());
  const edgeUnderCursor = $derived(nodeUnderCursor ? undefined : getEdgeAtCenter());

  function makeCommandContext(): CommandContext {
    return {
      store,
      config: store.config!,
      nodeUnderCursor,
      edgeUnderCursor,
      addNodeAtCenter,
      startEdgeLabelEdit,
      finishEdgeLabelEdit,
      editingEdgeLabel,
      hideCursor: () => { if (!mouseCursorHidden) mouseCursorHidden = true; },
      getNodeAtCenter,
      getCanvasCenter,
      fitNodesToContent,
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

  // Manual key repeat — WebKitGTK on Wayland doesn't deliver key repeat events
  const KEY_REPEAT_DELAY = 300; // ms before repeat starts
  const KEY_REPEAT_INTERVAL = 50; // ms between repeats
  let heldKey: string | null = null;
  let heldModifiers = { ctrl: false, shift: false };
  let repeatTimeout: ReturnType<typeof setTimeout> | null = null;
  let repeatInterval: ReturnType<typeof setInterval> | null = null;

  function clearRepeat() {
    if (repeatTimeout) { clearTimeout(repeatTimeout); repeatTimeout = null; }
    if (repeatInterval) { clearInterval(repeatInterval); repeatInterval = null; }
    heldKey = null;
  }

  function executeKey(key: string, ctrl: boolean, shift: boolean) {
    if (!store.config) return;
    const prefix = ctrl ? "C-" : shift && key !== key.toUpperCase() ? "S-" : "";
    const mapKey = `${store.mode}:${prefix}${key}`;
    const candidates = commandKeyMap.get(mapKey);
    if (!candidates) return;
    const ctx = makeCommandContext();
    for (const cmd of candidates) {
      if (cmd.available(ctx)) {
        cmd.execute(ctx);
        return;
      }
    }
  }

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

    const ctx = makeCommandContext();
    for (const cmd of candidates) {
      if (cmd.available(ctx)) {
        e.preventDefault();

        // If this is a new key press (not a browser-delivered repeat), set up manual repeat
        if (!e.repeat && heldKey !== e.key) {
          clearRepeat();
          cmd.execute(ctx);
          heldKey = e.key;
          heldModifiers = { ctrl: e.ctrlKey, shift: e.shiftKey };
          repeatTimeout = setTimeout(() => {
            repeatInterval = setInterval(() => {
              executeKey(heldKey!, heldModifiers.ctrl, heldModifiers.shift);
            }, KEY_REPEAT_INTERVAL);
          }, KEY_REPEAT_DELAY);
        } else if (e.repeat) {
          // Browser did deliver a repeat — execute it and rely on native repeat
          clearRepeat();
          cmd.execute(ctx);
        }
        return;
      }
    }
  }

  function handleKeyup(e: KeyboardEvent) {
    if (e.key === heldKey) {
      clearRepeat();
    }
  }

  function handleEdgeClick(id: string) {
    store.selectEdge(id);
  }

  function handleNodeClick(id: string) {
    if (didDrag) { didDrag = false; return; }
    const node = store.nodes.find((n) => n.id === id);
    if (!node) return;
    store.centerOn(node.x + node.width / 2, node.y + node.height / 2);
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

  function handleMouseDown(e: MouseEvent) {
    if (store.mode === "insert" || store.mode === "connect" || store.mode === "move" || store.mode === "resize" || store.mode === "search") return;
    if (e.button !== 0) return;

    const canvas = screenToCanvas(e.clientX, e.clientY);
    const node = findNodeAt(canvas.x, canvas.y);
    if (!node) return;

    e.preventDefault();
    e.stopPropagation();

    didDrag = false;
    store.pushSnapshot();
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
    document.body.style.cursor = resizeEdge ? cursorForResizeEdge(resizeEdge) : "grabbing";
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
      if (moved) {
        store.save();
      } else {
        // Discard the snapshot pushed in handleMouseDown since nothing changed
        store.popSnapshot();
      }
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
    containerEl.style.cursor = edge ? cursorForResizeEdge(edge) : "grab";
  }

  function handleBackgroundClick(e: MouseEvent) {
    if (didDrag) { didDrag = false; return; }
    store.deselectAll();
  }

  const MODE_LABELS: Record<string, string> = {
    normal: "NORMAL", insert: "INSERT", connect: "CONNECT", move: "MOVE", resize: "RESIZE", search: "SEARCH",
  };
  const MODE_COLORS: Record<string, string> = {
    normal: "#7aa2f7", insert: "#9ece6a", connect: "#f7768e", move: "#e0de71", resize: "#e9973f", search: "#bb9af7",
  };
  const modeLabel = $derived(MODE_LABELS[store.mode] ?? "NORMAL");
  const modeColor = $derived(MODE_COLORS[store.mode] ?? "#7aa2f7");
  const colors = $derived(store.config?.colors);

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
    // Clear key repeat state when window loses focus
    const onBlur = () => clearRepeat();
    window.addEventListener("blur", onBlur);
    return () => {
      containerEl?.removeEventListener("wheel", handleWheel);
      window.removeEventListener("blur", onBlur);
      clearRepeat();
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={handleKeyup} onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

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
    <svg class="edge-layer" viewBox="-10000 -10000 20000 20000">
      {#each store.edges as edge (edge.id)}
        <EdgeComponent
          {edge}
          nodes={store.nodes}
          defaultColor={colors?.edge ?? '#585b70'}
          selected={store.selectedEdgeId === edge.id}
          hovered={edgeUnderCursor?.id === edge.id && store.mode === "normal"}
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

    <!-- Node layer: groups first (behind), then regular nodes on top -->
    {#each store.nodes.filter(n => n.type === "group") as node (node.id)}
      <NodeComponent
        {node}
        editing={store.selectedNodeId === node.id && store.mode === "insert"}
        selected={store.selectedNodeIds.includes(node.id) || currentMatchId === node.id}
        hovered={nodeUnderCursor?.id === node.id && store.mode === "normal"}
        connectSource={store.mode === "connect" && store.connectFromNodeId === node.id}
        connectTarget={store.mode === "connect" && nodeUnderCursor?.id === node.id && node.id !== store.connectFromNodeId}
        dimmed={isSearchMode && store.searchQuery.length > 0 && !searchMatchSet.has(node.id)}
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
        dimmed={isSearchMode && store.searchQuery.length > 0 && !searchMatchSet.has(node.id)}
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
              placeholder="label"
            />
          </div>
        {/if}
      {/if}
    {/if}
  </div>

  <!-- Search bar -->
  {#if store.mode === "search"}
    <div class="search-bar" style="background: {colors?.status_bar_bg ?? '#11111b'}; color: {colors?.text ?? '#cdd6f4'};">
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
          style="color: {colors?.text ?? '#cdd6f4'};"
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
  <div class="status-bar" style="background: {colors?.status_bar_bg ?? '#11111b'}; color: {colors?.status_bar_text ?? '#6c7086'};">
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
    border-top: 1px solid rgba(255, 255, 255, 0.1);
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

  .edge-label-input {
    background: #181825;
    color: #cdd6f4;
    border: 1px solid #7aa2f7;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    font-family: monospace;
    text-align: center;
    outline: none;
    min-width: 80px;
  }
</style>
