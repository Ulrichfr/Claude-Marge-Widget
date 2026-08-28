'use strict';
/**
 * Geometrie et regles de survol, sans aucune dependance a Electron.
 * Isole ici pour etre testable : c'est la partie ou une erreur d'un pixel
 * rend le widget impossible a ouvrir, ou au contraire le fait surgir sans arret.
 */

const G = {
  pillWidth: 92,
  windowWidth: 700,
  ringToLabel: 10,
  hotEdge: 4,          // largeur de la bande declencheuse, en pixels
  hideGrace: 380,      // ms de sursis avant disparition
  keepAliveLeft: 460,  // la bulle vit a gauche de la pilule
  keepAliveMargin: 44
};

/**
 * Paliers de densite. Le premier qui tient dans la hauteur disponible gagne.
 * Un compte qui expose six quotas sur un ecran de portable doit rester lisible,
 * pas deborder en bas de l'ecran.
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

/** La disposition retenue pour ce nombre d'anneaux sur cet ecran. */
function layout(workArea, rows) {
  const available = workArea && workArea.height ? workArea.height : 1080;
  for (const step of STEPS) {
    const m = measure(step, rows);
    if (m.windowHeight <= available) return m;
  }
  return measure(STEPS[STEPS.length - 1], rows);
}

/** Position de la fenetre : collee au bord droit, ancree verticalement. */
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

/** La bande verticale reellement occupee par la pilule, en coordonnees ecran. */
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
 * Un ecran dont le bord droit touche un autre ecran n'est pas un vrai bord :
 * y declencher le widget le ferait surgir en plein milieu d'un bureau double.
 */
function isOuterRightEdge(display, all) {
  const right = display.bounds.x + display.bounds.width;
  return !all.some((d) =>
    d.id !== display.id &&
    Math.abs(d.bounds.x - right) <= 2 &&
    d.bounds.y < display.bounds.y + display.bounds.height &&
    d.bounds.y + d.bounds.height > display.bounds.y);
}

/** Le curseur est-il dans la bande declencheuse du bord droit ? */
function inHotZone(cursor, workArea, rows, verticalAnchor) {
  const band = pillBand(workArea, rows, verticalAnchor);
  return cursor.x >= band.right - G.hotEdge &&
    cursor.y >= band.top && cursor.y <= band.bottom;
}

/** Une fois ouvert, le widget reste tant que le curseur est dans cette zone. */
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

module.exports = {
  G, STEPS, layout, boundsForDisplay, pillBand,
  isOuterRightEdge, inHotZone, insideKeepAlive
};
