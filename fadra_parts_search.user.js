// ==UserScript==
// @name         FADRA Big Parts Search
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/fadra_parts_search.user.js
// @version      1.0
// @match        http://www.fadra.org/parts-search-q
// @grant        GM_addStyle
// ==/UserScript==
(function () {
  'use strict';

  GM_addStyle(`
    body.big-search {
      overflow: hidden;
    }

    body.big-search iframe {
      background: white;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 3000;
    }

    #big-search-toggle {
      position: fixed;
      top: 0;
      right: 0;
      z-index: 4000;
      cursor: pointer;
    }
  `);

  var CLASS_NAME = 'big-search';
  var toggleState = false;

  var btn = document.createElement('button');
  btn.innerText = 'Toggle Big Part Search Frame';
  btn.id = 'big-search-toggle'

  document.body.appendChild(btn);

  btn.onclick = function () {
    if (toggleState) {
      document.body.classList.remove(CLASS_NAME);
    } else {
      document.body.classList.add(CLASS_NAME);
    }
    toggleState = !toggleState;
  };

})();
