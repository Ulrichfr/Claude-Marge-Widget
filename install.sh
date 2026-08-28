#!/usr/bin/env bash
# Claude Marge Widget - one-command installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/Ulrichfr/Claude-Marge-Widget/main/install.sh | bash
#
# Installs into ~/.claude-marge, registers a login item, and starts the widget.
# Override the location with MARGE_DIR=/some/path.

set -euo pipefail

REPO="https://github.com/Ulrichfr/Claude-Marge-Widget.git"
APP_DIR="${MARGE_DIR:-$HOME/.claude-marge}"
LABEL="com.claudemarge.widget"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
fail() { printf '\033[31m  %s\033[0m\n' "$1" >&2; exit 1; }

bold "Claude Marge Widget"
echo

case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux)  OS=linux ;;
  *)      fail "Unsupported system: $(uname -s). macOS and Linux only." ;;
esac
info "System: $OS"

# --- Node ---------------------------------------------------------------------
# nvm installs node outside the PATH of a non-interactive shell, so look there too.
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi
command -v node >/dev/null 2>&1 || fail "Node.js is required. Install it from https://nodejs.org and run this again."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18 or newer is required (found $(node -v))."
info "Node: $(node -v)"

command -v git >/dev/null 2>&1 || fail "git is required."

# --- Source -------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  info "Updating $APP_DIR"
  git -C "$APP_DIR" pull --quiet --ff-only || fail "Could not update $APP_DIR. Move it aside and retry."
else
  [ -e "$APP_DIR" ] && fail "$APP_DIR exists and is not a git checkout. Move it aside and retry."
  info "Cloning into $APP_DIR"
  git clone --quiet --depth 1 "$REPO" "$APP_DIR"
fi

info "Installing dependencies (this downloads Electron, about 100 MB)"
( cd "$APP_DIR" && npm install --silent --no-audit --no-fund )

info "Running the test suite"
( cd "$APP_DIR" && npm test >/dev/null ) || fail "Tests failed. Please open an issue rather than running a broken widget."

# --- Autostart ----------------------------------------------------------------
if [ "$OS" = mac ]; then
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  sed "s|__APP_DIR__|$APP_DIR|g" \
    "$APP_DIR/install/com.claudemarge.widget.plist.template" > "$PLIST"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  sleep 1
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  info "Login item installed: $PLIST"
else
  UNIT="$HOME/.config/systemd/user/claude-marge.service"
  mkdir -p "$HOME/.config/systemd/user"
  sed "s|__APP_DIR__|$APP_DIR|g" \
    "$APP_DIR/install/claude-marge.service.template" > "$UNIT"
  systemctl --user daemon-reload
  systemctl --user enable --now claude-marge.service
  info "systemd user service installed: $UNIT"
fi

# --- Did it find a token? -----------------------------------------------------
echo
sleep 4
STATE="$( cd "$APP_DIR" && node src/usage.js 2>/dev/null | node -e '
let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{
  try{const d=JSON.parse(s);
    console.log(d.ok ? "ok "+d.gauges.map(g=>g.title+" "+g.percent+"%").join(", ") : "none "+d.reason);
  }catch(e){console.log("none unreadable")}})' )"

bold "Installed."
case "$STATE" in
  ok*) info "Reading your real limits: ${STATE#ok }" ;;
  *)   info "No Claude session found yet on this machine."
       info "Run 'claude' once in a terminal and sign in. The widget picks it up"
       info "within a minute, no restart needed." ;;
esac
echo
info "Move your mouse to the right edge of the screen, halfway down."
info "Uninstall: bash $APP_DIR/uninstall.sh"
