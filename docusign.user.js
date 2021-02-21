// ==UserScript==
// @name         DocuSign new window
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/docusign.user.js
// @version      1.0
// @description  Right-click and MMB to open in new window
// @author       skinner927
// @match        https://app.docusign.com/documents*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function openInNewWindow($el) {
    var data = $el.dataset.qa;
    if (!data) {
      console.error('no qa data on', $el);
      return;
    }
    var id = data.match(/list-row-(.+)-name/)[1];
    if (!id) {
      console.error('no qa data id on', $el);
      return;
    }
    var newUrl = '' + window.location.origin + '/documents/details/' + id;
    console.log('Opening new window', newUrl);
    window.open(newUrl);
  }

  waitForElement('div > tr > td > span[role="link"]', function($el) {
    $el.addEventListener('contextmenu', function contextmenuHandler(e) {
      if (e.shiftKey) { return; }
      e.preventDefault();
      e.stopPropagation();
    });
    $el.addEventListener('mouseup', function mousedownHandler(e) {
      if (e.shiftKey) { return; }
      // 2 = right-click 4 = middle
      if (e.button === 2 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        //setTimeout(() => void $el.click(), 10);
        openInNewWindow($el);
      }
    });
  }, 250, false);

  /**
   * Poll page for elements.
   * @param {string}   selector CSS selector to poll for.
   * @param {function} callback Function to call when selector is found.
   * @param {number}   interval Time in milliseconds to poll for selector.
   * @param {boolean}  onlyOnce If True, stop checking for element after the
   *  first match.
   */
  function waitForElement(selector, callback, interval, onlyOnce) {
    if (!waitForElement.counter) {
      waitForElement.counter = 0;
    }
    var scope = {
      intervalId: null,
      dataId: 'waitForElement' + waitForElement.counter++,
    };
    scope.stop = function waitForElementStopInterval() {
      if (scope.intervalId !== null) {
        clearInterval(scope.intervalId);
        scope.intervalId = null;
      }
    };

    scope.intervalId = setInterval(function waitForElementHandler() {
      var $elements = document.querySelectorAll(selector);
      if (!$elements) {
        return;
      }
      for (var i = 0; i < $elements.length; i++) {
        var $el = $elements[i];
        if (!$el.dataset[scope.dataId]) {
          $el.dataset[scope.dataId] = '1';
          callback($el, scope.stop);
          if (onlyOnce) {
            break;
          }
        }
      }
      if (onlyOnce) {
        scope.stop();
      }
    }, interval || 250);
  }

})();
