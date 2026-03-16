<script lang="ts">
  import { onMount } from "svelte";
  import NodeComponent from "./Node.svelte";
  import EdgeComponent from "./Edge.svelte";
  import { getStore } from "./canvas-store.svelte";

  const store = getStore();

  const STEP = 20;
  const ZOOM_STEP = 0.15;

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
    if (!store.config) return;
    const kb = store.config.keybindings;

    if (store.mode === "insert") {
      if (e.key === kb.insert.exit) { e.preventDefault(); store.exitInsert(); }
      return;
    }

    const mods = kb.normal.modifiers;
    const dir = dirFromKey(e.key);
    const targetNode = nodeUnderCursor;

    if (dir && targetNode) {
      if (modifierActive(e, mods.resize_node)) {
        e.preventDefault();
        store.resizeNode(targetNode.id, dir[0] * STEP, dir[1] * STEP);
        return;
      }
      if (modifierActive(e, mods.move_node)) {
        e.preventDefault();
        store.moveNode(targetNode.id, dir[0] * STEP, dir[1] * STEP);
        store.pan(-dir[0] * STEP, -dir[1] * STEP);
        return;
      }
    }

    if (dir) {
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

  function addNodeAtCenter() {
    const center = getCanvasCenter();
    store.addNode(center.x, center.y);
  }

  function handleNodeClick(id: string) {
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

  function handleBackgroundClick() {
    store.deselect();
  }

  const modeLabel = $derived(store.mode === "normal" ? "NORMAL" : "INSERT");
  const modeColor = $derived(store.mode === "normal" ? "#7aa2f7" : "#9ece6a");
  const colors = $derived(store.config?.colors);
  const nodeUnderCursor = $derived(getNodeAtCenter());

  let containerEl: HTMLDivElement | undefined = $state();

  onMount(() => {
    containerEl?.focus();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="canvas-container"
  bind:this={containerEl}
  onwheel={handleWheel}
  onclick={handleBackgroundClick}
  style="
    background-color: {colors?.background ?? '#181825'};
    background-image: radial-gradient(circle, {colors?.dot_grid ?? 'rgba(205,214,244,0.08)'} 1px, transparent 1px);
    background-position: calc(50vw + {store.viewport.x % (STEP * store.viewport.zoom) - (STEP * store.viewport.zoom) / 2}px) calc(50vh + {store.viewport.y % (STEP * store.viewport.zoom) - (STEP * store.viewport.zoom) / 2}px);
    background-size: {STEP * store.viewport.zoom}px {STEP * store.viewport.zoom}px;
  "
>
  <!-- Crosshair -->
  <div class="crosshair" class:hidden={store.mode === "insert"}>
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
    </svg>

    <!-- Node layer -->
    {#each store.nodes as node (node.id)}
      <NodeComponent
        {node}
        editing={store.selectedNodeId === node.id && store.mode === "insert"}
        hovered={nodeUnderCursor?.id === node.id && store.mode === "normal"}
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
    {:else if nodeUnderCursor}
      <span class="hint">hjkl:pan Shift:move Ctrl:resize Enter:edit d:del 1-6:color</span>
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
    cursor: crosshair;
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
