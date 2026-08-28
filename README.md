<div align="center">

# Claude Marge Widget

**Your Claude usage limits, Pro and Max, at the edge of the screen.**
Touch the right edge with your mouse and it slides in. Move away and it is gone.

<img src="docs/hero.png" alt="The widget revealed at the right edge of the screen, showing session, weekly and per-model limits" width="820">

[![macOS](https://img.shields.io/badge/macOS-12%2B-000?logo=apple&logoColor=white)](#compatibility)
[![Linux](https://img.shields.io/badge/Linux-X11-000?logo=linux&logoColor=white)](#compatibility)
[![Node](https://img.shields.io/badge/Node-18%2B-000?logo=nodedotjs&logoColor=white)](#compatibility)
[![License](https://img.shields.io/badge/License-MIT-000)](LICENSE)

[Français](README.fr.md)

</div>

---

## Install in one command

```bash
curl -fsSL https://raw.githubusercontent.com/Ulrichfr/Claude-Marge-Widget/main/install.sh | bash
```

That is the whole setup. The script checks Node, clones into `~/.claude-marge`,
installs dependencies, runs the test suite, registers a login item, starts the
widget, and tells you whether it found your Claude session.

Then move your mouse to the **right edge of the screen, halfway down**.

Prefer to read the script before piping it into a shell? Fair enough:

```bash
git clone https://github.com/Ulrichfr/Claude-Marge-Widget.git ~/.claude-marge
cd ~/.claude-marge && npm install && npm test
bash install.sh
```

Removing it is one command too, and it never touches your Claude credentials:

```bash
bash ~/.claude-marge/uninstall.sh
```

---

## One ring per quota, because they are not the same quota

A Claude subscription does not have a single limit. There is a rolling five hour session
window, a weekly budget across every model, and a separate weekly budget for
each heavy model. The one that stops you is rarely the one you were watching.

<img src="docs/models.png" alt="Five rings: session, all models, Opus, Sonnet and Fable, each with its own percentage" width="760">

The list is built from what your account actually exposes, so you get two rings
or five depending on your plan. A limit the API does not return is left out
rather than drawn as a misleading zero, and the **active limit** badge marks the
one that will cut you off first.

Colours follow the headroom, not the model: green below 35%, yellow to 69%,
orange to 89%, red beyond.

<img src="docs/states.png" alt="The same pill at 12%, 58% and 96% usage, green then yellow then red" width="380">

---

## Seven languages, picked automatically

English by default, and your system language when it is one of French, Spanish,
German, Italian, Chinese or Japanese. Nothing to configure.

<img src="docs/languages.png" alt="The panel rendered in French, Spanish, German, Italian, Chinese and Japanese" width="720">

Adding a language means adding one object to [`src/i18n.js`](src/i18n.js).
Pull requests welcome.

---

## How it works

**Where the numbers come from.** The same endpoint Claude Code itself calls:

```
GET https://api.anthropic.com/api/oauth/usage
```

These are your real limits, not an estimate reconstructed from token counts.

**Where the token comes from.** Wherever Claude Code keeps it: the Keychain on
macOS, `~/.claude/.credentials.json` elsewhere. It is never copied, never cached
on disk, and never sent anywhere other than `api.anthropic.com`.

The widget never refreshes the token itself. Rotating the refresh token would
invalidate your Claude Code session, so when it has expired the widget says so
and you simply open Claude Code once.

**How the hover works.** The window is *always* click-through. It never takes
focus and never swallows a click, even while visible. Hover is derived from
sampling the cursor position 22 times a second in the main process, then handed
to the page, which does its own hit-testing. It is the only approach that
behaves identically on macOS and X11.

**How it stays out of the way.** The window is transparent, frameless, has no
shadow, no taskbar entry, and no Dock icon. It resizes itself to the number of
quotas your account exposes, and tightens its layout on short screens instead of
running off the bottom.

---

## Compatibility

| System | State | Notes |
|---|---|---|
| **macOS 12+** (Intel and Apple Silicon) | Supported, tested | Tested on macOS 26.5 arm64. Installs a LaunchAgent. |
| **Linux, X11** | Supported, tested | Installs a systemd user service. |
| **Linux, Wayland** | Partial | Electron cannot position windows under Wayland. The service forces X11; launch manually with `ELECTRON_OZONE_PLATFORM_HINT=x11`. |
| **Windows** | Not supported | The data layer would work, the placement and autostart are not written or tested. Contributions welcome. |

**Plans.** Claude **Pro** and **Claude Max** both expose these limits through the
same endpoint, and the widget reads whatever the account returns: two rings on a
plan with fewer quotas, five on one with more. Developed and tested on Max; Pro
should work identically, and a report either way is welcome.

Requirements: **Node.js 18+**, `git`, and Claude Code signed in.

Two Linux details worth knowing. Without a compositor, transparency falls back
to an opaque black pill instead of blending into the desktop. And the tray icon
needs `libappindicator`; without it the widget still runs, there is simply no
menu.

---

## Configuration

`~/.config/claude-marge/config.json`, reloaded from the tray menu:

```json
{
  "verticalAnchor": 0.45,
  "refreshSeconds": 120,
  "followCursorDisplay": true,
  "alertAt": [80, 95],
  "shortcut": "CommandOrControl+Shift+M"
}
```

`alertAt` raises a desktop notification when a quota crosses one of those marks:
once per level, per quota, per reset window, so a limit you are sitting above
does not notify you every two minutes. Set it to `[]` to stay silent.
`shortcut` toggles the pinned view; set it to `""` to register nothing.

### The tray menu

| Item | What it does |
|---|---|
| Refresh now | Ask the API immediately, whatever the schedule says. |
| Show for 3 seconds | Reveal the widget without reaching for the edge. |
| **Start at login** | Checkbox. Turning it off leaves the running widget alone, it simply will not come back at your next login. |
| **Keep visible** | Pin the widget open, no hovering. Also on a global shortcut, `Cmd/Ctrl+Shift+M` by default. |
| **Restart the widget** | Relaunch through the supervisor, handy after a config change. |
| Open configuration | Reveal `config.json` in the file manager. |
| Reload configuration | Apply the file without restarting. |
| Quit | Really quits. The login item restarts the widget after a crash, never after a deliberate quit. |

Closed it and want it back? `launchctl kickstart gui/$(id -u)/com.claudemarge.widget`
on macOS, `systemctl --user start claude-marge` on Linux.

### The file

`verticalAnchor` is 0 at the top of the screen and 1 at the bottom.
`followCursorDisplay` makes the widget appear on whichever display holds the
mouse. On a multi-monitor setup, only real outer edges trigger it: the seam
between two side-by-side screens never does.

Useful commands:

```bash
npm start                      # hover behaviour
npm run demo                   # stays open, handy for positioning
npm run usage                  # raw quotas as JSON, no interface
npm test                       # 45 tests
tail ~/.claude-marge/widget.log   # one line per state change
```

---

## What is verified

`npm test` runs 45 tests, covering the places where a mistake shows up
immediately.

**Hover geometry, 14 tests.** The right edge of a multi-monitor setup, the
window staying on screen whatever the number of models, and above all the
absence of flicker: the area that keeps the widget open must always contain the
strip that triggers it.

**Quota normalisation, 8 tests.** A missing quota never becomes a displayed
zero, a model exposed twice by the API appears once, an empty response does not
bring the widget down, and a failure is named for what it is rather than blamed
on the network.

**Alerts, 8 tests.** Crossing a threshold speaks once, staying above it stays
quiet, the next level up speaks again, a new reset window arms it afresh, and
the ledger forgets quotas the account stopped exposing.

**Persisted state, 7 tests.** The failure count and the last real reading
survive a restart, a reading older than a day is dropped rather than shown as
current, and a corrupted state file does not bring the widget down.

**Backoff, 8 tests.** Asking too often is what earns an HTTP 429, so the widget
polls every two minutes, doubles the wait after each failure up to fifteen
minutes, obeys `Retry-After` when the server sends one, and does not fetch again
just because you hovered. A failed call never wipes the display: the last real
numbers stay on screen, marked stale, with the reason underneath.

For a render check on a machine with no compositor, or in CI:

```bash
MARGE_CAPTURE=/tmp/widget.png npm run demo
```

---

## Privacy

The widget makes exactly one network call, to `api.anthropic.com`, with your own
token, to read your own usage. No telemetry, no analytics, no third party. The
log records percentages and state changes, never the token.

---

## License and attribution

[MIT](LICENSE). An unofficial personal project, not affiliated with, endorsed
by, or supported by Anthropic. "Claude" is a trademark of Anthropic.
