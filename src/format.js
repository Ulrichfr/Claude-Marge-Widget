'use strict';
/* Time formatting. Split out because "auto" has to mean the system's own
   habit, not a guess: passing no hour12 at all is what lets the locale
   decide, and passing false is a different thing entirely. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FORMAT = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  /**
   * @param {'auto'|'12'|'24'} setting
   * @returns {Intl.DateTimeFormatOptions} options for toLocaleTimeString
   */
  function timeOptions(setting) {
    const base = { hour: '2-digit', minute: '2-digit' };
    if (setting === '12') return { ...base, hour12: true };
    if (setting === '24') return { ...base, hour12: false, hourCycle: 'h23' };
    return base;   // auto: the locale decides, which is the point of auto
  }

  function formatTime(date, locale, setting) {
    return new Date(date).toLocaleTimeString(locale, timeOptions(setting));
  }

  return { timeOptions, formatTime };
}));
