<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { UI_COLORS } from "./constants";
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
    bgColor: string;
    textColor: string;
  }

  let { value, onInput, onEscape, bgColor, textColor }: Props = $props();
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
      backgroundColor: `${UI_COLORS.selection_bg} !important`,
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: `${UI_COLORS.selection_bg_focused} !important`,
    },
    ".cm-cursor": {
      borderLeftColor: textColor,
    },
  });

  const highlightStyle = HighlightStyle.define([
    { tag: tags.heading1, fontWeight: "bold", fontSize: "1.4em" },
    { tag: tags.heading2, fontWeight: "bold", fontSize: "1.2em" },
    { tag: tags.heading3, fontWeight: "bold", fontSize: "1.1em" },
    { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.strikethrough, textDecoration: "line-through", opacity: "0.5" },
    { tag: tags.link, textDecoration: "underline" },
    { tag: tags.url, opacity: "0.7", textDecoration: "underline" },
    { tag: tags.monospace, fontFamily: "monospace", fontSize: "0.9em" },
    { tag: [tags.processingInstruction, tags.inserted], opacity: "0.4" }, // markdown markers like **, ##
    { tag: tags.contentSeparator, opacity: "0.4" }, // ---
    { tag: tags.quote, fontStyle: "italic", opacity: "0.8" },
    { tag: tags.list, opacity: "0.7" },
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
