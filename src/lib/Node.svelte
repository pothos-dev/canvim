<script lang="ts">
  import "highlight.js/styles/github-dark-dimmed.css";
  import { marked } from "./markdown";
  import MarkdownEditor from "./MarkdownEditor.svelte";
  import type { CanvasNode, ConfigColors } from "./types";

  interface Props {
    node: CanvasNode;
    displayPos?: { x: number; y: number; width: number; height: number };
    editing: boolean;
    selected?: boolean;
    hovered: boolean;
    connectSource?: boolean;
    connectTarget?: boolean;
    dimmed?: boolean;
    searchQuery?: string;
    onSelect: (id: string) => void;
    onUpdate: (id: string, text: string) => void;
    onExitInsert: () => void;
    colors?: ConfigColors;
    resolveColor: (preset: string | undefined) => string | undefined;
  }

  let { node, displayPos, editing, selected = false, hovered, connectSource = false, connectTarget = false, dimmed = false, searchQuery = "", onSelect, onUpdate, onExitInsert, colors, resolveColor }: Props = $props();
  let editText = $state("");
  let wasEditing = false;

  $effect(() => {
    if (editing && !wasEditing) {
      editText = node.type === "text" ? node.text : "";
    }
    if (!editing && wasEditing) {
      if (node.type === "text") onUpdate(node.id, editText);
    }
    wasEditing = editing;
  });

  function getDisplayText(): string {
    if (node.type === "text") return node.text;
    if (node.type === "file") return node.file;
    if (node.type === "link") return node.url;
    if (node.type === "group") return node.label ?? "Group";
    return "";
  }

  function highlightSearchMatches(html: string, query: string): string {
    if (!query) return html;
    // Replace only in text content (outside HTML tags)
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    // Split on tags, only replace in non-tag segments
    return html.replace(/(<[^>]*>)|([^<]+)/g, (match, tag, text) => {
      if (tag) return tag;
      return text.replace(re, '<mark class="search-match">$1</mark>');
    });
  }

  function getRenderedHtml(): string {
    let html = marked.parse(getDisplayText(), { async: false }) as string;
    if (searchQuery) html = highlightSearchMatches(html, searchQuery);
    return html;
  }

  const nodeColor = $derived(resolveColor(node.color));
  const borderColor = $derived(nodeColor ?? colors?.node_border ?? "#555");
  const bgColor = $derived(colors?.node_background ?? "#1e1e1e");
  const textColor = $derived(colors?.text ?? "#cdd6f4");
  const fontFamily = $derived(colors?.node_font ?? "system-ui, sans-serif");
  const fontSize = $derived(colors?.node_font_size ?? 14);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="node"
  class:editing
  class:selected
  class:hovered
  class:connect-source={connectSource}
  class:connect-target={connectTarget}
  class:dimmed
  class:group={node.type === "group"}
  style="
    left: {displayPos?.x ?? node.x}px;
    top: {displayPos?.y ?? node.y}px;
    width: {displayPos?.width ?? node.width}px;
    height: {displayPos?.height ?? node.height}px;
    background: {node.type === 'group' ? 'rgba(255,255,255,0.03)' : bgColor};
    color: {textColor};
    font-family: {fontFamily};
    font-size: {fontSize}px;
    border-color: {borderColor};
  "
  onclick={(e) => { e.stopPropagation(); onSelect(node.id); }}
>
  {#if editing && node.type === "text"}
    <MarkdownEditor
      value={editText}
      onInput={(v) => { editText = v; onUpdate(node.id, v); }}
      onEscape={onExitInsert}
      bgColor={bgColor}
      textColor={textColor}
    />
  {:else}
    <div class="node-content">
      {@html getRenderedHtml()}
    </div>
  {/if}
</div>

<style>
  .node {
    position: absolute;
    border: 2px solid;
    border-radius: 8px;
    overflow: hidden;
    cursor: inherit;
    box-sizing: border-box;
    opacity: 0.7;
    transition: opacity 0.15s ease, box-shadow 0.2s ease;
  }

  .node.selected {
    opacity: 1;
    box-shadow: 0 0 0 2px #7aa2f7, 0 4px 16px rgba(122, 162, 247, 0.2);
  }

  .node.hovered {
    opacity: 1;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .node.selected.hovered {
    box-shadow: 0 0 0 2px #7aa2f7, 0 4px 20px rgba(122, 162, 247, 0.3);
  }

  .node.editing {
    opacity: 1;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15);
  }

  .node.connect-source {
    opacity: 1;
    box-shadow: 0 0 12px rgba(247, 118, 142, 0.5), 0 0 0 2px #f7768e;
  }

  .node.connect-target {
    opacity: 1;
    box-shadow: 0 0 16px rgba(247, 118, 142, 0.6), 0 0 0 2px #f7768e;
  }

  .node.dimmed {
    opacity: 0.15;
  }

  .node.group {
    border-style: dashed;
  }

  .node-content {
    padding: 8px 12px;
    font-size: inherit;
    line-height: 1.5;
    overflow: auto;
    height: 100%;
    box-sizing: border-box;
  }

  .node-content :global(p) {
    margin: 0 0 0.5em;
  }

  .node-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .node-content :global(pre) {
    margin: 0.4em 0;
    border-radius: 4px;
    overflow-x: auto;
  }

  .node-content :global(code) {
    font-family: monospace;
    font-size: 0.9em;
  }

  .node-content :global(:not(pre) > code) {
    padding: 0.15em 0.3em;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.06);
  }

  .node-content :global(h1) { font-size: 1.4em; margin: 0 0 0.4em; }
  .node-content :global(h2) { font-size: 1.2em; margin: 0 0 0.4em; }
  .node-content :global(h3) { font-size: 1.1em; margin: 0 0 0.4em; }
  .node-content :global(h4),
  .node-content :global(h5),
  .node-content :global(h6) { font-size: 1em; margin: 0 0 0.4em; }
  .node-content :global(a) { color: inherit; text-decoration: underline; }
  .node-content :global(blockquote) { font-style: italic; opacity: 0.8; margin: 0.4em 0; padding-left: 0.8em; border-left: 2px solid currentColor; }
  .node-content :global(del) { opacity: 0.5; }
  .node-content :global(hr) { opacity: 0.4; border: none; border-top: 1px solid currentColor; }

  .node-content :global(mark.search-match) {
    background: rgba(230, 180, 50, 0.4);
    color: inherit;
    border-radius: 2px;
  }

</style>
