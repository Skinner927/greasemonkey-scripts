// ==UserScript==
// @name         Unicode font on r/Unicode
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/reddit_r_unicode_font.user.js
// @version      1.0
// @description  Change page to use a proper unicode font
// @match        *://*.reddit.com/r/Unicode/*
// @grant        GM_addStyle
// ==/UserScript==
/*
Unifont: http://unifoundry.com/unifont/index.html
Akkadian and others: http://users.teilar.gr/~g1951d/
Unicode codepoint identifier (and correct font): http://unicode.scarfboy.com
*/
(function() {
  GM_addStyle(`
    .entry .title, .entry .usertext-body {
      font-family: erdana, arial, helvetica, "Gentium Basic", "Gentium Plus Literacy", "Doulos SIL Literacy", "Nuosu SIL", "Charis SIL Mali", "Charis SIL", Aegyptus, Akkadian, Gardiner, Aegean, Alef, Symbola, "Microsoft YaHei", "Microsoft JhengHei", HanaMinA, HanaMinB, TW-Kai, TW-Sung, UnBatang, FreeSans, FreeSerif, Quivira, "DejaVu Sans", "Lucida Sans Unicode", "Arial Unicode MS", "Bitstream Cyberbit", STIX, XITS, Code2000, Code2001, Code2002, unifont, sans-serif
    }
  `);
})();
