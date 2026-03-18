<script lang="ts">
  import type { CanvasNode, Edge } from "../types";

  interface Props {
    edge: Edge;
    fromNode: CanvasNode;
    toNode: CanvasNode;
    value: string;
    onValueChange: (v: string) => void;
    onFinish: () => void;
  }

  let { edge, fromNode, toNode, value, onValueChange, onFinish }: Props = $props();
  let inputEl: HTMLInputElement | undefined = $state();

  const mx = $derived((fromNode.x + fromNode.width / 2 + toNode.x + toNode.width / 2) / 2);
  const my = $derived((fromNode.y + fromNode.height / 2 + toNode.y + toNode.height / 2) / 2);

  export function focus() {
    requestAnimationFrame(() => inputEl?.focus());
  }
</script>

<div class="edge-label-editor" style="left: {mx}px; top: {my}px;">
  <input
    bind:this={inputEl}
    bind:value
    oninput={(e) => onValueChange(e.currentTarget.value)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onFinish(); }}}
    class="edge-label-input"
    placeholder=""
  />
</div>

<style>
  .edge-label-editor {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 50;
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
