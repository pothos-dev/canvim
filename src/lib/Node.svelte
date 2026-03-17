<script lang="ts">
  import "highlight.js/styles/github-dark-dimmed.css";
  import { marked } from "./markdown";
  import type { CanvasNode, ConfigColors } from "./types";

  interface Props {
    node: CanvasNode;
    editing: boolean;
    selected?: boolean;
    hovered: boolean;
    connectSource?: boolean;
    connectTarget?: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, text: string) => void;
    onExitInsert: () => void;
    colors?: ConfigColors;
    resolveColor: (preset: string | undefined) => string | undefined;
  }

  let { node, editing, selected = false, hovered, connectSource = false, connectTarget = false, onSelect, onUpdate, onExitInsert, colors, resolveColor }: Props = $props();
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let editText = $state("");
  let wasEditing = false;

  $effect(() => {
    if (editing && !wasEditing) {
      // Entering edit mode — copy text to local state
      editText = node.type === "text" ? node.text : "";
    }
    if (!editing && wasEditing) {
      // Exiting edit mode — flush back
      if (node.type === "text") onUpdate(node.id, editText);
    }
    wasEditing = editing;
  });

  $effect(() => {
    if (editing && textareaEl) textareaEl.focus();
  });

  function getDisplayText(): string {
    if (node.type === "text") return node.text;
    if (node.type === "file") return node.file;
    if (node.type === "link") return node.url;
    if (node.type === "group") return node.label ?? "Group";
    return "";
  }

  function getRenderedHtml(): string {
    return marked.parse(getDisplayText(), { async: false }) as string;
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
  class:group={node.type === "group"}
  style="
    left: {node.x}px;
    top: {node.y}px;
    width: {node.width}px;
    height: {node.height}px;
    background: {node.type === 'group' ? 'rgba(255,255,255,0.03)' : bgColor};
    color: {textColor};
    font-family: {fontFamily};
    font-size: {fontSize}px;
    border-color: {borderColor};
  "
  onclick={(e) => { e.stopPropagation(); onSelect(node.id); }}
>
  {#if editing && node.type === "text"}
    <textarea
      bind:this={textareaEl}
      bind:value={editText}
      oninput={() => onUpdate(node.id, editText)}
      onkeydown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); onExitInsert(); }
        e.stopPropagation();
      }}
      class="node-editor"
      style="background: {bgColor}; color: {textColor};"
    ></textarea>
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

  .node-editor {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    resize: none;
    padding: 8px 12px;
    font-family: inherit;
    font-size: inherit;
    line-height: 1.5;
    box-sizing: border-box;
    overflow-y: auto;
  }
</style>
