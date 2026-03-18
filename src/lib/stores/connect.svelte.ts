import type { Side } from "../types";
import { getModeStore } from "./mode.svelte";

let connectFromNodeId = $state<string | null>(null);
let connectFromSide = $state<Side | null>(null);

function enterConnect(nodeId: string) {
  connectFromNodeId = nodeId;
  connectFromSide = null;
  getModeStore().setMode("connect");
}

function exitConnect() {
  connectFromNodeId = null;
  connectFromSide = null;
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
    enterConnect,
    exitConnect,
    setConnectFromSide,
  };
}
