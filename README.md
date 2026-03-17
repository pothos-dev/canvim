# Canvim

A vim-like canvas editor for [JSON Canvas](https://jsoncanvas.org/) files. Built with Tauri 2, SvelteKit, and Rust.

Canvim lets you create and edit `.canvas` files (the format used by Obsidian Canvas) entirely from the keyboard, using vim-style navigation and modal editing.

## Features

- **Modal editing** -- Normal, Insert, and Connect modes (like vim)
- **Keyboard-first** -- navigate, create, move, resize, and connect nodes without touching the mouse
- **JSON Canvas spec** -- reads and writes standard `.canvas` files compatible with Obsidian
- **Markdown rendering** -- node text is rendered as markdown with syntax highlighting
- **Configurable** -- colors, keybindings, and fonts via `~/.config/canvim/config.toml`
- **Borderless window** -- minimal chrome, maximum canvas

## Usage

```
canvim [file.canvas]
```

Opens the given `.canvas` file (creates it if it doesn't exist).

## Keybindings

### Normal Mode

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Pan viewport |
| `Shift` + `h` `j` `k` `l` | Move selected node |
| `Ctrl` + `h` `j` `k` `l` | Resize selected node |
| `a` | Add node at cursor |
| `Enter` | Select node/edge and enter Insert mode |
| `d` / `Delete` | Delete node/edge under cursor |
| `c` | Start connecting from node under cursor |
| `1`-`6` | Set node/edge color (red, orange, yellow, green, cyan, purple) |
| `0` | Clear color |
| `+` / `-` | Zoom in/out |
| `q` | Save and quit |
| `Escape` | Deselect |

### Insert Mode

| Key | Action |
|-----|--------|
| Type freely | Edit node text (markdown) |
| `Escape` | Return to Normal mode |

### Connect Mode

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Move cursor to target node |
| `Enter` | Create edge to node under cursor |
| `Escape` | Cancel |

Mouse drag is also supported for moving and resizing nodes.

## Configuration

Config file: `~/.config/canvim/config.toml`

A default config is created on first run. You can customize colors, keybindings, font family, and font size.

## Building from Source

Requires: Rust, Node.js, [Bun](https://bun.sh/)

```sh
bun install
bun tauri build
```

The binary will be at `src-tauri/target/release/canvim`.

## License

MIT
