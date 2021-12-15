// ==UserScript==
// @name         DocuSign new window
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/docusign.user.js
// @version      1.1
// @description  Right-click and MMB to open in new window
// @author       skinner927
// @match        https://app.docusign.com/*
// @grant        none
// ==/UserScript==

/* Changelog
- 1.1: Add copy names
- 1.0: Init
*/

(function () {
  'use strict';

  function getCleanWindow() {
    // Because doccusign overwrites window.alert and window.prompt
    var iframe = document.getElementById("gm-my-clean-iframe");
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'gm-my-clean-iframe';
      document.body.append(iframe);
    }
    return iframe.contentWindow;
  }

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

  // Add right-click open in new tab 
  waitForElement(
    function () {
      return document.querySelectorAll('div > tr > td > span[role="link"]');
    },
    function ($el) {
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
    },
    250, false
  );

  var CUSTOM_CSS = `
    .gm-custom-tiny-button {
      border-radius: 2px;
      border-style: solid;
      border-width: 1px;
      cursor: pointer;
      margin: 0px;
      overflow: visible;
      position: relative;
      text-align: center;
      text-decoration: none;
      transition-property: background-color, border-color, box-shadow, color;
      transition-duration: 0.2s;
      transition-timing-function: linear;
      vertical-align: middle;
      background-color: rgb(249, 249, 249);
      border-color: rgb(204, 204, 204);
      color: rgb(30, 30, 30);
      font-size: 1em;
      font-weight: normal;
      line-height: 1em;
      padding: 0px 2px;
    }
    .gm-custom-tiny-button > span {
      vertical-align: middle;
    }
    .gm-custom-tiny-button.success {
      background-color: #008938;
      color: rgb(247, 247, 247);
      border-color: black;
    }
  `;
  function placeCustomCss() {
    var customStyleId = 'gm-custom-style-ukq23b2';
    if (document.querySelector('#' + customStyleId)) {
      return;
    }
    var $style = document.createElement('style');
    $style.id = customStyleId;

    if ($style.styleSheet) {
      $style.styleSheet.cssText = CUSTOM_CSS;
    } else {
      $style.appendChild(document.createTextNode(CUSTOM_CSS));
    }
    document.getElementsByTagName('head')[0].appendChild($style);
  }

  function copyButtonFactory(text, copyValue, style, parent) {
    var $btn = document.createElement('button');
    $btn.type = 'button';
    $btn.classList.add('gm-custom-tiny-button');
    style = style || {};
    Object.keys(style).forEach(function (k) {
      $btn.style[k] = style[k];
    });
    // Add title hover
    if (copyValue) {
      $btn.title = copyValue;
    }
    // Add icon
    var $icon = document.createElement('span');
    $icon.classList.add('icon', 'icon-copy');
    $btn.appendChild($icon);
    // Add text
    if (text) {
      $btn.appendChild(document.createTextNode(' '));
      var $textSpan = document.createElement('span');
      $textSpan.innerText = text;
      $btn.appendChild($textSpan);
    }
    // Click handler
    $btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(copyValue).then(function () {
        console.log('Copied to clipboard:', copyValue);
        $btn.classList.add('success');
        window.setTimeout(function () { $btn.classList.remove('success'); }, 500);
      }, function () {
        // Doccusign has overwritten window.prompt and window.alert.
        getCleanWindow().prompt.call(window, 'Failed to update clipboard. Copy manually.', copyValue);
      });
    });
    if (parent) {
      parent.appendChild($btn);
    }
    return $btn;
  }

  waitForElement(
    function () {
      return document.querySelectorAll('tr[data-qa="recipient-row"]');
    },
    function ($row) {
      var $name = $row.querySelector('span[data-qa="recipient-name"]');
      var $email = $row.querySelector('span[data-qa="recipient-email"]');
      if (!$name || !$email) {
        return;
      }
      var name = ($name.innerText || '').trim();
      var email = ($email.innerText || '').trim();
      if (!name && !email) {
        return;
      }
      // Fix the underlying issue (2 spaces seems to work whilst 1 does not)
      $name.appendChild(document.createTextNode('  '));
      placeCustomCss();

      var leftStyle = { marginLeft: '0.5em' };
      copyButtonFactory('', name, leftStyle, $name);
      copyButtonFactory('', email, leftStyle, $email);
      var full = (name + ' ' + email).trim();
      copyButtonFactory('Copy all', full, null, $name.parentElement);


    },
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
