// ==UserScript==
// @name         Office 365 Planner Group by Progress
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/office365_planner_group_by_progress.user.js
// @version      1.0
// @description  Always "Group by Progress" because O365 is apparently incapable of remembering.
// @author       skinner927
// @match        https://tasks.office.com/*/en-US/Home/Planner/
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';
  var ALREADY_HANDLED = 'DS_GM_ALREADY_HANDLED';
  var DEBUG = false;

  function log() {
    if (DEBUG) {
      console.log.apply(console, arguments);
    }
  }

  function doWork() {
    waitForKeyElements('label.ms-Label', function(btn) {
      log('Found', btn);
      var text = btn.text().trim().toLowerCase();
      if (text.indexOf('group by') !== 0) {
        return;
      }
      if (btn.data(ALREADY_HANDLED)) {
        log('already handled', btn);
        return;
      }
      btn.data(ALREADY_HANDLED, true);
      var current = text.substring('group by '.length).trim();
      if (current === 'progress') {
        log('Already correct grouping');
        return;
      }
      log('Clicking');
      btn.click();
      waitForKeyElements('button[name="Progress"]', function(prog) {
        log('Clicked');
        prog.click()
      }, true);
    });
  }

  // Wait for jQuery to be on the page
  function boot() {
    if (window.$) {
      return doWork();
    }
    setTimeout(boot, 10);
  }
  boot();

  /**
  --- waitForKeyElements():  A utility function, for Greasemonkey scripts,
  that detects and handles AJAXed content.
  Usage example:
      waitForKeyElements (
          "div.comments"
          , commentCallbackFunction
      );
      //--- Page-specific function to do what we want when the node is found.
      function commentCallbackFunction (jNode) {
          jNode.text ("This comment changed by waitForKeyElements().");
      }
  IMPORTANT: This function requires your script to have loaded jQuery.
  https://gist.github.com/BrockA/2625891
  Pulled Jul 16, 2018. Revision 4 on Nov 15, 2012
  */
  function waitForKeyElements(
    selectorTxt,    /* Required: The jQuery selector string that
                        specifies the desired element(s).
                    */
    actionFunction, /* Required: The code to run when elements are
                        found. It is passed a jNode to the matched
                        element.
                    */
    bWaitOnce,      /* Optional: If false, will continue to scan for
                        new elements even after the first match is
                        found.
                    */
    iframeSelector  /* Optional: If set, identifies the iframe to
                        search.
                    */
  ) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined")
      targetNodes = $(selectorTxt);
    else
      targetNodes = $(iframeSelector).contents()
        .find(selectorTxt);

    if (targetNodes && targetNodes.length > 0) {
      btargetsFound = true;
      /*--- Found target node(s).  Go through each and act if they
      are new.
  */
      targetNodes.each(function() {
        var jThis = $(this);
        var alreadyFound = jThis.data('alreadyFound') || false;

        if (!alreadyFound) {
          //--- Call the payload function.
          var cancelFound = actionFunction(jThis);
          if (cancelFound)
            btargetsFound = false;
          else
            jThis.data('alreadyFound', true);
        }
      });
    }
    else {
      btargetsFound = false;
    }

    //--- Get the timer-control variable for this selector.
    var controlObj = waitForKeyElements.controlObj || {};
    var controlKey = selectorTxt.replace(/[^\w]/g, "_");
    var timeControl = controlObj[controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound && bWaitOnce && timeControl) {
      //--- The only condition where we need to clear the timer.
      clearInterval(timeControl);
      delete controlObj[controlKey]
    }
    else {
      //--- Set a timer, if needed.
      if (!timeControl) {
        timeControl = setInterval(function() {
          waitForKeyElements(selectorTxt,
            actionFunction,
            bWaitOnce,
            iframeSelector
          );
        },
          300
        );
        controlObj[controlKey] = timeControl;
      }
    }
    waitForKeyElements.controlObj = controlObj;
  }

  // From https://github.com/component/debounce/blob/master/index.js
  // Pulled Jul 16, 2018. Commit 64577fb on May 11, 2017
  function debounce(func, wait, immediate) {
    var timeout, args, context, timestamp, result;
    if (null == wait) wait = 100;

    function later() {
      var last = Date.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    var debounced = function() {
      context = this;
      args = arguments;
      timestamp = Date.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };

    debounced.clear = function() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    debounced.flush = function() {
      if (timeout) {
        result = func.apply(context, args);
        context = args = null;

        clearTimeout(timeout);
        timeout = null;
      }
    };

    return debounced;
  }
})();
