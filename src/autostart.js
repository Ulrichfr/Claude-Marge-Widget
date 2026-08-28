'use strict';
/**
 * Start at login, and restart on demand, on each platform's own terms.
 *
 * The important property: turning "start at login" off must not kill the
 * widget you are currently using, and quitting from the menu must actually
 * quit rather than being undone by the system a second later.
 */

const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const LABEL = 'com.claudemarge.widget';
const UNIT = 'claude-marge.service';
const isMac = process.platform === 'darwin';

const uid = () => String(process.getuid ? process.getuid() : 0);
const plistPath = () =>
  path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

function run(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore']
  });
}

/** Fire and forget, detached, so the command survives us restarting. */
function detach(command) {
  spawn('/bin/sh', ['-c', command], { detached: true, stdio: 'ignore' }).unref();
}

/** Is the widget registered to start at login? null when we cannot tell. */
function isEnabled() {
  try {
    if (isMac) {
      // A disabled service keeps running; it simply is not started at login.
      const disabled = run('launchctl', ['print-disabled', `gui/${uid()}`]);
      const line = disabled.split('\n').find((l) => l.includes(LABEL));
      if (line && /true/.test(line)) return false;
      return require('fs').existsSync(plistPath());
    }
    return run('systemctl', ['--user', 'is-enabled', UNIT]).trim() === 'enabled';
  } catch (_) {
    return null;
  }
}

/** Turn start-at-login on or off without disturbing the running widget. */
function setEnabled(on) {
  try {
    if (isMac) {
      run('launchctl', [on ? 'enable' : 'disable', `gui/${uid()}/${LABEL}`]);
    } else {
      run('systemctl', ['--user', on ? 'enable' : 'disable', UNIT]);
    }
    return true;
  } catch (_) {
    return false;
  }
}

/** Relaunch the widget through the supervisor, so it comes back on its own. */
function restartNow() {
  if (isMac) detach(`launchctl kickstart -k gui/${uid()}/${LABEL}`);
  else detach(`systemctl --user restart ${UNIT}`);
}

module.exports = { isEnabled, setEnabled, restartNow, LABEL, UNIT };
