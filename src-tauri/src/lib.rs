use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_cli::CliExt;

// --- Config ---

const DEFAULT_CONFIG: &str = r##"# Canvim configuration

[colors]
background = "#181825"
node_background = "#1e1e1e"
node_border = "#555555"
edge = "#585b70"
text = "#cdd6f4"
crosshair = "rgba(205, 214, 244, 0.3)"
dot_grid = "rgba(205, 214, 244, 0.08)"
status_bar_bg = "#11111b"
status_bar_text = "#6c7086"

node_font = "system-ui, sans-serif"
node_font_size = 14

red = "#fb464c"
orange = "#e9973f"
yellow = "#e0de71"
green = "#44cf6e"
cyan = "#53dfdd"
purple = "#a882ff"

[keybindings.normal]
pan_left = "h"
pan_right = "l"
pan_up = "k"
pan_down = "j"
zoom_in = "+"
zoom_out = "-"
add_node = "a"
select = "Enter"
insert = "i"
delete = "d"
deselect = "Escape"
quit = "q"
enter_move = "m"
enter_resize = "r"
connect = "c"
toggle_select = "v"
deselect_all = "V"
color_red = "1"
color_orange = "2"
color_yellow = "3"
color_green = "4"
color_cyan = "5"
color_purple = "6"
color_clear = "0"

[keybindings.move]
left = "h"
right = "l"
up = "k"
down = "j"
exit = "Escape"

[keybindings.resize]
left = "h"
right = "l"
up = "k"
down = "j"
exit = "Escape"

[keybindings.connect]
left = "h"
right = "l"
up = "k"
down = "j"
confirm = "Enter"
exit = "Escape"

[keybindings.insert]
exit = "Escape"
"##;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub colors: ConfigColors,
    #[serde(default)]
    pub keybindings: ConfigKeybindings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigColors {
    #[serde(default = "default_background")]
    pub background: String,
    #[serde(default = "default_node_background")]
    pub node_background: String,
    #[serde(default = "default_node_border")]
    pub node_border: String,
    #[serde(default = "default_edge")]
    pub edge: String,
    #[serde(default = "default_text")]
    pub text: String,
    #[serde(default = "default_crosshair")]
    pub crosshair: String,
    #[serde(default = "default_dot_grid")]
    pub dot_grid: String,
    #[serde(default = "default_status_bar_bg")]
    pub status_bar_bg: String,
    #[serde(default = "default_status_bar_text")]
    pub status_bar_text: String,
    #[serde(default = "default_node_font")]
    pub node_font: String,
    #[serde(default = "default_node_font_size")]
    pub node_font_size: u32,
    #[serde(default = "default_red")]
    pub red: String,
    #[serde(default = "default_orange")]
    pub orange: String,
    #[serde(default = "default_yellow")]
    pub yellow: String,
    #[serde(default = "default_green")]
    pub green: String,
    #[serde(default = "default_cyan")]
    pub cyan: String,
    #[serde(default = "default_purple")]
    pub purple: String,
}

fn default_background() -> String { "#181825".into() }
fn default_node_background() -> String { "#1e1e1e".into() }
fn default_node_border() -> String { "#555555".into() }
fn default_edge() -> String { "#585b70".into() }
fn default_text() -> String { "#cdd6f4".into() }
fn default_crosshair() -> String { "rgba(205, 214, 244, 0.3)".into() }
fn default_dot_grid() -> String { "rgba(205, 214, 244, 0.08)".into() }
fn default_status_bar_bg() -> String { "#11111b".into() }
fn default_status_bar_text() -> String { "#6c7086".into() }
fn default_node_font() -> String { "system-ui, sans-serif".into() }
fn default_node_font_size() -> u32 { 14 }
fn default_red() -> String { "#fb464c".into() }
fn default_orange() -> String { "#e9973f".into() }
fn default_yellow() -> String { "#e0de71".into() }
fn default_green() -> String { "#44cf6e".into() }
fn default_cyan() -> String { "#53dfdd".into() }
fn default_purple() -> String { "#a882ff".into() }

impl Default for ConfigColors {
    fn default() -> Self {
        Self {
            background: default_background(),
            node_background: default_node_background(),
            node_border: default_node_border(),
            edge: default_edge(),
            text: default_text(),
            crosshair: default_crosshair(),
            dot_grid: default_dot_grid(),
            status_bar_bg: default_status_bar_bg(),
            status_bar_text: default_status_bar_text(),
            node_font: default_node_font(),
            node_font_size: default_node_font_size(),
            red: default_red(),
            orange: default_orange(),
            yellow: default_yellow(),
            green: default_green(),
            cyan: default_cyan(),
            purple: default_purple(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigKeybindings {
    #[serde(default)]
    pub normal: NormalKeybindings,
    #[serde(default)]
    pub r#move: MoveKeybindings,
    #[serde(default)]
    pub resize: ResizeKeybindings,
    #[serde(default)]
    pub connect: ConnectKeybindings,
    #[serde(default)]
    pub insert: InsertKeybindings,
}

impl Default for ConfigKeybindings {
    fn default() -> Self {
        Self {
            normal: NormalKeybindings::default(),
            r#move: MoveKeybindings::default(),
            resize: ResizeKeybindings::default(),
            connect: ConnectKeybindings::default(),
            insert: InsertKeybindings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalKeybindings {
    #[serde(default = "default_pan_left")]
    pub pan_left: String,
    #[serde(default = "default_pan_right")]
    pub pan_right: String,
    #[serde(default = "default_pan_up")]
    pub pan_up: String,
    #[serde(default = "default_pan_down")]
    pub pan_down: String,
    #[serde(default = "default_zoom_in")]
    pub zoom_in: String,
    #[serde(default = "default_zoom_out")]
    pub zoom_out: String,
    #[serde(default = "default_add_node")]
    pub add_node: String,
    #[serde(default = "default_select")]
    pub select: String,
    #[serde(default = "default_insert")]
    pub insert: String,
    #[serde(default = "default_delete")]
    pub delete: String,
    #[serde(default = "default_deselect")]
    pub deselect: String,
    #[serde(default = "default_quit")]
    pub quit: String,
    #[serde(default = "default_enter_move")]
    pub enter_move: String,
    #[serde(default = "default_enter_resize")]
    pub enter_resize: String,
    #[serde(default = "default_connect")]
    pub connect: String,
    #[serde(default = "default_toggle_select")]
    pub toggle_select: String,
    #[serde(default = "default_deselect_all")]
    pub deselect_all: String,
    #[serde(default = "default_color_red")]
    pub color_red: String,
    #[serde(default = "default_color_orange")]
    pub color_orange: String,
    #[serde(default = "default_color_yellow")]
    pub color_yellow: String,
    #[serde(default = "default_color_green")]
    pub color_green: String,
    #[serde(default = "default_color_cyan")]
    pub color_cyan: String,
    #[serde(default = "default_color_purple")]
    pub color_purple: String,
    #[serde(default = "default_color_clear")]
    pub color_clear: String,
}

fn default_pan_left() -> String { "h".into() }
fn default_pan_right() -> String { "l".into() }
fn default_pan_up() -> String { "k".into() }
fn default_pan_down() -> String { "j".into() }
fn default_zoom_in() -> String { "+".into() }
fn default_zoom_out() -> String { "-".into() }
fn default_add_node() -> String { "a".into() }
fn default_select() -> String { "Enter".into() }
fn default_insert() -> String { "i".into() }
fn default_delete() -> String { "d".into() }
fn default_deselect() -> String { "Escape".into() }
fn default_quit() -> String { "q".into() }
fn default_color_red() -> String { "1".into() }
fn default_color_orange() -> String { "2".into() }
fn default_color_yellow() -> String { "3".into() }
fn default_color_green() -> String { "4".into() }
fn default_color_cyan() -> String { "5".into() }
fn default_color_purple() -> String { "6".into() }
fn default_color_clear() -> String { "0".into() }
fn default_enter_move() -> String { "m".into() }
fn default_enter_resize() -> String { "r".into() }
fn default_connect() -> String { "c".into() }
fn default_toggle_select() -> String { "v".into() }
fn default_deselect_all() -> String { "V".into() }

impl Default for NormalKeybindings {
    fn default() -> Self {
        Self {
            pan_left: default_pan_left(),
            pan_right: default_pan_right(),
            pan_up: default_pan_up(),
            pan_down: default_pan_down(),
            zoom_in: default_zoom_in(),
            zoom_out: default_zoom_out(),
            add_node: default_add_node(),
            select: default_select(),
            insert: default_insert(),
            delete: default_delete(),
            deselect: default_deselect(),
            quit: default_quit(),
            enter_move: default_enter_move(),
            enter_resize: default_enter_resize(),
            connect: default_connect(),
            toggle_select: default_toggle_select(),
            deselect_all: default_deselect_all(),
            color_red: default_color_red(),
            color_orange: default_color_orange(),
            color_yellow: default_color_yellow(),
            color_green: default_color_green(),
            color_cyan: default_color_cyan(),
            color_purple: default_color_purple(),
            color_clear: default_color_clear(),
        }
    }
}

fn default_dir_left() -> String { "h".into() }
fn default_dir_right() -> String { "l".into() }
fn default_dir_up() -> String { "k".into() }
fn default_dir_down() -> String { "j".into() }
fn default_exit() -> String { "Escape".into() }
fn default_confirm() -> String { "Enter".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveKeybindings {
    #[serde(default = "default_dir_left")]
    pub left: String,
    #[serde(default = "default_dir_right")]
    pub right: String,
    #[serde(default = "default_dir_up")]
    pub up: String,
    #[serde(default = "default_dir_down")]
    pub down: String,
    #[serde(default = "default_exit")]
    pub exit: String,
}

impl Default for MoveKeybindings {
    fn default() -> Self {
        Self {
            left: default_dir_left(),
            right: default_dir_right(),
            up: default_dir_up(),
            down: default_dir_down(),
            exit: default_exit(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResizeKeybindings {
    #[serde(default = "default_dir_left")]
    pub left: String,
    #[serde(default = "default_dir_right")]
    pub right: String,
    #[serde(default = "default_dir_up")]
    pub up: String,
    #[serde(default = "default_dir_down")]
    pub down: String,
    #[serde(default = "default_exit")]
    pub exit: String,
}

impl Default for ResizeKeybindings {
    fn default() -> Self {
        Self {
            left: default_dir_left(),
            right: default_dir_right(),
            up: default_dir_up(),
            down: default_dir_down(),
            exit: default_exit(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectKeybindings {
    #[serde(default = "default_dir_left")]
    pub left: String,
    #[serde(default = "default_dir_right")]
    pub right: String,
    #[serde(default = "default_dir_up")]
    pub up: String,
    #[serde(default = "default_dir_down")]
    pub down: String,
    #[serde(default = "default_confirm")]
    pub confirm: String,
    #[serde(default = "default_exit")]
    pub exit: String,
}

impl Default for ConnectKeybindings {
    fn default() -> Self {
        Self {
            left: default_dir_left(),
            right: default_dir_right(),
            up: default_dir_up(),
            down: default_dir_down(),
            confirm: default_confirm(),
            exit: default_exit(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsertKeybindings {
    #[serde(default = "default_exit")]
    pub exit: String,
}

impl Default for InsertKeybindings {
    fn default() -> Self {
        Self {
            exit: default_exit(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            colors: ConfigColors::default(),
            keybindings: ConfigKeybindings::default(),
        }
    }
}

fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("canvim")
        .join("config.toml")
}

fn load_or_create_config() -> Config {
    let path = config_path();

    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match toml::from_str(&content) {
                Ok(config) => return config,
                Err(e) => {
                    eprintln!("Warning: failed to parse config: {e}, using defaults");
                    return Config::default();
                }
            },
            Err(e) => {
                eprintln!("Warning: failed to read config: {e}, using defaults");
                return Config::default();
            }
        }
    }

    // Create default config
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, DEFAULT_CONFIG);

    Config::default()
}

// --- Canvas types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canvas {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Node {
    #[serde(rename = "text")]
    Text {
        id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        #[serde(default)]
        text: String,
    },
    #[serde(rename = "file")]
    File {
        id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        file: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        subpath: Option<String>,
    },
    #[serde(rename = "link")]
    Link {
        id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        url: String,
    },
    #[serde(rename = "group")]
    Group {
        id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        #[serde(skip_serializing_if = "Option::is_none")]
        color: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        background: Option<String>,
        #[serde(rename = "backgroundStyle", skip_serializing_if = "Option::is_none")]
        background_style: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Edge {
    pub id: String,
    pub from_node: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_side: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_end: Option<String>,
    pub to_node: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_side: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_end: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

// --- App state ---

pub struct AppState {
    pub file_path: Option<String>,
    pub config: Config,
}

// --- Commands ---

#[derive(Debug, Clone, Serialize)]
pub struct InitData {
    pub config: Config,
    pub file_path: Option<String>,
}

#[tauri::command]
fn init(state: tauri::State<AppState>) -> InitData {
    InitData {
        config: state.config.clone(),
        file_path: state.file_path.clone(),
    }
}

#[tauri::command]
fn log(message: String) {
    println!("[webview] {}", message);
}

#[tauri::command]
fn read_canvas(path: String) -> Result<Canvas, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    if content.trim().is_empty() {
        return Ok(Canvas {
            nodes: vec![],
            edges: vec![],
        });
    }
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse canvas: {}", e))
}

#[tauri::command]
fn save_canvas(path: String, data: Canvas) -> Result<(), String> {
    let json =
        serde_json::to_string_pretty(&data).map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_or_create_config();

    // Parse CLI file arg before building app (avoids Mutex for AppState)
    let file_path = {
        let args: Vec<String> = std::env::args().collect();
        if args.len() > 1 && !args[1].starts_with('-') {
            let path_str = &args[1];
            let path = if PathBuf::from(path_str).is_absolute() {
                PathBuf::from(path_str)
            } else {
                std::env::current_dir()
                    .unwrap_or_default()
                    .join(path_str)
            };
            Some(path.to_string_lossy().to_string())
        } else {
            None
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_cli::init())
        .manage(AppState {
            file_path,
            config,
        })
        .invoke_handler(tauri::generate_handler![
            init,
            log,
            read_canvas,
            save_canvas
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_json_serialization() {
        let config = Config::default();
        let json = serde_json::to_string_pretty(&config).unwrap();
        // r#move should serialize as "move"
        assert!(json.contains("\"move\""), "Config JSON should contain 'move' key: {}", json);
        assert!(json.contains("\"resize\""), "Config JSON should contain 'resize' key");
        assert!(json.contains("\"connect\""), "Config JSON should contain 'connect' key");
        // Should NOT contain modifiers
        assert!(!json.contains("\"modifiers\""), "Config JSON should not contain 'modifiers'");

        // Verify the full keybindings structure
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        let kb = &parsed["keybindings"];
        assert!(kb["move"]["left"].is_string(), "move.left should exist");
        assert!(kb["resize"]["left"].is_string(), "resize.left should exist");
        assert!(kb["connect"]["confirm"].is_string(), "connect.confirm should exist");
        assert!(kb["normal"]["enter_move"].is_string(), "normal.enter_move should exist");
    }

    #[test]
    fn test_parse_old_config_with_modifiers() {
        let old_config = r#"
[keybindings.normal]
pan_left = "h"
pan_right = "l"

[keybindings.normal.modifiers]
move_node = "Shift"
resize_node = "Ctrl"

[keybindings.insert]
exit = "Escape"
"#;
        let config: Result<Config, _> = toml::from_str(old_config);
        assert!(config.is_ok(), "Old config with modifiers should parse: {:?}", config.err());
    }

    #[test]
    fn test_parse_architecture_canvas() {
        let content = std::fs::read_to_string("../architecture.canvas")
            .expect("Failed to read architecture.canvas");
        let canvas: Canvas = serde_json::from_str(&content)
            .expect("Failed to parse architecture.canvas");
        assert_eq!(canvas.nodes.len(), 16);
        assert_eq!(canvas.edges.len(), 12);

        // Verify round-trip
        let json = serde_json::to_string_pretty(&canvas).unwrap();
        let canvas2: Canvas = serde_json::from_str(&json)
            .expect("Round-trip parse failed");
        assert_eq!(canvas2.nodes.len(), 16);
        assert_eq!(canvas2.edges.len(), 12);
    }
}
