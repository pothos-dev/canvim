<script lang="ts">
  import type { CanvasNode, Edge, Side } from "./types";
  import { attachmentPoint, autoSides, bezierPath, bezierMidpoint } from "./geometry";

  interface Props {
    edge: Edge;
    nodes: CanvasNode[];
    defaultColor: string;
    labelBgColor: string;
    labelTextColor: string;
    selected?: boolean;
    hovered?: boolean;
    highlighted?: boolean;
    editing?: boolean;
    onClick?: (id: string) => void;
    resolveColor?: (preset: string | undefined) => string | undefined;
  }

  let { edge, nodes, defaultColor, labelBgColor, labelTextColor, selected = false, hovered = false, highlighted = false, editing = false, onClick, resolveColor }: Props = $props();

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
  const midpoint = $derived(bezierMidpoint(from, to, resolvedSides.fromSide, resolvedSides.toSide));

  const active = $derived(selected || hovered || highlighted);
  const opacity = $derived(active ? 1 : 0.7);
  const strokeWidth = $derived(selected || hovered ? 3 : 2);
  const showOutline = $derived(active);

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

<!-- White outline stroke (behind visible edge) -->
{#if showOutline}
  <path d={path} stroke="white" stroke-width={strokeWidth + 6} fill="none" opacity="0.8" style="pointer-events: none;" />
{/if}

<!-- Visible edge -->
<path d={path} stroke={edgeColor} stroke-width={strokeWidth} fill="none" opacity={opacity} style="pointer-events: none;" />

{#if edge.toEnd !== "none"}
  {#if showOutline}
    <polygon
      points="-8,-4 0,0 -8,4"
      fill="white"
      opacity="0.8"
      stroke="white"
      stroke-width="4"
      stroke-linejoin="round"
      transform="translate({to.x},{to.y}) rotate({arrowAngle})"
      style="pointer-events: none;"
    />
  {/if}
  <polygon
    points="-8,-4 0,0 -8,4"
    fill={edgeColor}
    opacity={opacity}
    transform="translate({to.x},{to.y}) rotate({arrowAngle})"
    style="pointer-events: none;"
  />
{/if}

{#if edge.label && !editing}
  <rect
    x={midpoint.x - edge.label.length * 3.6 - 6}
    y={midpoint.y - 18}
    width={edge.label.length * 7.2 + 12}
    height="22"
    rx="4"
    fill={labelBgColor}
    fill-opacity="0.85"
    style="pointer-events: none;"
  />
  <text
    x={midpoint.x}
    y={midpoint.y - 4}
    text-anchor="middle"
    fill={labelTextColor}
    font-size="12"
    font-family="monospace"
    style="pointer-events: none;"
  >{edge.label}</text>
{/if}
