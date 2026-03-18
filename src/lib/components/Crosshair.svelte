<script lang="ts">
  import type { Mode } from "../stores/mode.svelte";

  interface Props {
    mode: Mode;
    inputMode: "mouse" | "keyboard";
    crosshairColor: string;
  }

  let { mode, inputMode, crosshairColor }: Props = $props();
</script>

<div class="crosshair" class:hidden={mode === "insert" || inputMode === "mouse"} class:connect-crosshair={mode === "connect"} class:visual-crosshair={mode === "visual"}>
  <div class="crosshair-h" style="--ch-color: {crosshairColor};"></div>
  <div class="crosshair-v" style="--ch-color: {crosshairColor};"></div>
</div>

<style>
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
</style>
