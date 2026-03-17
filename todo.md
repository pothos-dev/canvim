# High value
- [x] Undo/redo — No way to reverse mistakes. Essential for any editor.
- [x] Copy/paste nodes — Can't duplicate or move nodes between files. y/p would fit the vim theme.
- [x] Search/jump — No way to find a node by text content. / to search would be natural.
- [x] Node resizing to fit content — Nodes don't auto-size; you have to manually resize after typing.

# Medium value
- [ ] Centering/fit-all — No "zoom to fit" to see the entire canvas at once (e.g. z for fit-all, Z for center on selected).
- [ ] Edge side/arrow editing — Can only set edge color and label; no way to change arrow direction, from/to side, or line style after creation.
- [ ] Node type creation — Only text nodes can be created. No way to create link, file, or group nodes.
- [ ] Reorder/z-index — No way to control layering when nodes overlap (except groups always being behind).
- [ ] Save-as / new file — Can only save to the file opened via CLI. No way to save to a new path or create a new canvas.

# Nice to have
- [ ] Repeat/count prefix — Vim's 5j to move 5 steps. Would make move/resize much faster.
- [ ] Visual feedback on save — No indicator that a save happened (or failed).
- [ ] Node alignment/snapping to neighbors — Smart guides or align commands for lining up nodes.
- [x] Tab to cycle between nodes — No way to jump between nodes without panning.
- [ ] Open links/files — Link and file nodes exist in the spec but can't be opened/followed.
- [ ] Mouse-free connect refinement — Connect mode auto-detects sides, but no way to force a specific side.
