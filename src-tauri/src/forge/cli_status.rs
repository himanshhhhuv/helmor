//! Forge CLI status plumbing.
//!
//! Probes the bundled `gh` / `glab` to tell the UI whether each CLI is
//! Ready / Unauthenticated / Error, and the AppleScript-driven Connect
//! flow that opens a terminal pre-filled with `gh auth login` /
//! `glab auth login`.

use anyhow::{bail, Context, Result};
use std::time::Duration;

use crate::github_cli;

use super::bundled;
use super::command::{command_detail, run_command, run_command_with_timeout};
use super::types::{ForgeCliStatus, ForgeLabels, ForgeProvider};

const OPEN_TERMINAL_TIMEOUT: Duration = Duration::from_secs(10);

pub fn get_forge_cli_status(provider: ForgeProvider, host: Option<&str>) -> Result<ForgeCliStatus> {
    match provider {
        ForgeProvider::Github => github_status(),
        ForgeProvider::Gitlab => gitlab_status(host.unwrap_or("gitlab.com")),
        ForgeProvider::Unknown => Ok(ForgeCliStatus::Error {
            provider,
            host: host.unwrap_or("unknown").to_string(),
            cli_name: String::new(),
            version: None,
            message: "Unknown forge provider.".to_string(),
        }),
    }
}

pub fn open_forge_cli_auth_terminal(provider: ForgeProvider, host: Option<&str>) -> Result<()> {
    let command = match provider {
        ForgeProvider::Github => format!("{} auth login", bundled_program_token("gh")),
        ForgeProvider::Gitlab => {
            let host = host.unwrap_or("gitlab.com");
            format!(
                "{} auth login --hostname {host}",
                bundled_program_token("glab")
            )
        }
        ForgeProvider::Unknown => bail!("Unknown forge provider."),
    };
    open_terminal_with_command(&command)
}

/// For the AppleScript terminal: emit the absolute bundled path (quoted) so
/// the user runs Helmor's bundled CLI, not a system one. Falls back to the
/// bare program name in dev / when no bundle is available.
fn bundled_program_token(program: &str) -> String {
    match bundled::bundled_path_for(program) {
        Some(path) => shell_single_quote(&path.display().to_string()),
        None => program.to_string(),
    }
}

/// Wrap a value in single quotes safe for /bin/sh, handling embedded
/// single quotes by closing-quote / escaped-quote / re-opening-quote
/// (the standard `'foo'\''bar'` trick). Required because user paths can
/// legitimately contain `'` (e.g. `/Applications/Tom's Stuff/Helmor.app`).
fn shell_single_quote(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('\'');
    for ch in value.chars() {
        if ch == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
}

pub(crate) fn labels_for(provider: ForgeProvider) -> ForgeLabels {
    match provider {
        ForgeProvider::Github => ForgeLabels {
            provider_name: "GitHub".to_string(),
            cli_name: "gh".to_string(),
            change_request_name: "PR".to_string(),
            change_request_full_name: "pull request".to_string(),
            connect_action: "Connect GitHub".to_string(),
        },
        ForgeProvider::Gitlab => ForgeLabels {
            provider_name: "GitLab".to_string(),
            cli_name: "glab".to_string(),
            change_request_name: "MR".to_string(),
            change_request_full_name: "merge request".to_string(),
            connect_action: "Connect GitLab".to_string(),
        },
        ForgeProvider::Unknown => ForgeLabels {
            provider_name: "Git".to_string(),
            cli_name: String::new(),
            change_request_name: "change request".to_string(),
            change_request_full_name: "change request".to_string(),
            connect_action: String::new(),
        },
    }
}

pub(crate) fn github_status() -> Result<ForgeCliStatus> {
    github_status_from(github_cli::get_github_cli_status()?)
}

fn github_status_from(status: github_cli::GithubCliStatus) -> Result<ForgeCliStatus> {
    Ok(match status {
        github_cli::GithubCliStatus::Ready {
            host,
            login,
            version,
            message,
        } => ForgeCliStatus::Ready {
            provider: ForgeProvider::Github,
            host,
            cli_name: "gh".to_string(),
            login,
            version,
            message,
        },
        github_cli::GithubCliStatus::Unauthenticated {
            host,
            version,
            message,
        } => ForgeCliStatus::Unauthenticated {
            provider: ForgeProvider::Github,
            host,
            cli_name: "gh".to_string(),
            version,
            message,
            login_command: "gh auth login".to_string(),
        },
        github_cli::GithubCliStatus::Unavailable { host, message } => ForgeCliStatus::Error {
            provider: ForgeProvider::Github,
            host,
            cli_name: "gh".to_string(),
            version: None,
            message: format!(
                "Bundled GitHub CLI was not found. Reinstall Helmor to recover. ({message})"
            ),
        },
        github_cli::GithubCliStatus::Error {
            host,
            version,
            message,
        } => ForgeCliStatus::Error {
            provider: ForgeProvider::Github,
            host,
            cli_name: "gh".to_string(),
            version,
            message,
        },
    })
}

pub(crate) fn gitlab_status(host: &str) -> Result<ForgeCliStatus> {
    tracing::debug!(host, "Checking GitLab CLI status");
    let version = match run_command("glab", ["--version"]) {
        Ok(output) => Some(parse_glab_version(&output.stdout)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            tracing::warn!(host, "Bundled GitLab CLI not found");
            return Ok(ForgeCliStatus::Error {
                provider: ForgeProvider::Gitlab,
                host: host.to_string(),
                cli_name: "glab".to_string(),
                version: None,
                message: "Bundled GitLab CLI was not found. Reinstall Helmor to recover."
                    .to_string(),
            });
        }
        Err(error) => {
            tracing::warn!(host, error = %error, "Unable to read GitLab CLI version");
            return Ok(ForgeCliStatus::Error {
                provider: ForgeProvider::Gitlab,
                host: host.to_string(),
                cli_name: "glab".to_string(),
                version: None,
                message: format!("Unable to read GitLab CLI version: {error}"),
            });
        }
    };

    match run_command("glab", ["auth", "status", "--hostname", host]) {
        Ok(output) if output.success => {
            let login = parse_glab_login(&output.stderr)
                .or_else(|| parse_glab_login(&output.stdout))
                .unwrap_or_else(|| "authenticated".to_string());
            tracing::debug!(host, login, "GitLab CLI authenticated");
            Ok(ForgeCliStatus::Ready {
                provider: ForgeProvider::Gitlab,
                host: host.to_string(),
                cli_name: "glab".to_string(),
                login: login.clone(),
                version: version.unwrap_or_else(|| "unknown".to_string()),
                message: format!("GitLab CLI ready as {login}."),
            })
        }
        Ok(output) => {
            let detail = command_detail(&output);
            if looks_like_glab_unauthenticated(&detail) {
                tracing::warn!(host, detail = %detail, "GitLab CLI unauthenticated");
                Ok(ForgeCliStatus::Unauthenticated {
                    provider: ForgeProvider::Gitlab,
                    host: host.to_string(),
                    cli_name: "glab".to_string(),
                    version,
                    message: format!(
                        "Run `glab auth login --hostname {host}` to connect GitLab CLI."
                    ),
                    login_command: format!("glab auth login --hostname {host}"),
                })
            } else {
                tracing::warn!(host, detail = %detail, "GitLab CLI auth check failed");
                Ok(ForgeCliStatus::Error {
                    provider: ForgeProvider::Gitlab,
                    host: host.to_string(),
                    cli_name: "glab".to_string(),
                    version,
                    message: format!("GitLab CLI auth check failed: {detail}"),
                })
            }
        }
        Err(error) => {
            tracing::warn!(host, error = %error, "Failed to run GitLab CLI auth check");
            Ok(ForgeCliStatus::Error {
                provider: ForgeProvider::Gitlab,
                host: host.to_string(),
                cli_name: "glab".to_string(),
                version,
                message: format!("GitLab CLI auth check failed: {error}"),
            })
        }
    }
}

#[cfg(target_os = "macos")]
fn open_terminal_with_command(command: &str) -> Result<()> {
    let script = terminal_auth_script(command);
    let output = run_command_with_timeout(
        "osascript",
        ["-e".to_string(), script],
        OPEN_TERMINAL_TIMEOUT,
    )
    .context("Failed to open Terminal")?;
    if !output.success {
        bail!("Failed to open Terminal: {}", output.stderr.trim());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn terminal_auth_script(command: &str) -> String {
    format!(
        r#"set terminalWasRunning to application "Terminal" is running
tell application "Terminal"
    if terminalWasRunning then
        do script "{}"
    else
        activate
        delay 0.2
        if (count of windows) = 0 then
            do script ""
            delay 0.1
        end if
        do script "{}" in selected tab of front window
    end if
    activate
end tell"#,
        applescript_string(command),
        applescript_string(command)
    )
}

#[cfg(not(target_os = "macos"))]
fn open_terminal_with_command(_command: &str) -> Result<()> {
    bail!("Opening a terminal for forge CLI auth is only supported on macOS right now.")
}

fn applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn parse_glab_version(stdout: &str) -> String {
    stdout
        .lines()
        .next()
        .and_then(|line| {
            line.split_whitespace()
                .find(|part| part.chars().next().is_some_and(|c| c.is_ascii_digit()))
        })
        .unwrap_or("unknown")
        .to_string()
}

fn parse_glab_login(text: &str) -> Option<String> {
    for line in text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("Logged in to ") {
            if let Some((_, login)) = rest.rsplit_once(" as ") {
                return Some(login.trim().trim_end_matches('.').to_string());
            }
        }
    }
    None
}

fn looks_like_glab_unauthenticated(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("401")
        || normalized.contains("unauthorized")
        || normalized.contains("no token found")
        || normalized.contains("not logged in")
        || normalized.contains("unauthenticated")
        || normalized.contains("not authenticated")
        || normalized.contains("authentication")
        || normalized.contains("glab auth login")
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn terminal_auth_script_reuses_initial_window_when_terminal_was_not_running() {
        let script = terminal_auth_script("glab auth login --hostname gitlab.com");

        assert!(script.contains("set terminalWasRunning to application \"Terminal\" is running"));
        assert!(script.contains("if terminalWasRunning then"));
        assert!(script.contains("do script \"glab auth login --hostname gitlab.com\""));
        assert!(
            script.contains(
                "do script \"glab auth login --hostname gitlab.com\" in selected tab of front window"
            ),
            "cold-start path must not create a second command window"
        );
    }

    #[test]
    fn shell_single_quote_handles_embedded_single_quotes() {
        assert_eq!(shell_single_quote("/usr/bin/gh"), "'/usr/bin/gh'");
        assert_eq!(
            shell_single_quote("/Apps/Tom's Stuff/Helmor.app/Contents/Resources/vendor/gh/gh"),
            "'/Apps/Tom'\\''s Stuff/Helmor.app/Contents/Resources/vendor/gh/gh'"
        );
        assert_eq!(shell_single_quote("a'b'c"), "'a'\\''b'\\''c'");
    }
}
