# Canvim

A vim-like canvas editor for [JSON Canvas](https://jsoncanvas.org/) files. Built with Tauri 2, SvelteKit, and Rust.

Canvim lets you create and edit `.canvas` files (the format used by Obsidian Canvas) entirely from the keyboard, using vim-style navigation and modal editing.

## Installation

```
canvim [file.canvas]
```

Opens the given `.canvas` file (creates it if it doesn't exist).

## Features

- **Keyboard-first** -- navigate, create, move, resize, and connect nodes without touching the mouse
- **Modal editing** -- six vim-like modes: Normal, Insert, Visual, Move, Resize, and Connect
- **JSON Canvas spec** -- reads and writes standard `.canvas` files compatible with Obsidian
- **Markdown rendering** -- node text is rendered as markdown with syntax highlighting
- **Search** -- `/` to search node text, cycle through matches
- **Undo/redo** -- full history with `u` and `Ctrl+r`
- **Yank/paste** -- copy and paste nodes (with edges) using `y` and `p`
- **Configurable** -- colors, keybindings, and fonts via `~/.config/canvim/config.toml`
- **Borderless window** -- minimal chrome, maximum canvas

## Modes

### Normal

Default mode. Pan the viewport, select nodes/edges, and enter other modes.

### Insert

Edit node text as markdown. Enter with `i` (on a node) or by adding a new node with `a`. Press `Escape` to return to Normal mode.

### Visual

Rectangle selection. Press `v` to start a selection from the cursor position, then move with `hjkl` to grow/shrink the rectangle. Press `Enter` to select all enclosed nodes, or `Escape` to cancel.

### Move

Move selected nodes. Press `m` on a node or selection, then use `hjkl` to move in grid steps. The viewport follows the movement. Press `Escape` or `Enter` to confirm. Switch to Resize with `r`.

### Resize

Resize selected nodes. Press `r` on a node or selection, then use `hjkl` to grow/shrink. Press `r` again to auto-fit height to content. Press `Escape` or `Enter` to confirm. Switch to Move with `m`.

### Connect

Draw edges between nodes. Press `c` on a source node, navigate with `hjkl` to a target node, then `Enter` to create the edge. `Escape` to cancel.

## Keybindings

### Normal Mode

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Pan viewport |
| `a` | Add node at cursor |
| `Enter` | Select node/edge under cursor |
| `i` | Edit node under cursor |
| `d` / `Delete` | Delete node/edge (or selection) |
| `m` | Enter Move mode |
| `r` | Enter Resize mode |
| `c` | Enter Connect mode |
| `v` | Enter Visual mode |
| `V` | Deselect all |
| `y` / `Ctrl+c` | Yank (copy) node(s) |
| `p` / `Ctrl+v` | Paste |
| `u` | Undo |
| `Ctrl+r` | Redo |
| `/` / `Ctrl+f` | Search |
| `1`-`6` | Set color (red, orange, yellow, green, cyan, purple) |
| `0` | Clear color |
| `+` / `-` | Zoom in/out |
| `Tab` / `Shift+Tab` | Cycle through nodes |
| `Escape` | Deselect |
| `q` | Save and quit |

### Insert Mode

| Key | Action |
|-----|--------|
| *type freely* | Edit node text (markdown) |
| `Escape` | Return to Normal mode |

### Visual Mode

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Expand/shrink selection rectangle |
| `Enter` | Select enclosed nodes |
| `Escape` | Cancel |

### Move Mode

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Move selected node(s) by grid step |
| `r` | Switch to Resize mode |
| `i` | Confirm and enter Insert mode |
| `Enter` / `Escape` | Confirm and exit |

### Resize Mode

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Resize selected node(s) by grid step |
| `r` | Auto-fit height to content |
| `m` | Switch to Move mode |
| `i` | Confirm and enter Insert mode |
| `Enter` / `Escape` | Confirm and exit |

### Connect Mode

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Pan to target node |
| `Enter` | Create edge to node under cursor |
| `Escape` | Cancel |

### Search

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Cycle through matches |
| `Enter` | Confirm search (select match) |
| `n` / `N` | Next/previous match (after confirm) |
| `Escape` | Close search |

Arrow keys work as aliases for `hjkl` in all modes. Mouse drag is also supported for moving and resizing nodes.

## Configuration

Config file: `~/.config/canvim/config.toml`

A default config is created on first run. You can customize:

- **Colors** -- background, node, edge, text, crosshair, dot grid, status bar, and preset colors (1-6)
- **Fonts** -- `node_font` (family) and `node_font_size`
- **Keybindings** -- every key in every mode can be rebound

Example (default):

```toml
[colors]
background = "#0f172a"
node_background = "#1e293b"
node_border = "#334155"
edge = "#475569"
text = "#cbd5e1"
crosshair = "rgba(148, 163, 184, 0.3)"
dot_grid = "rgba(148, 163, 184, 0.08)"
node_font = "system-ui, sans-serif"
node_font_size = 14

[keybindings.normal]
pan_left = "h"
pan_right = "l"
pan_up = "k"
pan_down = "j"
add_node = "a"
select = "Enter"
insert = "i"
delete = "d"
enter_move = "m"
enter_resize = "r"
connect = "c"
enter_visual = "v"
search = "/"
# ... see config.toml for full list
```

## Building from Source

Requires: Rust, Node.js, [Bun](https://bun.sh/)

```sh
bun install
bun tauri build
```

The binary will be at `src-tauri/target/release/canvim`.

## License

MIT
