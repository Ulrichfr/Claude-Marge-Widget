'use strict';
/* Themes, shared by the widget and the settings window so the two never
   disagree about what the app looks like.

   Each theme carries the widget surfaces and the four gauge tones. The tones
   are semantic, never decorative: green means room left, red means the ceiling
   is close. Light themes get darker, denser tones because a pale yellow on
   white says nothing. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.THEMES = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  const THEMES = {
    midnight: {
      name: 'Midnight', dark: true,
      pill: '#060607', panel: '#0B0B0C', face: '#232326', faceHot: '#2F2F33',
      ink: '#F7F7F8', inkDim: 'rgba(247, 247, 248, 0.46)',
      track: 'rgba(255, 255, 255, 0.11)', shadow: 'rgba(0, 0, 0, 0.42)',
      ok: '#34D399', warm: '#E9E11F', hot: '#FF5B2B', crit: '#FF3B30',
      ui: { bg: '#0A0A0B', sheet: '#111113', accent: '#FF5B2B' }
    },

    graphite: {
      name: 'Graphite', dark: true,
      pill: '#141417', panel: '#1B1B1F', face: '#2E2E34', faceHot: '#3B3B42',
      ink: '#F2F2F4', inkDim: 'rgba(242, 242, 244, 0.48)',
      track: 'rgba(255, 255, 255, 0.13)', shadow: 'rgba(0, 0, 0, 0.4)',
      ok: '#4ADE80', warm: '#FACC15', hot: '#FB923C', crit: '#F87171',
      ui: { bg: '#161619', sheet: '#1E1E23', accent: '#A5B4FC' }
    },

    nordic: {
      name: 'Nordic', dark: true,
      pill: '#242933', panel: '#2E3440', face: '#3B4252', faceHot: '#4C566A',
      ink: '#ECEFF4', inkDim: 'rgba(236, 239, 244, 0.5)',
      track: 'rgba(236, 239, 244, 0.14)', shadow: 'rgba(10, 14, 20, 0.5)',
      ok: '#A3BE8C', warm: '#EBCB8B', hot: '#D08770', crit: '#BF616A',
      ui: { bg: '#232831', sheet: '#2B313C', accent: '#88C0D0' }
    },

    ember: {
      name: 'Ember', dark: true,
      pill: '#150F0C', panel: '#1C1411', face: '#33241C', faceHot: '#433024',
      ink: '#FBF0E6', inkDim: 'rgba(251, 240, 230, 0.48)',
      track: 'rgba(251, 240, 230, 0.12)', shadow: 'rgba(20, 8, 0, 0.5)',
      ok: '#7DD3A0', warm: '#F5C451', hot: '#FF8A3D', crit: '#F2545B',
      ui: { bg: '#130E0B', sheet: '#1B1310', accent: '#FF8A3D' }
    },

    matcha: {
      name: 'Matcha', dark: true,
      pill: '#0D1512', panel: '#121C18', face: '#1F2E27', faceHot: '#2A3D34',
      ink: '#E8F3EC', inkDim: 'rgba(232, 243, 236, 0.48)',
      track: 'rgba(232, 243, 236, 0.12)', shadow: 'rgba(0, 14, 9, 0.5)',
      ok: '#5EE9A0', warm: '#D9E04F', hot: '#F79A4A', crit: '#F2606B',
      ui: { bg: '#0B120F', sheet: '#111A16', accent: '#5EE9A0' }
    },

    lilac: {
      name: 'Lilac', dark: true,
      pill: '#131020', panel: '#191529', face: '#282039', faceHot: '#352B4C',
      ink: '#EFEBFA', inkDim: 'rgba(239, 235, 250, 0.5)',
      track: 'rgba(239, 235, 250, 0.13)', shadow: 'rgba(8, 4, 22, 0.52)',
      ok: '#6EE7C7', warm: '#E5D14F', hot: '#F98A5E', crit: '#F76A87',
      ui: { bg: '#110E1C', sheet: '#181428', accent: '#C4B5FD' }
    },

    daylight: {
      name: 'Daylight', dark: false,
      pill: '#FFFFFF', panel: '#FFFFFF', face: '#EDEDF0', faceHot: '#E0E0E6',
      ink: '#16161A', inkDim: 'rgba(22, 22, 26, 0.5)',
      track: 'rgba(22, 22, 26, 0.10)', shadow: 'rgba(20, 20, 30, 0.16)',
      ok: '#0F9D63', warm: '#B08900', hot: '#E2551F', crit: '#D02B20',
      ui: { bg: '#F2F2F5', sheet: '#FFFFFF', accent: '#E2551F' }
    },

    sand: {
      name: 'Sand', dark: false,
      pill: '#FBF6EC', panel: '#FDFAF3', face: '#EDE3D1', faceHot: '#E2D5BD',
      ink: '#2A2118', inkDim: 'rgba(42, 33, 24, 0.52)',
      track: 'rgba(42, 33, 24, 0.11)', shadow: 'rgba(80, 60, 30, 0.16)',
      ok: '#2F8F63', warm: '#A17700', hot: '#CE5B22', crit: '#BF3A2B',
      ui: { bg: '#F3EADA', sheet: '#FDFAF3', accent: '#CE5B22' }
    },
    glass: {
      name: 'Liquid Glass', dark: true,
      pill: 'rgba(28, 28, 34, 0.34)', panel: 'rgba(28, 28, 34, 0.40)',
      face: 'rgba(255, 255, 255, 0.14)', faceHot: 'rgba(255, 255, 255, 0.24)',
      ink: '#FFFFFF', inkDim: 'rgba(255, 255, 255, 0.66)',
      track: 'rgba(255, 255, 255, 0.2)', shadow: 'rgba(0, 0, 0, 0.3)',
      ok: '#5BE7A9', warm: '#FFE34D', hot: '#FF8A4C', crit: '#FF5A5A',
      // Apple's material is blur plus saturation plus a lit rim: without the
      // rim it reads as a grey sheet, and without the saturation the colours
      // behind it go flat.
      blur: 34, saturate: 190, sheen: true,
      border: 'rgba(255, 255, 255, 0.46)',
      radiusPill: 30, radiusPanel: 26,
      ui: { bg: '#1B1B20', sheet: '#26262D', accent: '#7DD3FC' }
    },

    winxp: {
      name: 'Windows XP', dark: false,
      pill: '#ECE9D8', panel: '#ECE9D8', face: '#FFFFFF', faceHot: '#E3EFFB',
      ink: '#0B0B0B', inkDim: 'rgba(11, 11, 11, 0.55)',
      track: 'rgba(11, 11, 11, 0.14)', shadow: 'rgba(10, 36, 106, 0.28)',
      ok: '#3F9C35', warm: '#C9A227', hot: '#E07B18', crit: '#C4302B',
      border: '#0A246A', radiusPill: 8, radiusPanel: 8,
      font: 'Tahoma, Verdana, "DejaVu Sans", sans-serif',
      // Luna without its blue title bar is just a beige box.
      header: {
        bg: 'linear-gradient(180deg, #4C93E8 0%, #2266D4 8%, #0A3EAF 46%, #0A2E8C 100%)',
        ink: '#FFFFFF'
      },
      ui: { bg: '#D6E5F5', sheet: '#ECE9D8', accent: '#245EDC' }
    },

    win11: {
      name: 'Windows 11', dark: true,
      pill: 'rgba(32, 32, 32, 0.86)', panel: 'rgba(32, 32, 32, 0.9)',
      face: '#2D2D2D', faceHot: '#3A3A3A',
      ink: '#FFFFFF', inkDim: 'rgba(255, 255, 255, 0.55)',
      track: 'rgba(255, 255, 255, 0.12)', shadow: 'rgba(0, 0, 0, 0.44)',
      ok: '#6CCB5F', warm: '#FCE100', hot: '#FF8C00', crit: '#E81123',
      blur: 20, saturate: 120,
      border: 'rgba(255, 255, 255, 0.09)', radiusPill: 8, radiusPanel: 8,
      font: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
      ui: { bg: '#202020', sheet: '#2B2B2B', accent: '#0078D4' }
    },

    ubuntu: {
      name: 'Ubuntu', dark: true,
      pill: '#2C001E', panel: '#380024', face: '#4A0F33', faceHot: '#5C1742',
      ink: '#FFFFFF', inkDim: 'rgba(255, 255, 255, 0.58)',
      track: 'rgba(255, 255, 255, 0.14)', shadow: 'rgba(20, 0, 14, 0.5)',
      ok: '#0E8420', warm: '#F99B11', hot: '#E95420', crit: '#C7162B',
      border: 'rgba(233, 84, 32, 0.35)', radiusPill: 10, radiusPanel: 10,
      font: 'Ubuntu, "Ubuntu Sans", Cantarell, system-ui, sans-serif',
      header: { bg: 'linear-gradient(180deg, #77216F 0%, #5E2750 100%)', ink: '#FFFFFF' },
      ui: { bg: '#2C001E', sheet: '#3B0028', accent: '#E95420' }
    }
  };

  const DEFAULT = 'midnight';
  const ids = Object.keys(THEMES);

  /** Never return undefined: an unknown id must still paint something. */
  function get(id) {
    return THEMES[id] || THEMES[DEFAULT];
  }

  /** The widget's custom properties, ready to be written onto :root. */
  function widgetVars(id) {
    const t = get(id);
    return {
      '--pill-bg': t.pill,
      '--panel-bg': t.panel,
      '--ring-face': t.face,
      '--ring-face-hot': t.faceHot,
      '--ink': t.ink,
      '--ink-dim': t.inkDim,
      '--track': t.track,
      '--shadow': t.shadow,
      '--ok': t.ok,
      '--warm': t.warm,
      '--hot': t.hot,
      '--crit': t.crit,
      // Optional material properties. Absent means "behave like a flat theme",
      // which is why each one has a neutral default rather than being skipped.
      '--blur': t.blur ? `${t.blur}px` : '0px',
      '--saturate': t.saturate ? `${t.saturate}%` : '100%',
      '--border': t.border || 'transparent',
      '--radius-pill': `${t.radiusPill || 32}px`,
      '--radius-panel': `${t.radiusPanel || 24}px`,
      '--sheen': t.sheen ? '1' : '0',
      '--font': t.font || 'inherit',
      '--header-bg': (t.header && t.header.bg) || 'transparent',
      '--header-ink': (t.header && t.header.ink) || 'var(--ink)'
    };
  }

  /** The settings window's own surfaces. Overlays come from the light flag. */
  function uiVars(id) {
    const t = get(id);
    return {
      '--bg': t.ui.bg,
      '--sheet': t.ui.sheet,
      '--ink': t.ink,
      '--accent': t.ui.accent,
      '--ok': t.ok
    };
  }

  return { THEMES, DEFAULT, ids, get, widgetVars, uiVars };
}));
