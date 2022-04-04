// ==UserScript==
// @name         Amazon smile redirect
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/amazon_smile_redirect.user.js
// @icon         https://smile.amazon.com/favicon.ico
// @author       skinner927
// @version      1.3
// @match        *://*.amazon.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/* Changelog *
 * 1.3 - Fix missing console.hasOwnProperty function.
 * 1.2 - Faster.
 * 1.1 - Fix ES5 compat.
 * 1.0 - Initial release.
 */

/*
 * Most of logic taken from https://github.com/webdevnerdstuff/amazon-smile-redirect
 */

(function() {
  // If these are in the path, don't do anything
  // src/manifest.json :: exclude_globs
  var EXCLUDED_PATHS = [
    'business/register',
    'ab_reg_biss_desktop',
    'amzn_business_inv_website',
    'b2b_reg_email_newcustomer',
    'watchparty',
  ];

  // assets/js/content.js
  var EXCLUDED_DOMAINS = [
    'smile.amazon.', // Added this one as it's obvious
    'advertising.amazon.',
    'affiliate-program.amazon.',
    'alexa.amazon.',
    'amzn_photos_web_us',
    'aws.amazon.',
    'developer.amazon.',
    'ignite.amazon.',
    'kdp.amazon.',
    'music.amazon.',
    'payments.amazon.',
    'read.amazon.',
    'videodirect.amazon.',
    'www.acx.',
    'www.audible.',
  ];

  function log() {
    var i = 0;
    var level = 'log';
    if (arguments.length > 1) {
      // Something changed in GM (or FF?) and we can no longer console.hasOwnProperty()
      switch(arguments[0]) {
        case 'debug':
        case 'error':
        case 'info':
        case 'log':
        case 'table':
        case 'warn':
          if (typeof console[arguments[0]] === 'function') {
            i = 1;
            level = arguments[0];
          }
      }
    }
    var args = ['gm_amazon_smile_redirect:'];
    for (; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console[level].apply(console, args);
  }

  function waitFor(fn, callback, retries, delay, loopCount) {
    // Defaults to 15 seconds. 150 retries * 100ms = 15s
    retries = (typeof(retries) === 'undefined') ? 150 : retries;
    delay = (typeof(delay) === 'undefined') ? 100 : retries;
    loopCount = loopCount || 0;

    var el = fn();
    if (el) {
      // report success
      callback(el);
    } else if (loopCount < retries) {
      // try again
      window.setTimeout(waitFor, delay, fn, callback, retries, delay, loopCount + 1);
    } else {
      // report error
      callback(null);
    }
  }

  var i = 0;

  var path = window.location.pathname;
  for (i = 0; i < EXCLUDED_PATHS.length; i++) {
    if (path.indexOf(EXCLUDED_PATHS[i]) !== -1) {
      log('Exiting. Excluded path: ' + EXCLUDED_PATHS[i]);
      return;
    }
  }

  var domain = window.location.hostname;
  for (i = 0; i < EXCLUDED_DOMAINS.length; i++) {
    if (domain.startsWith(EXCLUDED_DOMAINS[i])) {
      log('Exiting. Excluded domain: ' + EXCLUDED_DOMAINS[i]);
      return;
    }
  }

  waitFor(function() {
    return document.getElementById('nav-tools');
  }, function navToolsHandler(navTools) {
    if (!navTools) {
      log('error', 'Failed to find nav-tools');
      return;
    }

    if (navTools.textContent.indexOf('Hello') == -1) {
      log('Exiting. Not logged in.');
      return;
    }

    // Redirect to smile :D
    log('info', 'Redirecting to smile: ' + window.location);
    window.location.replace('https://smile.amazon.com' + (window.location.pathname || '') + (location.search || ''));
  });
})();
