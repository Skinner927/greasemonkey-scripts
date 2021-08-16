// ==UserScript==
// @name         Amazon smile redirect
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/amazon_smile_redirect.user.js
// @icon         https://www.google.com/s2/favicons?domain=smile.amazon.com
// @author       skinner927
// @version      1.0
// @match        *://*.amazon.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

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
  const EXCLUDED_DOMAINS = [
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
    if (arguments.length > 1 && console.hasOwnProperty(arguments[0])) {
      i = 1;
      level = arguments[0];
    }
    var args = ['GM Smile:'];
    for (; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    console[level].apply(console, args);
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

  var navTools = document.getElementById('nav-tools');
  if (!navTools || navTools.textContent.indexOf('Hello') == -1) {
    log('Exiting. Not logged in.');
    return;
  }

  // Redirect to smile :D
  log('info', 'Redirecting to smile: ' + window.location);
  window.location.replace('https://smile.amazon.com' + (window.location.pathname || '') + (location.search || ''));

})();
