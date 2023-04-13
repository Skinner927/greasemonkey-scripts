// ==UserScript==
// @name         geeksforgeeks disable popups
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/geeksforgeeks.user.js
// @downloadURL  https://github.com/Skinner927/greasemonkey-scripts/raw/master/geeksforgeeks.user.js
// @icon         https://geeksforgeeks.org/favicon.ico
// @author       skinner927
// @version      1.0
// @match        https://www.geeksforgeeks.org/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  var lastScrollPos = 0;
  var timer = null;

  function loop() {
    var el = document.getElementById("adBlockerModal");
    if (el) {
      el.remove();
      document.body.classList.remove("body-for-ad-blocker");
    }

    // yoinked from: https://greasyfork.org/en/scripts/441427-geeksforgeeks-login-bypass/code
    var spinnerLoadingOverlay = document.querySelector('div.spinner-loading-overlay');
    // spinner overlay is present and visible
    if (spinnerLoadingOverlay && spinnerLoadingOverlay.style.display === 'block') {
      // remove the annoying overlay
      spinnerLoadingOverlay.remove();
      // save scroll position, site brings you back to the top
      if (document.documentElement.scrollTop > 0) {
        lastScrollPos = document.documentElement.scrollTop;
      }
    }
    var loginModal = document.querySelector('div.login-modal-div');
    // login modal is present and visible
    if (loginModal && loginModal.style.display === 'block') {
      // remove login modal
      loginModal.remove();
      // remove css scrolling restriction
      var body = document.querySelector('body');
      body.style.position = 'relative';
      body.style.overflow = 'visible';
      // nullify scoll event listener that blocks you
      window.onscroll = null;
      // scroll back to where you were
      if (lastScrollPos > 0) {
        document.documentElement.scrollTo(0, lastScrollPos);
      }
    }
  }

  function startInterval() {
    if (timer) {
      window.clearInterval(timer);
    }
    loop();
    timer = window.setInterval(loop, 150);
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      if (timer) {
        window.clearInterval(timer);
      }
      timer = null;
    } else {
      startInterval();
    }
  });
  startInterval();
})();
