<script lang="ts">
  import type { CanvasNode, Edge, Side } from "../types";
  import { attachmentPoint, autoSides, bezierMidpoint } from "../geometry";

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

  const resolvedSides = $derived.by(() => {
    const fs = edge.fromSide as Side | undefined;
    const ts = edge.toSide as Side | undefined;
    if (fs && ts) return { fromSide: fs, toSide: ts };
    const auto = autoSides(fromNode, toNode);
    return { fromSide: fs ?? auto.fromSide, toSide: ts ?? auto.toSide };
  });

  const from = $derived(attachmentPoint(fromNode, resolvedSides.fromSide));
  const to = $derived(attachmentPoint(toNode, resolvedSides.toSide));
  const mid = $derived(bezierMidpoint(from, to, resolvedSides.fromSide, resolvedSides.toSide));

  export function focus() {
    requestAnimationFrame(() => inputEl?.focus());
  }
</script>

<div class="edge-label-editor" style="left: {mid.x}px; top: {mid.y}px;">
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
