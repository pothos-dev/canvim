<script lang="ts">
  import type { CanvasNode, Edge, Side } from "./types";
  import { attachmentPoint, autoSides, bezierPath } from "./geometry";

  interface Props {
    edge: Edge;
    nodes: CanvasNode[];
    defaultColor?: string;
    selected?: boolean;
    hovered?: boolean;
    onClick?: (id: string) => void;
    resolveColor?: (preset: string | undefined) => string | undefined;
  }

  let { edge, nodes, defaultColor = "#585b70", selected = false, hovered = false, onClick, resolveColor }: Props = $props();

  const sideAngles: Record<Side, number> = {
    top: -90, bottom: 90, left: 180, right: 0,
  };

  function findNode(id: string): CanvasNode | undefined {
    return nodes.find((n) => n.id === id);
  }

  const resolvedSides = $derived.by(() => {
    const fs = edge.fromSide as Side | undefined;
    const ts = edge.toSide as Side | undefined;
    if (fs && ts) return { fromSide: fs, toSide: ts };
    const fromNode = findNode(edge.fromNode);
    const toNode = findNode(edge.toNode);
    if (!fromNode || !toNode) return { fromSide: (fs ?? "right") as Side, toSide: (ts ?? "left") as Side };
    const auto = autoSides(fromNode, toNode);
    return { fromSide: fs ?? auto.fromSide, toSide: ts ?? auto.toSide };
  });

  const from = $derived.by(() => {
    const node = findNode(edge.fromNode);
    return node ? attachmentPoint(node, resolvedSides.fromSide) : { x: 0, y: 0 };
  });
  const to = $derived.by(() => {
    const node = findNode(edge.toNode);
    return node ? attachmentPoint(node, resolvedSides.toSide) : { x: 0, y: 0 };
  });
  const edgeColor = $derived(resolveColor?.(edge.color) ?? edge.color ?? defaultColor);

  const path = $derived(bezierPath(from, to, resolvedSides.fromSide, resolvedSides.toSide));
  const arrowAngle = $derived(sideAngles[resolvedSides.toSide] + 180);
  const midpoint = $derived({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });

  const opacity = $derived(selected || hovered ? 1 : 0.7);
  const strokeWidth = $derived(selected || hovered ? 3 : 2);

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    onClick?.(edge.id);
  }
</script>

<!-- Invisible wide hitbox path -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<path
  d={path}
  stroke="transparent"
  stroke-width="16"
  fill="none"
  style="pointer-events: stroke; cursor: pointer;"
  onclick={handleClick}
/>

<!-- Visible edge -->
<path d={path} stroke={edgeColor} stroke-width={strokeWidth} fill="none" opacity={opacity} style="pointer-events: none;" />

{#if edge.toEnd !== "none"}
  <polygon
    points="-8,-4 0,0 -8,4"
    fill={edgeColor}
    opacity={opacity}
    transform="translate({to.x},{to.y}) rotate({arrowAngle})"
    style="pointer-events: none;"
  />
{/if}

{#if edge.label}
  <rect
    x={midpoint.x - edge.label.length * 3.6 - 6}
    y={midpoint.y - 18}
    width={edge.label.length * 7.2 + 12}
    height="22"
    rx="4"
    fill="#181825"
    fill-opacity="0.85"
    style="pointer-events: none;"
  />
  <text
    x={midpoint.x}
    y={midpoint.y - 4}
    text-anchor="middle"
    fill="#cdd6f4"
    font-size="12"
    font-family="monospace"
    style="pointer-events: none;"
  >{edge.label}</text>
{/if}
