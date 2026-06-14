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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, type_text, run_macro, trigger_sys_key, trigger_sys_combo])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
