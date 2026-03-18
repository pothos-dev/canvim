<script lang="ts">
  import type { Mode } from "../stores/mode.svelte";
  import type { Viewport } from "../types";
  import { UI_COLORS } from "../constants";

  interface Props {
    mode: Mode;
    viewport: Viewport;
    nodeCount: number;
    hints: string[];
    filePath: string | null;
    statusBarBg: string;
    statusBarText: string;
  }

  let { mode, viewport, nodeCount, hints, filePath, statusBarBg, statusBarText }: Props = $props();

  const MODE_LABELS: Record<string, string> = {
    normal: "NORMAL", insert: "INSERT", connect: "CONNECT", move: "MOVE", resize: "RESIZE", search: "SEARCH", visual: "VISUAL",
  };
  const MODE_COLORS: Record<string, string> = {
    normal: UI_COLORS.mode_normal, insert: UI_COLORS.mode_insert, connect: UI_COLORS.mode_connect,
    move: UI_COLORS.mode_move, resize: UI_COLORS.mode_resize, search: UI_COLORS.mode_search,
    visual: UI_COLORS.mode_visual,
  };
  const modeLabel = $derived(MODE_LABELS[mode] ?? "NORMAL");
  const modeColor = $derived(MODE_COLORS[mode] ?? UI_COLORS.mode_normal);
</script>

<div class="status-bar" style="background: {statusBarBg}; color: {statusBarText};">
  <div class="status-row top-row">
    {#if hints.length > 0}
      <span class="hint">{hints.join(" ")}</span>
    {/if}
  </div>
  <div class="status-row bottom-row">
    <span class="mode-indicator" style="color: {modeColor}; border-color: {modeColor};">
      {modeLabel}
    </span>
    <span>
      ({Math.round(-viewport.x / viewport.zoom)}, {Math.round(-viewport.y / viewport.zoom)})
    </span>
    <span>{Math.round(viewport.zoom * 100)}%</span>
    <span>{nodeCount} nodes</span>
    {#if hints.length > 0}
      <span class="hint wide-only">{hints.join(" ")}</span>
    {/if}
    {#if filePath}
      <span class="filepath">{filePath}</span>
    {/if}
  </div>
</div>

<style>
  .status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    font-size: 12px;
    font-family: monospace;
    z-index: 200;
  }

  .status-row {
    height: 28px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 12px;
  }

  .top-row {
    display: none;
  }

  .wide-only {
    display: inline;
  }

  @media (max-width: 1199px) {
    .top-row {
      display: flex;
    }

    .wide-only {
      display: none;
    }
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
