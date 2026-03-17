<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { markdown } from "@codemirror/lang-markdown";
  import { languages } from "@codemirror/language-data";
  import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
  import { tags } from "@lezer/highlight";

  interface Props {
    value: string;
    onInput: (value: string) => void;
    onEscape: () => void;
    bgColor?: string;
    textColor?: string;
  }

  let { value, onInput, onEscape, bgColor = "#1e1e1e", textColor = "#cdd6f4" }: Props = $props();
  let containerEl: HTMLDivElement | undefined = $state();
  let view: EditorView | undefined;

  const theme = EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "inherit",
      fontFamily: "inherit",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      padding: "8px 12px",
      lineHeight: "1.5",
      fontFamily: "inherit",
    },
    ".cm-content": {
      caretColor: textColor,
      padding: "0",
    },
    ".cm-line": {
      padding: "0",
    },
    ".cm-gutters": {
      display: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(122, 162, 247, 0.25) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(122, 162, 247, 0.35) !important",
    },
    ".cm-cursor": {
      borderLeftColor: textColor,
    },
  });

  const highlightStyle = HighlightStyle.define([
    { tag: tags.heading1, fontWeight: "bold", fontSize: "1.4em", color: "#7aa2f7" },
    { tag: tags.heading2, fontWeight: "bold", fontSize: "1.2em", color: "#7aa2f7" },
    { tag: tags.heading3, fontWeight: "bold", fontSize: "1.1em", color: "#7aa2f7" },
    { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "bold", color: "#7aa2f7" },
    { tag: tags.emphasis, fontStyle: "italic", color: "#bb9af7" },
    { tag: tags.strong, fontWeight: "bold", color: "#ff9e64" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: "#565f89" },
    { tag: tags.link, color: "#73daca", textDecoration: "underline" },
    { tag: tags.url, color: "#73daca" },
    { tag: tags.monospace, color: "#9ece6a", fontFamily: "monospace", fontSize: "0.9em" },
    { tag: [tags.processingInstruction, tags.inserted], color: "#565f89" }, // markdown markers like **, ##
    { tag: tags.contentSeparator, color: "#565f89" }, // ---
    { tag: tags.quote, color: "#9aa5ce", fontStyle: "italic" },
    { tag: tags.list, color: "#e0af68" },
  ]);

  const escapeKeymap = keymap.of([
    {
      key: "Escape",
      run: () => {
        onEscape();
        return true;
      },
    },
  ]);

  onMount(() => {
    if (!containerEl) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        theme,
        syntaxHighlighting(highlightStyle),
        markdown({ codeLanguages: languages }),
        escapeKeymap,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onInput(update.state.doc.toString());
          }
        }),
        // Prevent keyboard events from bubbling to canvas
        EditorView.domEventHandlers({
          keydown: (e) => {
            if (e.key !== "Escape") e.stopPropagation();
          },
        }),
        EditorView.lineWrapping,
      ],
    });

    view = new EditorView({
      state,
      parent: containerEl,
    });

    view.focus();
  });

  // Sync external value changes into the editor
  $effect(() => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  });

  onDestroy(() => {
    view?.destroy();
  });
</script>

<div
  class="cm-wrapper"
  bind:this={containerEl}
  style="background: {bgColor}; color: {textColor}; height: 100%;"
></div>

<style>
  .cm-wrapper {
    height: 100%;
    box-sizing: border-box;
  }
  .cm-wrapper :global(.cm-editor) {
    height: 100%;
  }
</style>
