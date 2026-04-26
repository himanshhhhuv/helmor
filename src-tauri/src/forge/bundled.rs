//! Resolves paths to bundled forge CLIs (`gh`, `glab`) shipped inside the
//! `.app` bundle's `Resources/vendor/` tree.
//!
//! Paths are resolved once at app startup (`init`) and cached in a
//! `OnceLock`, so subsequent lookups never touch the filesystem and never
//! mutate `std::env`. Tests / dev can still override via the
//! `HELMOR_GH_BIN_PATH` / `HELMOR_GLAB_BIN_PATH` env vars.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const GH_PATH_ENV: &str = "HELMOR_GH_BIN_PATH";
pub const GLAB_PATH_ENV: &str = "HELMOR_GLAB_BIN_PATH";

#[derive(Debug, Default, Clone)]
pub struct BundledForgeCliPaths {
    pub gh: Option<PathBuf>,
    pub glab: Option<PathBuf>,
}

static BUNDLED_PATHS: OnceLock<BundledForgeCliPaths> = OnceLock::new();

/// Resolve bundled paths from the running executable's location and stash
/// them in the global `OnceLock`. Idempotent — safe to call from the Tauri
/// setup hook. Subsequent calls are a no-op.
pub fn init() {
    let _ = BUNDLED_PATHS.set(resolve_from_running_exe());
    let paths = BUNDLED_PATHS.get();
    tracing::info!(
        gh = ?paths.and_then(|p| p.gh.as_deref()),
        glab = ?paths.and_then(|p| p.glab.as_deref()),
        "Resolved bundled forge CLI paths"
    );
}

/// Returns the absolute bundled path for a forge CLI program name, if one
/// is available. Order:
///   1. Explicit env var override (`HELMOR_GH_BIN_PATH` / `HELMOR_GLAB_BIN_PATH`)
///      — used by tests and ad-hoc dev builds.
///   2. The path resolved at startup by `init`.
///   3. `None` (caller falls back to PATH).
pub fn bundled_path_for(program: &str) -> Option<PathBuf> {
    if let Some(env_key) = env_key_for(program) {
        if let Ok(raw) = std::env::var(env_key) {
            let path = PathBuf::from(raw);
            if path.is_file() {
                return Some(path);
            }
        }
    }
    let cached = BUNDLED_PATHS.get()?;
    match program {
        "gh" => cached.gh.clone(),
        "glab" => cached.glab.clone(),
        _ => None,
    }
}

fn env_key_for(program: &str) -> Option<&'static str> {
    match program {
        "gh" => Some(GH_PATH_ENV),
        "glab" => Some(GLAB_PATH_ENV),
        _ => None,
    }
}

fn resolve_from_running_exe() -> BundledForgeCliPaths {
    std::env::current_exe()
        .ok()
        .and_then(|exe| resolve_for_exe(&exe))
        .unwrap_or_default()
}

fn resolve_for_exe(exe: &Path) -> Option<BundledForgeCliPaths> {
    let exe_dir = exe.parent()?;
    let contents_dir = exe_dir.parent()?;
    let resources_dir = contents_dir.join("Resources");

    let gh_name = if cfg!(windows) { "gh.exe" } else { "gh" };
    let glab_name = if cfg!(windows) { "glab.exe" } else { "glab" };

    let gh = resources_dir.join(format!("vendor/gh/{gh_name}"));
    let glab = resources_dir.join(format!("vendor/glab/{glab_name}"));

    Some(BundledForgeCliPaths {
        gh: gh.is_file().then_some(gh),
        glab: glab.is_file().then_some(glab),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_finds_binaries_under_resources_vendor() {
        let root = tempfile::tempdir().unwrap();
        let exe = root.path().join("Helmor.app/Contents/MacOS/Helmor");
        let vendor = root.path().join("Helmor.app/Contents/Resources/vendor");
        std::fs::create_dir_all(vendor.join("gh")).unwrap();
        std::fs::create_dir_all(vendor.join("glab")).unwrap();
        std::fs::write(vendor.join("gh/gh"), "").unwrap();
        std::fs::write(vendor.join("glab/glab"), "").unwrap();

        let paths = resolve_for_exe(&exe).unwrap();

        assert_eq!(
            paths.gh.unwrap(),
            root.path()
                .join("Helmor.app/Contents/Resources/vendor/gh/gh")
        );
        assert_eq!(
            paths.glab.unwrap(),
            root.path()
                .join("Helmor.app/Contents/Resources/vendor/glab/glab")
        );
    }

    #[test]
    fn resolve_returns_none_when_binaries_missing() {
        let root = tempfile::tempdir().unwrap();
        let exe = root.path().join("Helmor.app/Contents/MacOS/Helmor");
        let paths = resolve_for_exe(&exe).unwrap();
        assert!(paths.gh.is_none());
        assert!(paths.glab.is_none());
    }
}
