import type { CanvasNode } from "./types";

/** Extract the first heading text, or fall back to the first non-empty line. */
export function getNodeHeadingOrFirstLine(node: CanvasNode): string {
  if (node.type === "group") return node.label || "Group";
  const text = getNodeDisplayText(node);
  const headingMatch = text.match(/^#+\s+(.+)$/m);
  if (headingMatch) return headingMatch[1];
  const firstLine = text.split("\n").find((l) => l.trim() !== "");
  return firstLine?.trim() ?? "";
}

/** Get the display text for any node type. Groups default to "Group" when label is empty. */
export function getNodeDisplayText(node: CanvasNode): string {
  if (node.type === "text") return node.text;
  if (node.type === "file") return node.file;
  if (node.type === "link") return node.url;
  if (node.type === "group") return node.label ?? "Group";
  return "";
}

/** Get the raw text content for search/matching. Groups return empty string when no label. */
export function getNodeText(node: CanvasNode): string {
  if (node.type === "text") return node.text;
  if (node.type === "file") return node.file;
  if (node.type === "link") return node.url;
  if (node.type === "group") return node.label ?? "";
  return "";
}
