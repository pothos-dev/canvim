<script lang="ts">
  import type { ConfigColors } from "../types";

  interface Props {
    searchQuery: string;
    searchConfirmed: boolean;
    searchMatchIds: string[];
    searchCurrentIndex: number;
    colors: ConfigColors;
    onInput: (query: string) => void;
    onConfirm: () => void;
    onExit: () => void;
    onNext: () => void;
    onPrev: () => void;
  }

  let { searchQuery, searchConfirmed, searchMatchIds, searchCurrentIndex, colors, onInput, onConfirm, onExit, onNext, onPrev }: Props = $props();
  let searchInputEl: HTMLInputElement | undefined = $state();

  export function focus() {
    requestAnimationFrame(() => searchInputEl?.focus());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onExit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    }
  }
</script>

<div class="search-bar" style="background: {colors.status_bar_bg}; color: {colors.text};">
  <span class="search-prefix">/</span>
  {#if searchConfirmed}
    <span class="search-query">{searchQuery}</span>
  {:else}
    <input
      bind:this={searchInputEl}
      class="search-input"
      type="text"
      value={searchQuery}
      oninput={(e) => onInput(e.currentTarget.value)}
      onkeydown={handleKeydown}
      placeholder="search..."
      style="color: {colors.text};"
    />
  {/if}
  <span class="search-count">
    {#if searchQuery.length === 0}
      type to search
    {:else if searchMatchIds.length === 0}
      no matches
    {:else}
      {searchCurrentIndex + 1}/{searchMatchIds.length}
    {/if}
  </span>
  {#if searchConfirmed}
    <span class="search-hint">n/N:navigate Esc:close</span>
  {:else}
    <span class="search-hint">Tab/S-Tab:cycle Enter:confirm Esc:cancel</span>
  {/if}
</div>

<style>
  .search-bar {
    position: fixed;
    bottom: 28px;
    left: 0;
    right: 0;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    font-size: 14px;
    font-family: monospace;
    z-index: 200;
    border-top: 1px solid var(--subtle-border);
  }

  .search-prefix {
    opacity: 0.5;
    font-weight: bold;
  }

  .search-input {
    background: transparent;
    border: none;
    outline: none;
    font-family: monospace;
    font-size: 14px;
    flex: 1;
    min-width: 0;
  }

  .search-query {
    flex: 1;
    min-width: 0;
  }

  .search-count {
    opacity: 0.6;
    font-size: 12px;
    white-space: nowrap;
  }

  .search-hint {
    opacity: 0.4;
    font-size: 11px;
    white-space: nowrap;
  }
</style>
