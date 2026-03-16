<script lang="ts">
  import type { CanvasNode, Edge } from "./types";

  interface Props {
    edge: Edge;
    nodes: CanvasNode[];
    defaultColor?: string;
  }

  let { edge, nodes, defaultColor = "#585b70" }: Props = $props();

  function getNodeCenter(nodeId: string, side?: string): { x: number; y: number } {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;

    switch (side) {
      case "top": return { x: cx, y: node.y };
      case "bottom": return { x: cx, y: node.y + node.height };
      case "left": return { x: node.x, y: cy };
      case "right": return { x: node.x + node.width, y: cy };
      default: return { x: cx, y: cy };
    }
  }

  function getPath(): string {
    const from = getNodeCenter(edge.fromNode, edge.fromSide);
    const to = getNodeCenter(edge.toNode, edge.toSide);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cx1 = from.x + dx * 0.5;
    const cy1 = from.y;
    const cx2 = to.x - dx * 0.5;
    const cy2 = to.y;

    return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
  }

  function getMidpoint(): { x: number; y: number } {
    const from = getNodeCenter(edge.fromNode, edge.fromSide);
    const to = getNodeCenter(edge.toNode, edge.toSide);
    return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  }

  function getArrowAngle(): number {
    const from = getNodeCenter(edge.fromNode, edge.fromSide);
    const to = getNodeCenter(edge.toNode, edge.toSide);
    return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
  }

  function getEndpoint(): { x: number; y: number } {
    return getNodeCenter(edge.toNode, edge.toSide);
  }

  const edgeColor = $derived(edge.color ?? defaultColor);
</script>

<path d={getPath()} stroke={edgeColor} stroke-width="2" fill="none" />

{#if edge.toEnd !== "none"}
  {@const end = getEndpoint()}
  {@const angle = getArrowAngle()}
  <polygon
    points="-8,-4 0,0 -8,4"
    fill={edgeColor}
    transform="translate({end.x},{end.y}) rotate({angle})"
  />
{/if}

{#if edge.label}
  {@const mid = getMidpoint()}
  <text
    x={mid.x}
    y={mid.y - 8}
    text-anchor="middle"
    fill="#cdd6f4"
    font-size="12"
  >{edge.label}</text>
{/if}
