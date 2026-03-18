import type { CanvasNode } from "./types";

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
