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
      '--crit': t.crit
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
