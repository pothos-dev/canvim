<script lang="ts">
  interface Props {
    origin: { x: number; y: number };
    end: { x: number; y: number };
  }

  let { origin, end }: Props = $props();

  const rx = $derived(Math.min(origin.x, end.x));
  const ry = $derived(Math.min(origin.y, end.y));
  const rw = $derived(Math.abs(end.x - origin.x));
  const rh = $derived(Math.abs(end.y - origin.y));
</script>

<div
  class="visual-rect"
  style="left: {rx}px; top: {ry}px; width: {rw}px; height: {rh}px;"
></div>

<style>
  .visual-rect {
    position: absolute;
    border: 2px dashed var(--visual-color);
    background: rgba(255, 158, 100, 0.08);
    pointer-events: none;
    z-index: 10;
  }
</style>
