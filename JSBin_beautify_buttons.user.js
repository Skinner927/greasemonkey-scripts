// ==UserScript==
// @name         JSBin beautify buttons
// @namespace    http://dennisskinner.com
// @version      0.1
// @description  Adds beautifier buttons to JSBin since key code locks computer
// @author       dskinner
// @match        http://jsbin.com/*/edit?*
// @grant        none
// ==/UserScript==

$(function() {
  'use strict';

  // Update as this changes: https://github.com/jsbin/jsbin/blob/3c64ca07616e3ab993176b193159b8be8fc310e4/public/js/editors/beautify.js

  var STATIC_PREFIX = 'http://static.jsbin.com';

  [
    {
      button: 'HTML Beautify',
      beautifyFn: 'html_beautify',
      panel: 'html',
      beautifyUrl: '/js/vendor/beautify/beautify-html.js'
    },
    {
      button: 'CSS Beautify',
      beautifyFn: 'css_beautify',
      panel: 'css',
      beautifyUrl: '/js/vendor/beautify/beautify-css.js'
    },
    {
      button: 'JS Beautify',
      beautifyFn: 'js_beautify',
      panel: 'javascript',
      beautifyUrl: '/js/vendor/beautify/beautify.js'
    }
  ].forEach(function(c) {
    $('<a class="button">' + c.button + '</a>')
      .css('cursor', 'pointer')
      .click(function() {
        if (window[c.beautifyFn]) {
          doBeautify(c);
        } else {
          lazyLoadAndRun(c.beautifyUrl, doBeautify.bind(null, c));
        }
      })
      .appendTo(
        $('<div class="menu"></div>')
          .appendTo('#control > div > div.buttons')
      );
  });

  function lazyLoadAndRun(url, callback) {
    $.getScript(STATIC_PREFIX + url).done(callback);
  }

  function doBeautify(c) {
    var p = jsbin.panels.panels[c.panel];
    p.setCode(window[c.beautifyFn](p.getCode(), {
      indent_size: jsbin.user.settings.editor ? jsbin.user.settings.editor.indentUnit || 2 : 2
    }));
  }
});