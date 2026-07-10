use enigo::{Enigo, KeyboardControllable};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn type_text(text: &str) -> Result<(), String> {
    let mut enigo = Enigo::new();
    enigo.key_sequence(text);
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
fn is_admin() -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("net")
        .arg("session")
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(not(windows))]
#[tauri::command]
fn is_admin() -> bool {
    true
}

#[cfg(windows)]
#[tauri::command]
fn trigger_sys_key(key_code: u16) -> Result<(), String> {
    use winapi::um::winuser::{SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE, MapVirtualKeyW, MAPVK_VK_TO_VSC};
    use std::mem::{size_of, zeroed};

    unsafe {
        let scan_code = MapVirtualKeyW(key_code as u32, MAPVK_VK_TO_VSC) as u16;

        let mut input_down: INPUT = zeroed();
        input_down.type_ = INPUT_KEYBOARD;
        *input_down.u.ki_mut() = KEYBDINPUT {
            wVk: key_code,
            wScan: scan_code,
            dwFlags: KEYEVENTF_SCANCODE,
            time: 0,
            dwExtraInfo: 0,
        };

        let mut input_up: INPUT = zeroed();
        input_up.type_ = INPUT_KEYBOARD;
        *input_up.u.ki_mut() = KEYBDINPUT {
            wVk: key_code,
            wScan: scan_code,
            dwFlags: KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };

        let mut inputs = [input_down, input_up];
        SendInput(2, inputs.as_mut_ptr(), size_of::<INPUT>() as i32);
    }
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn trigger_sys_key(key_code: u16) -> Result<(), String> {
    let mut enigo = enigo::Enigo::new();
    enigo.key_click(enigo::Key::Raw(key_code));
    Ok(())
}

#[tauri::command]
fn run_macro(sequence: &str) -> Result<(), String> {
    let mut enigo = Enigo::new();
    enigo.key_sequence_parse(sequence);
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
fn trigger_sys_combo(modifiers: Vec<u16>, key_code: u16) -> Result<(), String> {
    use winapi::um::winuser::{SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE, MapVirtualKeyW, MAPVK_VK_TO_VSC};
    use std::mem::{size_of, zeroed};

    unsafe {
        let mut inputs: Vec<INPUT> = Vec::new();

        // Modifiers Down
        for &mod_key in &modifiers {
            let scan_code = MapVirtualKeyW(mod_key as u32, MAPVK_VK_TO_VSC) as u16;
            let mut input: INPUT = zeroed();
            input.type_ = INPUT_KEYBOARD;
            *input.u.ki_mut() = KEYBDINPUT {
                wVk: mod_key,
                wScan: scan_code,
                dwFlags: KEYEVENTF_SCANCODE,
                time: 0,
                dwExtraInfo: 0,
            };
            inputs.push(input);
        }

        // Main Key Down
        let scan_code_main = MapVirtualKeyW(key_code as u32, MAPVK_VK_TO_VSC) as u16;
        let mut input_down: INPUT = zeroed();
        input_down.type_ = INPUT_KEYBOARD;
        *input_down.u.ki_mut() = KEYBDINPUT {
            wVk: key_code,
            wScan: scan_code_main,
            dwFlags: KEYEVENTF_SCANCODE,
            time: 0,
            dwExtraInfo: 0,
        };
        inputs.push(input_down);

        // Main Key Up
        let mut input_up: INPUT = zeroed();
        input_up.type_ = INPUT_KEYBOARD;
        *input_up.u.ki_mut() = KEYBDINPUT {
            wVk: key_code,
            wScan: scan_code_main,
            dwFlags: KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0,
        };
        inputs.push(input_up);

        // Modifiers Up (in reverse order)
        for &mod_key in modifiers.iter().rev() {
            let scan_code = MapVirtualKeyW(mod_key as u32, MAPVK_VK_TO_VSC) as u16;
            let mut input: INPUT = zeroed();
            input.type_ = INPUT_KEYBOARD;
            *input.u.ki_mut() = KEYBDINPUT {
                wVk: mod_key,
                wScan: scan_code,
                dwFlags: KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            };
            inputs.push(input);
        }

        if !inputs.is_empty() {
            SendInput(inputs.len() as u32, inputs.as_mut_ptr(), size_of::<INPUT>() as i32);
        }
    }
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn trigger_sys_combo(modifiers: Vec<u16>, key_code: u16) -> Result<(), String> {
    let mut enigo = enigo::Enigo::new();
    enigo.key_click(enigo::Key::Raw(key_code));
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Setup Tray Icon
            use tauri::Manager;
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = tauri::menu::MenuItem::with_id(app, "show", "Open Dashboard", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("dashboard") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("dashboard") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            #[cfg(windows)]
            {
                use tauri::Emitter;
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    use winapi::um::winuser::{GetForegroundWindow, GetWindowThreadProcessId};
                    use winapi::um::processthreadsapi::OpenProcess;
                    use winapi::um::psapi::GetModuleFileNameExW;
                    use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
                    use std::os::windows::ffi::OsStringExt;
                    use std::path::Path;

                    let mut last_exe = String::new();

                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(1000));
                        unsafe {
                            let hwnd = GetForegroundWindow();
                            if hwnd.is_null() { continue; }

                            let mut pid = 0;
                            GetWindowThreadProcessId(hwnd, &mut pid);
                            if pid == 0 { continue; }

                            let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
                            if handle.is_null() { continue; }

                            let mut buffer = [0u16; 1024];
                            let len = GetModuleFileNameExW(handle, std::ptr::null_mut(), buffer.as_mut_ptr(), buffer.len() as u32);
                            winapi::um::handleapi::CloseHandle(handle);

                            if len > 0 {
                                let path_str = std::ffi::OsString::from_wide(&buffer[..len as usize]);
                                if let Some(path) = Path::new(&path_str).file_name() {
                                    if let Some(name) = path.to_str() {
                                        let current_exe = name.to_lowercase();
                                        if current_exe != last_exe {
                                            last_exe = current_exe.clone();
                                            let _ = app_handle.emit("active-window-changed", current_exe);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "dashboard" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(
            tauri_plugin_window_state::StateFlags::SIZE | 
            tauri_plugin_window_state::StateFlags::POSITION |
            tauri_plugin_window_state::StateFlags::DECORATIONS
        ).build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .invoke_handler(tauri::generate_handler![greet, type_text, run_macro, trigger_sys_key, trigger_sys_combo, is_admin])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
