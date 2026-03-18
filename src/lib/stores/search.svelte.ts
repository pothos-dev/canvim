import type { CanvasNode } from "../types";
import { getModeStore } from "./mode.svelte";
import { getSelectionStore } from "./selection.svelte";
import { getViewportStore } from "./viewport.svelte";

let searchQuery = $state("");
let searchMatchIds = $state<string[]>([]);
let searchCurrentIndex = $state(0);
let searchConfirmed = $state(false);

function getNodeText(node: CanvasNode): string {
  if (node.type === "text") return node.text;
  if (node.type === "file") return node.file;
  if (node.type === "link") return node.url;
  if (node.type === "group") return node.label ?? "";
  return "";
}

function centerOnNode(node: CanvasNode) {
  getViewportStore().centerOn(node.x + node.width / 2, node.y + node.height / 2);
}

// The nodes getter is injected via init
let getNodes: () => CanvasNode[] = () => [];

function enterSearch() {
  searchQuery = "";
  searchMatchIds = [];
  searchCurrentIndex = 0;
  searchConfirmed = false;
  getModeStore().setMode("search");
}

function exitSearch() {
  searchQuery = "";
  searchMatchIds = [];
  searchCurrentIndex = 0;
  searchConfirmed = false;
  getModeStore().setMode("normal");
}

function setSearchQuery(query: string) {
  searchQuery = query;
  if (!query) {
    searchMatchIds = [];
    searchCurrentIndex = 0;
    return;
  }
  const q = query.toLowerCase();
  const nodes = getNodes();
  searchMatchIds = nodes
    .filter(n => getNodeText(n).toLowerCase().includes(q))
    .map(n => n.id);
  searchCurrentIndex = 0;
  if (searchMatchIds.length > 0) {
    const node = nodes.find(n => n.id === searchMatchIds[0]);
    if (node) centerOnNode(node);
  }
}

function searchNext() {
  if (searchMatchIds.length === 0) return;
  searchCurrentIndex = (searchCurrentIndex + 1) % searchMatchIds.length;
  const nodes = getNodes();
  const node = nodes.find(n => n.id === searchMatchIds[searchCurrentIndex]);
  if (node) centerOnNode(node);
}

function searchPrev() {
  if (searchMatchIds.length === 0) return;
  searchCurrentIndex = (searchCurrentIndex - 1 + searchMatchIds.length) % searchMatchIds.length;
  const nodes = getNodes();
  const node = nodes.find(n => n.id === searchMatchIds[searchCurrentIndex]);
  if (node) centerOnNode(node);
}

function confirmSearch() {
  if (searchMatchIds.length > 0) {
    const id = searchMatchIds[searchCurrentIndex];
    getSelectionStore().selectNode(id);
  }
  searchConfirmed = true;
}

export function getSearchStore(nodesGetter: () => CanvasNode[]) {
  getNodes = nodesGetter;
  return {
    get searchQuery() { return searchQuery; },
    get searchMatchIds() { return searchMatchIds; },
    get searchCurrentIndex() { return searchCurrentIndex; },
    get searchConfirmed() { return searchConfirmed; },
    enterSearch,
    exitSearch,
    setSearchQuery,
    searchNext,
    searchPrev,
    confirmSearch,
    getNodeText,
    centerOnNode,
  };
}
