<script lang="ts">
  import { onMount } from "svelte";
  import Canvas from "$lib/Canvas.svelte";
  import { getStore } from "$lib/canvas-store.svelte";

  const store = getStore();
  let ready = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      // Dynamic import keeps mock out of the production Tauri bundle
      if (!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
        const { installMock } = await import("$lib/tauri-mock");
        installMock();
      }

      await store.init();
      ready = true;
    } catch (e) {
      error = String(e);
    }
  });
</script>

{#if error}
  <div class="error">{error}</div>
{:else if ready}
  <Canvas />
{:else}
  <div class="loading">Loading...</div>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #181825;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: #cdd6f4;
    font-size: 16px;
  }

  .error {
    color: #f38ba8;
  }
</style>
