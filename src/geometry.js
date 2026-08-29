'use strict';
/**
 * Layout and hover rules, with no dependency on Electron.
 * Kept separate so it can be tested: this is the part where a one pixel
 * mistake either makes the widget impossible to open, or makes it pop up
 * constantly.
 */

const G = {
  pillWidth: 92,
  windowWidth: 700,
  ringToLabel: 10,
  hotEdge: 4,          // width of the trigger strip, in pixels
  hideGrace: 380,      // grace period before hiding, in ms
  keepAliveLeft: 460,  // the panel lives to the left of the pill
  keepAliveMargin: 44
};

/**
 * Density steps. The first one that fits the available height wins.
 * An account exposing six quotas on a laptop screen has to stay readable
 * rather than run off the bottom of the display.
 */
const STEPS = [
  { ring: 60, label: 22, rowGap: 26, pillPadding: 22, windowPadding: 90 },
  { ring: 60, label: 22, rowGap: 18, pillPadding: 18, windowPadding: 48 },
  { ring: 52, label: 20, rowGap: 14, pillPadding: 16, windowPadding: 32 },
  { ring: 44, label: 18, rowGap: 10, pillPadding: 14, windowPadding: 20 },
  { ring: 38, label: 16, rowGap: 8, pillPadding: 12, windowPadding: 14 }
];

function measure(step, rows) {
  const pill = rows * (step.ring + G.ringToLabel + step.label) +
    Math.max(0, rows - 1) * step.rowGap + 2 * step.pillPadding;
  return { ...step, rows, pillHeight: pill, windowHeight: pill + 2 * step.windowPadding };
}

/** The layout chosen for this many rings on this screen. */
function layout(workArea, rows) {
  const available = workArea && workArea.height ? workArea.height : 1080;
  for (const step of STEPS) {
    const m = measure(step, rows);
    if (m.windowHeight <= available) return m;
  }
  return measure(STEPS[STEPS.length - 1], rows);
}

/** Window placement: flush against the right edge, anchored vertically. */
function boundsForDisplay(workArea, rows, verticalAnchor) {
  const m = layout(workArea, rows);
  const slack = Math.max(0, workArea.height - m.windowHeight);
  return {
    x: Math.round(workArea.x + workArea.width - G.windowWidth),
    y: Math.round(workArea.y + slack * verticalAnchor),
    width: G.windowWidth,
    height: Math.min(m.windowHeight, workArea.height)
  };
}

/** The vertical band the pill actually occupies, in screen coordinates. */
function pillBand(workArea, rows, verticalAnchor) {
  const m = layout(workArea, rows);
  const b = boundsForDisplay(workArea, rows, verticalAnchor);
  const top = b.y + m.windowPadding;
  return {
    top,
    bottom: top + m.pillHeight,
    left: b.x + b.width - G.pillWidth,
    right: b.x + b.width
  };
}

/**
 * A display whose right edge touches another display has no real edge there:
 * triggering on it would make the widget pop up in the middle of a dual
 * monitor desktop.
 */
function isOuterRightEdge(display, all) {
  const right = display.bounds.x + display.bounds.width;
  return !all.some((d) =>
    d.id !== display.id &&
    Math.abs(d.bounds.x - right) <= 2 &&
    d.bounds.y < display.bounds.y + display.bounds.height &&
    d.bounds.y + d.bounds.height > display.bounds.y);
}

/** Is the cursor inside the right edge trigger strip? */
function inHotZone(cursor, workArea, rows, verticalAnchor) {
  const band = pillBand(workArea, rows, verticalAnchor);
  return cursor.x >= band.right - G.hotEdge &&
    cursor.y >= band.top && cursor.y <= band.bottom;
}

/** Once open, the widget stays as long as the cursor is inside this area. */
function insideKeepAlive(cursor, winBounds, rows, workArea) {
  const m = layout(workArea || { height: winBounds.height }, rows);
  const pillLeft = winBounds.x + winBounds.width - G.pillWidth;
  const top = winBounds.y + m.windowPadding;
  const bottom = top + m.pillHeight;
  return cursor.x >= pillLeft - G.keepAliveLeft &&
    cursor.x <= winBounds.x + winBounds.width &&
    cursor.y >= top - G.keepAliveMargin &&
    cursor.y <= bottom + G.keepAliveMargin;
}

/**
 * Which display the widget belongs on right now.
 *
 * Three cases, and the third is the one that bites: following the mouse, a
 * chosen display, and a chosen display that has just been unplugged. A widget
 * pinned to a screen that no longer exists would be positioned off the desktop
 * and never seen again, so an unknown id always falls back to the primary.
 *
 * @param {{displays: Array, primaryId: any, cursorPoint: {x,y}|null,
 *          follow: boolean, preferredId: any}} options
 */
function pickDisplay({ displays, primaryId, cursorPoint, follow, preferredId }) {
  const list = displays || [];
  if (!list.length) return null;
  const primary = list.find((d) => d.id === primaryId) || list[0];

  if (follow && cursorPoint) {
    const under = list.find((d) => {
      const b = d.bounds;
      return cursorPoint.x >= b.x && cursorPoint.x < b.x + b.width &&
        cursorPoint.y >= b.y && cursorPoint.y < b.y + b.height;
    });
    // Only a real outer edge is worth moving to; the seam between two screens
    // would put the widget in the middle of the desktop.
    if (under && isOuterRightEdge(under, list)) return under;
    return null;   // nothing to do: leave the widget where it is
  }

  if (preferredId && preferredId !== 'primary') {
    const chosen = list.find((d) => String(d.id) === String(preferredId));
    if (chosen) return chosen;
  }
  return primary;
}

/**
 * Are two window rectangles the same?
 *
 * Repositioning a window emits a display-metrics-changed event, which is
 * handled by repositioning the window. Without this comparison the two feed
 * each other several times a second, for ever.
 */
function sameBounds(a, b) {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

module.exports = {
  G, STEPS, layout, boundsForDisplay, pillBand,
  isOuterRightEdge, inHotZone, insideKeepAlive, pickDisplay, sameBounds
};
