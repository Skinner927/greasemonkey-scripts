// ==UserScript==
// @name         geeksforgeeks disable popups
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/geeksforgeeks.user.js
// @downloadURL  https://github.com/Skinner927/greasemonkey-scripts/raw/master/geeksforgeeks.user.js
// @icon         https://geeksforgeeks.org/favicon.ico
// @author       skinner927
// @version      1.1
// @match        https://www.geeksforgeeks.org/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var lastScrollPos = 0;

  function reactToMutation(mutations) {
    mutations.forEach(function (mutation) {
      var oldValue = mutation.oldValue;
      var newValue = mutation.target;
      if (oldValue === newValue) {
        return;
      }

      // Adblock popup
      var adblock = newValue.querySelector("#adBlockerModal");
      if (adblock) {
        adblock.remove();
        document.body.classList.remove("body-for-ad-blocker");
      }

      // https://greasyfork.org/en/scripts/441427-geeksforgeeks-login-bypass/code
      var spinnerLoadingOverlay = newValue.querySelector('div.spinner-loading-overlay');
      // spinner overlay is present and visible
      if (spinnerLoadingOverlay && spinnerLoadingOverlay.style.display === 'block') {
        // remove the annoying overlay
        spinnerLoadingOverlay.remove();
        // save scroll position, site brings you back to the top
        if (document.documentElement.scrollTop > 0) {
          lastScrollPos = document.documentElement.scrollTop;
        }
      }
      var loginModal = newValue.querySelector('div.login-modal-div');
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
    });
  }

  var observer = new MutationObserver(reactToMutation);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: false,
    characterDataOldValue: false,
  });


})();
