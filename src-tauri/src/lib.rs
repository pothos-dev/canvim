use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_cli::CliExt;

// --- Config macro ---

/// Generates a config struct with serde defaults, default fns, and Default impl.
/// Each field is specified as `field_name: Type = default_expr`.
macro_rules! config_struct {
    ($name:ident { $( $field:ident : $ty:ty = $default:expr ),+ $(,)? }) => {
        ::paste::paste! {
            $(
                fn [<default_ $name:snake _ $field>]() -> $ty { $default }
            )+

            #[derive(Debug, Clone, Serialize, Deserialize)]
            pub struct $name {
                $(
                    #[serde(default = "" [<default_ $name:snake _ $field>] "")]
                    pub $field: $ty,
                )+
            }

            impl Default for $name {
                fn default() -> Self {
                    Self {
                        $( $field: [<default_ $name:snake _ $field>](), )+
                    }
                }
            }
        }
    };
}

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
yank = "y"
paste = "p"
undo = "u"
redo = "C-r"
search = "/"

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

config_struct!(ConfigColors {
    background: String = "#181825".into(),
    node_background: String = "#1e1e1e".into(),
    node_border: String = "#555555".into(),
    edge: String = "#585b70".into(),
    text: String = "#cdd6f4".into(),
    crosshair: String = "rgba(205, 214, 244, 0.3)".into(),
    dot_grid: String = "rgba(205, 214, 244, 0.08)".into(),
    status_bar_bg: String = "#11111b".into(),
    status_bar_text: String = "#6c7086".into(),
    node_font: String = "system-ui, sans-serif".into(),
    node_font_size: u32 = 14,
    red: String = "#fb464c".into(),
    orange: String = "#e9973f".into(),
    yellow: String = "#e0de71".into(),
    green: String = "#44cf6e".into(),
    cyan: String = "#53dfdd".into(),
    purple: String = "#a882ff".into(),
});

config_struct!(NormalKeybindings {
    pan_left: String = "h".into(),
    pan_right: String = "l".into(),
    pan_up: String = "k".into(),
    pan_down: String = "j".into(),
    zoom_in: String = "+".into(),
    zoom_out: String = "-".into(),
    add_node: String = "a".into(),
    select: String = "Enter".into(),
    insert: String = "i".into(),
    delete: String = "d".into(),
    deselect: String = "Escape".into(),
    quit: String = "q".into(),
    enter_move: String = "m".into(),
    enter_resize: String = "r".into(),
    connect: String = "c".into(),
    toggle_select: String = "v".into(),
    deselect_all: String = "V".into(),
    color_red: String = "1".into(),
    color_orange: String = "2".into(),
    color_yellow: String = "3".into(),
    color_green: String = "4".into(),
    color_cyan: String = "5".into(),
    color_purple: String = "6".into(),
    color_clear: String = "0".into(),
    yank: String = "y".into(),
    paste: String = "p".into(),
    undo: String = "u".into(),
    redo: String = "C-r".into(),
    search: String = "/".into(),
});

config_struct!(MoveKeybindings {
    left: String = "h".into(),
    right: String = "l".into(),
    up: String = "k".into(),
    down: String = "j".into(),
    exit: String = "Escape".into(),
});

config_struct!(ResizeKeybindings {
    left: String = "h".into(),
    right: String = "l".into(),
    up: String = "k".into(),
    down: String = "j".into(),
    exit: String = "Escape".into(),
});

config_struct!(ConnectKeybindings {
    left: String = "h".into(),
    right: String = "l".into(),
    up: String = "k".into(),
    down: String = "j".into(),
    confirm: String = "Enter".into(),
    exit: String = "Escape".into(),
});

config_struct!(InsertKeybindings {
    exit: String = "Escape".into(),
});

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
pub struct Config {
    #[serde(default)]
    pub colors: ConfigColors,
    #[serde(default)]
    pub keybindings: ConfigKeybindings,
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
        assert_eq!(canvas.nodes.len(), 19);
        assert_eq!(canvas.edges.len(), 15);

        // Verify round-trip
        let json = serde_json::to_string_pretty(&canvas).unwrap();
        let canvas2: Canvas = serde_json::from_str(&json)
            .expect("Round-trip parse failed");
        assert_eq!(canvas2.nodes.len(), 19);
        assert_eq!(canvas2.edges.len(), 15);
    }
}
