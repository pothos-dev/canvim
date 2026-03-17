import { test, expect } from "@playwright/test";

test.describe("Canvas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".canvas-container");
  });

  test("renders canvas with status bar in NORMAL mode", async ({ page }) => {
    const modeIndicator = page.locator(".mode-indicator");
    await expect(modeIndicator).toHaveText("NORMAL");
  });

  test("crosshair element exists in DOM", async ({ page }) => {
    const crosshair = page.locator(".crosshair");
    await expect(crosshair).toBeAttached();
  });

  test("renders dot grid background", async ({ page }) => {
    const container = page.locator(".canvas-container");
    const bg = await container.evaluate(
      (el) => getComputedStyle(el).backgroundImage,
    );
    expect(bg).toContain("radial-gradient");
  });

  test("displays hint bar with keybindings", async ({ page }) => {
    const hint = page.locator(".hint");
    await expect(hint).toBeVisible();
    const text = await hint.textContent();
    expect(text).toContain("pan");
  });
});
