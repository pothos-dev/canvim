<script lang="ts">
  import { onMount } from "svelte";
  import Canvas from "$lib/Canvas.svelte";
  import { getStore } from "$lib/stores/index";
  import { UI_COLORS } from "$lib/constants";

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

<svelte:head>
  {@html `<style>body { background: ${UI_COLORS.loading_bg}; }</style>`}
</svelte:head>

{#if error}
  <div class="error" style="color: {UI_COLORS.error_text};">{error}</div>
{:else if ready}
  <Canvas />
{:else}
  <div class="loading" style="color: {UI_COLORS.loading_text};">Loading...</div>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-size: 16px;
  }
</style>
