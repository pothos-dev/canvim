import { invoke } from "@tauri-apps/api/core";

/** Send a debug message to the Tauri console (stdout). */
export function debug(msg: string) {
  invoke("log", { message: msg }).catch(() => {});
}
