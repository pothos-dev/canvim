<script lang="ts">
  import type { CanvasNode, Edge } from "./types";

  interface Props {
    edge: Edge;
    nodes: CanvasNode[];
    defaultColor?: string;
  }

  let { edge, nodes, defaultColor = "#585b70" }: Props = $props();

  type Point = { x: number; y: number };
  type Side = "top" | "bottom" | "left" | "right";

  const sideNormals: Record<Side, Point> = {
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const sideAngles: Record<Side, number> = {
    top: -90, bottom: 90, left: 180, right: 0,
  };

  function getNodeRect(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    return { x: node.x, y: node.y, w: node.width, h: node.height,
      cx: node.x + node.width / 2, cy: node.y + node.height / 2 };
  }

  function attachmentPoint(nodeId: string, side: Side): Point {
    const r = getNodeRect(nodeId);
    if (!r) return { x: 0, y: 0 };
    switch (side) {
      case "top": return { x: r.cx, y: r.y };
      case "bottom": return { x: r.cx, y: r.y + r.h };
      case "left": return { x: r.x, y: r.cy };
      case "right": return { x: r.x + r.w, y: r.cy };
    }
  }

  function autoSide(fromId: string, toId: string): { fromSide: Side; toSide: Side } {
    const a = getNodeRect(fromId);
    const b = getNodeRect(toId);
    if (!a || !b) return { fromSide: "right", toSide: "left" };

    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0
        ? { fromSide: "right", toSide: "left" }
        : { fromSide: "left", toSide: "right" };
    } else {
      return dy >= 0
        ? { fromSide: "bottom", toSide: "top" }
        : { fromSide: "top", toSide: "bottom" };
    }
  }

  const resolvedSides = $derived.by(() => {
    const fs = edge.fromSide as Side | undefined;
    const ts = edge.toSide as Side | undefined;
    if (fs && ts) return { fromSide: fs, toSide: ts };
    const auto = autoSide(edge.fromNode, edge.toNode);
    return { fromSide: fs ?? auto.fromSide, toSide: ts ?? auto.toSide };
  });

  const from = $derived(attachmentPoint(edge.fromNode, resolvedSides.fromSide));
  const to = $derived(attachmentPoint(edge.toNode, resolvedSides.toSide));
  const edgeColor = $derived(edge.color ?? defaultColor);

  const path = $derived.by(() => {
    const nFrom = sideNormals[resolvedSides.fromSide];
    const nTo = sideNormals[resolvedSides.toSide];
    const dist = Math.max(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.4);
    const c1x = from.x + nFrom.x * dist;
    const c1y = from.y + nFrom.y * dist;
    const c2x = to.x + nTo.x * dist;
    const c2y = to.y + nTo.y * dist;
    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  });
  const arrowAngle = $derived(sideAngles[resolvedSides.toSide] + 180);
  const midpoint = $derived({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
</script>

<path d={path} stroke={edgeColor} stroke-width="2" fill="none" />

{#if edge.toEnd !== "none"}
  <polygon
    points="-8,-4 0,0 -8,4"
    fill={edgeColor}
    transform="translate({to.x},{to.y}) rotate({arrowAngle})"
  />
{/if}

{#if edge.label}
  <text
    x={midpoint.x}
    y={midpoint.y - 8}
    text-anchor="middle"
    fill="#cdd6f4"
    font-size="12"
  >{edge.label}</text>
{/if}
