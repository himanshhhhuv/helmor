//! helmor CLI — workspace and session management from the terminal.
//!
//! Reuses the same Rust domain logic as the Tauri GUI, reading from / writing
//! to the same SQLite database and worktree layout.
//!
//! Cargo binary name is `helmor-cli` (to avoid conflicting with the Tauri GUI
//! binary). The install process copies it as `helmor` to the user's PATH.
//!
//! The CLI body lives in `helmor_lib::cli` so it can reach crate-private
//! domain logic. This binary is just the entry point.

use std::process::ExitCode;

fn main() -> ExitCode {
    helmor_lib::cli::run()
}
