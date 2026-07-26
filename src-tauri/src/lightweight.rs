use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;

use tauri::Manager;

static LIGHTWEIGHT_MODE: AtomicBool = AtomicBool::new(false);
static AUTO_ENTER_GENERATION: AtomicU64 = AtomicU64::new(0);

fn next_auto_enter_generation() -> u64 {
    AUTO_ENTER_GENERATION.fetch_add(1, Ordering::AcqRel) + 1
}

fn is_auto_enter_generation_current(generation: u64) -> bool {
    AUTO_ENTER_GENERATION.load(Ordering::Acquire) == generation
}

fn effective_auto_enter_delay_minutes(settings: &crate::settings::AppSettings) -> Option<u32> {
    if !settings.minimize_to_tray_on_close || !settings.auto_lightweight_mode {
        return None;
    }

    Some(settings.auto_lightweight_delay_minutes.clamp(
        crate::settings::MIN_AUTO_LIGHTWEIGHT_DELAY_MINUTES,
        crate::settings::MAX_AUTO_LIGHTWEIGHT_DELAY_MINUTES,
    ))
}

pub fn cancel_scheduled_auto_enter() {
    next_auto_enter_generation();
}

pub fn schedule_auto_enter(app: &tauri::AppHandle, delay_minutes: u32) {
    let generation = next_auto_enter_generation();
    let app = app.clone();
    let delay_minutes = delay_minutes.clamp(
        crate::settings::MIN_AUTO_LIGHTWEIGHT_DELAY_MINUTES,
        crate::settings::MAX_AUTO_LIGHTWEIGHT_DELAY_MINUTES,
    );

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(u64::from(delay_minutes) * 60)).await;

        if !is_auto_enter_generation_current(generation) || is_lightweight_mode() {
            return;
        }

        let settings = crate::settings::get_settings();
        if effective_auto_enter_delay_minutes(&settings).is_none() {
            return;
        }

        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        if window.is_visible().unwrap_or(true) || !is_auto_enter_generation_current(generation) {
            return;
        }

        if let Err(error) = enter_lightweight_mode(&app) {
            log::error!("自动进入轻量模式失败: {error}");
        }
    });
}

pub fn enter_lightweight_mode(app: &tauri::AppHandle) -> Result<(), String> {
    cancel_scheduled_auto_enter();
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_skip_taskbar(true);
        }
    }
    #[cfg(target_os = "macos")]
    {
        crate::tray::apply_tray_policy(app, false);
    }

    if let Some(window) = app.get_webview_window("main") {
        crate::save_window_state_before_exit(app);
        window
            .destroy()
            .map_err(|e| format!("销毁主窗口失败: {e}"))?;
    }
    // else: already in lightweight mode or window not found, just set the flag

    LIGHTWEIGHT_MODE.store(true, Ordering::Release);
    crate::tray::refresh_tray_menu(app);
    log::info!("进入轻量模式");
    Ok(())
}

pub fn exit_lightweight_mode(app: &tauri::AppHandle) -> Result<(), String> {
    cancel_scheduled_auto_enter();
    use tauri::WebviewWindowBuilder;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(target_os = "linux")]
        {
            crate::linux_fix::nudge_main_window(window.clone());
        }
        #[cfg(target_os = "windows")]
        {
            let _ = window.set_skip_taskbar(false);
        }
        #[cfg(target_os = "macos")]
        {
            crate::tray::apply_tray_policy(app, true);
        }
        LIGHTWEIGHT_MODE.store(false, Ordering::Release);
        crate::tray::refresh_tray_menu(app);
        log::info!("退出轻量模式");
        return Ok(());
    }

    let window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .ok_or("主窗口配置未找到")?;

    WebviewWindowBuilder::from_config(app, window_config)
        .map_err(|e| format!("加载主窗口配置失败: {e}"))?
        .build()
        .map_err(|e| format!("创建主窗口失败: {e}"))?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(target_os = "linux")]
        {
            crate::linux_fix::nudge_main_window(window.clone());
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_skip_taskbar(false);
        }
    }
    #[cfg(target_os = "macos")]
    {
        crate::tray::apply_tray_policy(app, true);
    }

    LIGHTWEIGHT_MODE.store(false, Ordering::Release);
    crate::tray::refresh_tray_menu(app);
    log::info!("退出轻量模式");
    Ok(())
}

pub fn is_lightweight_mode() -> bool {
    LIGHTWEIGHT_MODE.load(Ordering::Acquire)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auto_enter_requires_both_settings_and_clamps_delay() {
        let mut settings = crate::settings::AppSettings::default();
        assert_eq!(effective_auto_enter_delay_minutes(&settings), None);

        settings.auto_lightweight_mode = true;
        settings.auto_lightweight_delay_minutes = 0;
        assert_eq!(
            effective_auto_enter_delay_minutes(&settings),
            Some(crate::settings::MIN_AUTO_LIGHTWEIGHT_DELAY_MINUTES)
        );

        settings.auto_lightweight_delay_minutes = u32::MAX;
        assert_eq!(
            effective_auto_enter_delay_minutes(&settings),
            Some(crate::settings::MAX_AUTO_LIGHTWEIGHT_DELAY_MINUTES)
        );

        settings.minimize_to_tray_on_close = false;
        assert_eq!(effective_auto_enter_delay_minutes(&settings), None);
    }

    #[test]
    fn advancing_generation_invalidates_pending_timer() {
        let generation = next_auto_enter_generation();
        assert!(is_auto_enter_generation_current(generation));

        cancel_scheduled_auto_enter();
        assert!(!is_auto_enter_generation_current(generation));
    }
}
