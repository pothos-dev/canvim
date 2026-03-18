import type { Side } from "../types";
import { getModeStore } from "./mode.svelte";

let connectFromNodeId = $state<string | null>(null);
let connectFromSide = $state<Side | null>(null);
let reconnectEdgeId = $state<string | null>(null);
let reconnectEnd = $state<"from" | "to" | null>(null);

function enterConnect(nodeId: string) {
  connectFromNodeId = nodeId;
  connectFromSide = null;
  reconnectEdgeId = null;
  reconnectEnd = null;
  getModeStore().setMode("connect");
}

function enterReconnect(edgeId: string, end: "from" | "to", fixedNodeId: string, fixedSide: Side) {
  reconnectEdgeId = edgeId;
  reconnectEnd = end;
  connectFromNodeId = fixedNodeId;
  connectFromSide = fixedSide;
  getModeStore().setMode("connect");
}

function exitConnect() {
  connectFromNodeId = null;
  connectFromSide = null;
  reconnectEdgeId = null;
  reconnectEnd = null;
  getModeStore().setMode("normal");
}

function setConnectFromSide(side: Side) {
  connectFromSide = side;
}

export function getConnectStore() {
  return {
    get connectFromNodeId() { return connectFromNodeId; },
    set connectFromNodeId(v: string | null) { connectFromNodeId = v; },
    get connectFromSide() { return connectFromSide; },
    set connectFromSide(v: Side | null) { connectFromSide = v; },
    get reconnectEdgeId() { return reconnectEdgeId; },
    get reconnectEnd() { return reconnectEnd; },
    enterConnect,
    enterReconnect,
    exitConnect,
    setConnectFromSide,
  };
}
