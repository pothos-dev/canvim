<script lang="ts">
  import "highlight.js/styles/github-dark-dimmed.css";
  import { marked } from "./markdown";
  import MarkdownEditor from "./MarkdownEditor.svelte";
  import type { CanvasNode, ConfigColors } from "./types";
  import { UI_COLORS, HEADING_ZOOM_THRESHOLD } from "./constants";
  import { getNodeDisplayText, getNodeHeadingOrFirstLine } from "./utils";

  interface Props {
    node: CanvasNode;
    editing: boolean;
    selected?: boolean;
    hovered: boolean;
    connectSource?: boolean;
    connectTarget?: boolean;
    dimmed?: boolean;
    searchQuery?: string;
    onSelect: (id: string, e: MouseEvent) => void;
    onUpdate: (id: string, text: string) => void;
    onExitInsert: () => void;
    colors: ConfigColors;
    resolveColor: (preset: string | undefined) => string | undefined;
    zoom?: number;
  }

  let { node, editing, selected = false, hovered, connectSource = false, connectTarget = false, dimmed = false, searchQuery = "", onSelect, onUpdate, onExitInsert, colors, resolveColor, zoom = 1 }: Props = $props();
  const isOverview = $derived(zoom < HEADING_ZOOM_THRESHOLD);
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
    let html = marked.parse(getNodeDisplayText(node), { async: false }) as string;
    if (searchQuery) html = highlightSearchMatches(html, searchQuery);
    return html;
  }

  const nodeColor = $derived(resolveColor(node.color));
  const borderColor = $derived(nodeColor ?? colors.node_border);
  const bgColor = $derived.by(() => {
    if (!nodeColor) return colors.node_background;
    // Parse hex color and create a tinted background
    const hex = nodeColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `color-mix(in srgb, ${colors.node_background} 85%, rgb(${r}, ${g}, ${b}))`;
  });
  const textColor = $derived(colors.text);
  const fontFamily = $derived(colors.node_font);
  const fontSize = $derived(colors.node_font_size);
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
    left: {node.x}px;
    top: {node.y}px;
    width: {node.width}px;
    height: {node.height}px;
    --selected: {UI_COLORS.selected};
    --connect-color: {UI_COLORS.connect_color};
    --search-match: {UI_COLORS.search_match};
    --code-bg: {UI_COLORS.code_bg};
    background: {node.type === 'group' ? UI_COLORS.group_bg : bgColor};
    color: {textColor};
    font-family: {fontFamily};
    font-size: {fontSize}px;
    border-color: {borderColor};
  "
  onclick={(e) => { e.stopPropagation(); onSelect(node.id, e); }}
>
  {#if editing && node.type === "text"}
    <MarkdownEditor
      value={editText}
      onInput={(v) => { editText = v; onUpdate(node.id, v); }}
      onEscape={onExitInsert}
      bgColor={bgColor}
      textColor={textColor}
    />
  {:else if isOverview}
    <div class="node-overview">
      {getNodeHeadingOrFirstLine(node)}
    </div>
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
    outline: 3px solid transparent;
    outline-offset: -1px;
  }

  .node.selected {
    outline-color: white;
  }

  .node.hovered {
    outline-color: white;
  }

  .node.editing {
    outline-color: white;
  }

  .node.connect-source {
    outline-color: var(--connect-color);
  }

  .node.connect-target {
    outline-color: var(--connect-color);
  }

  .node.dimmed {
    opacity: 0.7;
  }

  .node.group {
    border-style: dashed;
  }

  .node-overview {
    padding: 8px 12px;
    font-size: 1.6em;
    font-weight: 600;
    line-height: 1.2;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    background: var(--code-bg);
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
    background: var(--search-match);
    color: inherit;
    border-radius: 2px;
  }

</style>
