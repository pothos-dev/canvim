<script lang="ts">
  import type { CanvasNode, Point } from "../types";
  import type { Side } from "../types";
  import { attachmentPoint, detectSide } from "../geometry";
  import { UI_COLORS } from "../constants";

  interface Props {
    fromNode: CanvasNode;
    connectFromSide: Side | null;
    center: Point;
    targetNode: CanvasNode | undefined;
  }

  let { fromNode, connectFromSide, center, targetNode }: Props = $props();

  const from = $derived(connectFromSide
    ? attachmentPoint(fromNode, connectFromSide)
    : { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 });
  const to = $derived((targetNode && targetNode.id !== fromNode.id)
    ? attachmentPoint(targetNode, detectSide(targetNode, center))
    : center);
  const dx = $derived(to.x - from.x);
  const bezierPath = $derived(`M ${from.x} ${from.y} C ${from.x + dx * 0.5} ${from.y}, ${to.x - dx * 0.5} ${to.y}, ${to.x} ${to.y}`);
  const angle = $derived(Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI));
</script>

<path d={bezierPath} stroke={UI_COLORS.connect_color} stroke-width="2" fill="none" stroke-dasharray="6 4" opacity="0.8" />
<polygon
  points="-8,-4 0,0 -8,4"
  fill={UI_COLORS.connect_color}
  opacity="0.8"
  transform="translate({to.x},{to.y}) rotate({angle})"
/>
