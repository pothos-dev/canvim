#!/usr/bin/env bun
/**
 * Browser test for edge rendering.
 * Starts the SvelteKit dev server, opens the app in a headless browser via agent-browser,
 * and verifies that SVG edge paths exist and are positioned correctly.
 */

import { spawn, type Subprocess } from "bun";

const DEV_PORT = 1420;
const DEV_URL = `http://localhost:${DEV_PORT}`;
const TIMEOUT_MS = 30_000;

let devServer: Subprocess | null = null;

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function ab(...args: string[]): Promise<string> {
  const proc = spawn(["bunx", "agent-browser", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`agent-browser ${args.join(" ")} failed (${exitCode}): ${stderr}`);
  }
  return stdout.trim();
}

async function main() {
  console.log("Starting dev server...");
  devServer = spawn(["bun", "run", "dev"], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
  });

  try {
    await waitForServer(DEV_URL, TIMEOUT_MS);
    console.log("Dev server ready.");

    // Open the app
    console.log("Opening browser...");
    await ab("open", DEV_URL);

    // Wait for the canvas to render
    console.log("Waiting for canvas...");
    await ab("wait", ".canvas-container");

    // Small delay for edges to render
    await ab("wait", "500");

    // Take a screenshot for debugging
    console.log("Taking screenshot...");
    await ab("screenshot", "tests/screenshot.png");

    // Inspect the SVG edge layer
    console.log("Inspecting edge DOM...");
    const result = await ab(
      "eval",
      `(() => {
        const svg = document.querySelector('svg.edge-layer');
        if (!svg) return JSON.stringify({ error: 'No SVG edge-layer found' });

        const viewBox = svg.getAttribute('viewBox');
        const paths = [...svg.querySelectorAll('path')];
        const polygons = [...svg.querySelectorAll('polygon')];

        const pathData = paths.map(p => {
          const bbox = p.getBBox();
          return {
            d: p.getAttribute('d'),
            bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
          };
        });

        return JSON.stringify({
          viewBox,
          pathCount: paths.length,
          polygonCount: polygons.length,
          paths: pathData,
        });
      })()`
    );

    console.log("Raw result:", result);

    // Close browser
    await ab("close");

    // Parse and validate
    let data: {
      error?: string;
      viewBox: string | null;
      pathCount: number;
      polygonCount: number;
      paths: Array<{ d: string; bbox: { x: number; y: number; width: number; height: number } }>;
    };

    try {
      // agent-browser eval may double-encode (JSON string containing JSON)
      let parsed = JSON.parse(result);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      data = parsed;
    } catch {
      console.error("FAIL: Could not parse eval result:", result);
      process.exit(1);
    }

    if (data.error) {
      console.error("FAIL:", data.error);
      process.exit(1);
    }

    console.log("\n--- Edge Rendering Report ---");
    console.log(`viewBox: ${data.viewBox}`);
    console.log(`Paths: ${data.pathCount}`);
    console.log(`Polygons (arrows): ${data.polygonCount}`);

    let allValid = true;

    if (!data.viewBox) {
      console.error("FAIL: SVG has no viewBox attribute");
      allValid = false;
    }

    if (data.pathCount === 0) {
      console.error("FAIL: No edge paths found");
      allValid = false;
    }

    for (const [i, p] of data.paths.entries()) {
      const valid = p.bbox.width > 0 && p.bbox.height > 0;
      console.log(`  Path ${i}: d="${p.d?.slice(0, 60)}..." bbox=${JSON.stringify(p.bbox)} ${valid ? "OK" : "EMPTY"}`);
      if (!valid) allValid = false;
    }

    console.log("---\n");

    if (allValid) {
      console.log("TEST_RESULT: PASS");
      process.exit(0);
    } else {
      console.error("TEST_RESULT: FAIL");
      process.exit(1);
    }
  } finally {
    if (devServer) {
      devServer.kill();
    }
  }
}

main().catch((err) => {
  console.error("Test error:", err);
  if (devServer) devServer.kill();
  process.exit(1);
});
