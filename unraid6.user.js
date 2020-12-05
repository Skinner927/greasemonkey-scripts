// ==UserScript==
// @name         Unraid6
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/unraid6.user.js
// @version      1.0
// @description  Augment some CSS and styles so I can read.
// @author       skinner927
// @match        *://192.168.7.90/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
  'use strict';

  GM_addStyle(`
    optgroup.title {
      color: #707070 !important;
    }
  `);
})();
