// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Auto-daemonize: if not already a child process, re-exec detached
    #[cfg(target_os = "linux")]
    if std::env::var("QANVAS_DAEMONIZED").is_err() {
        use std::process::Command;

        let exe = std::env::current_exe().expect("failed to get exe path");
        let args: Vec<String> = std::env::args().skip(1).collect();

        Command::new(exe)
            .args(&args)
            .env("QANVAS_DAEMONIZED", "1")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .expect("failed to daemonize");

        return;
    }

    qanvas_lib::run()
}
