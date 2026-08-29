#!/usr/bin/env python3
"""What the widget actually costs, broken down by process.

    python3 tools/cpu-cost.py [seconds]

The trap this exists to avoid: on macOS, `ps -o time=` prints MM:SS.ss, two
fields, not HH:MM:SS. Parsing it as three fields multiplies the seconds by 60,
and a widget using half a second of CPU reads as thirty. That mistake cost a
night of believing a fix had saved sixty per cent of a core; the real figure
was a fifth of one per cent, before and after.

Resolution is one second per process, so short windows read as zero. Use 240
seconds or more, and do not restart the widget during the window: the process
list is captured once, and new pids would silently drop out of the total.
"""
import subprocess, time, re, sys

WINDOW = int(sys.argv[1]) if len(sys.argv) > 1 else 240

def pids():
    out = subprocess.run(["pgrep", "-f", r"\.claude-marge"],
                         capture_output=True, text=True).stdout.split()
    return [p for p in out if p.isdigit()]

def role(pid):
    cmd = subprocess.run(["ps", "-o", "command=", "-p", pid],
                         capture_output=True, text=True).stdout
    m = re.search(r"--type=([a-z-]+)", cmd)
    return m.group(1) if m else "main"

def cpu(pid):
    t = subprocess.run(["ps", "-o", "time=", "-p", pid],
                       capture_output=True, text=True).stdout.strip()
    if not t:
        return None
    parts = [float(x) for x in t.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0.0)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]

ps = pids()
roles = {p: role(p) for p in ps}
before = {p: cpu(p) for p in ps}
time.sleep(WINDOW)
after = {p: cpu(p) for p in ps}

print(f"  fenetre: {WINDOW} s")
total = 0.0
for p in ps:
    if before[p] is None or after[p] is None:
        print(f"  {p:<7} {roles[p]:<16} disparu pendant la mesure")
        continue
    d = after[p] - before[p]
    total += d
    print(f"  {p:<7} {roles[p]:<16} {d:6.0f} s  ->  {d/WINDOW*100:5.1f} %")
print(f"  {'TOTAL':<24} {total:6.0f} s  ->  {total/WINDOW*100:5.1f} %")
