#!/usr/bin/env bash
# Removes Claude Marge Widget: login item, files, config. Nothing else is touched.
set -euo pipefail
APP_DIR="${MARGE_DIR:-$HOME/.claude-marge}"
LABEL="com.claudemarge.widget"

if [ "$(uname -s)" = Darwin ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
else
  systemctl --user disable --now claude-marge.service 2>/dev/null || true
  rm -f "$HOME/.config/systemd/user/claude-marge.service"
  systemctl --user daemon-reload 2>/dev/null || true
fi
pkill -f "claude-marge" 2>/dev/null || true
rm -rf "$APP_DIR" "$HOME/.config/claude-marge"
echo "Claude Marge Widget removed. Your Claude credentials were never touched."
