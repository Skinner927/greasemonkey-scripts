// ==UserScript==
// @name         GEMS Mods
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/gems-mods.user.js
// @version      1.0
// @description  Add some nice colors
// @author       skinner927
// @match        https://gems.usf.edu/psc/gemspro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=usf.edu
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var COLOR_MAP = {
        NAANNL: {background: '#b8ffe1'},
        NAHRLY: {background: '#ffd5d5'},
    };

    function applyStyleToElement($el, style) {
        Object.keys(style).forEach((k) => {
            $el.style[k] = style[k];
        });
    }

    function colorCell($cell) {
        var style = COLOR_MAP[$cell.innerText];
        if (style) {
            applyStyleToElement($cell, style);
        }
    }

    var QSTR = [
        // These are on the "Current appointment compenstation" cells
        'span.PSEDITBOX_DISPONLY',
        // These are on the "Lookup" modal
        'table.PSSRCHRESULTSWBO tr td a',
    ].join(' , ');
    waitForElement(
        function() {
            return document.querySelectorAll(QSTR);
        },
        colorCell,
        250, false
    );

    /**
   * Poll page for elements.
   * @param {function} selector Function that returns a list of DOM elements or null.
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
            var $elements = selector(scope.stop);
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
