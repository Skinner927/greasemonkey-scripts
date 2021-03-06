// ==UserScript==
// @name         GMail right-click menu reorder
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/gmail_menu_reorder.user.js
// @version      1.1
// @description  Reorders inbox right-click menu so more useful options are at the top (I do belive this was the old order).
// @author       skinner927
// @match        https://mail.google.com/mail/*
// @grant        none
// ==/UserScript==

/**
 * Changelog
 * - 1.1:  Will order to top or bottom of menu depending on what's closer to
 *     the mouse.
 */

(function() {
  'use strict';

  // Track mouse
  var mouseY = 0;
  document.addEventListener('mousemove', function(event) {
    mouseY = event.clientY;
  }, { passive: true });

  // Expected menu order
  var ORDER = [
    'Archive',
    'Delete',
    'Mark as read',
    'Mark as unread',
  ];

  function makeSeparator(separator) {
    // Create separator
    var sep;
    if (separator) {
      sep = separator.cloneNode();
      sep.style.display = null;
    } else {
      console.error('DS: Could not find separator when iterating over menu');
      sep = document.createElement('div');
      sep.style.margin = '6px 0px';
      sep.style.borderTop = '1px solid rgb(235, 235, 235)';
    }
    sep.id = ':q' + Math.random().toString(16).substr(3, 4);
    return sep;
  }

  function doReorder(menu) {
    var rect = menu.getBoundingClientRect();
    // Do we place the items we want on top or on bottom?
    var placeOnTop = (rect.height / 2) > mouseY - rect.top;

    // Find the items we're to move
    var found = ORDER.map(function() { });

    // Search for the menu items we want to move
    var separator = null;
    for (var i = 0; i < menu.children.length; i++) {
      var child = menu.children[i];
      if (child.getAttribute('role') === 'separator') {
        separator = child;
        continue;
      }
      var childIndex = ORDER.indexOf(child.innerText.trim());
      if (childIndex > -1) {
        found[childIndex] = child;
      }
    }

    // Shove them in!
    found = found.filter(function(x) {
      return !!x;
    });
    if (found.length && !menu.dataset.addedSep) {
      // Create separator
      var topSep = makeSeparator(separator);
      menu.insertBefore(topSep, menu.children[0]);
      var bottomSep = makeSeparator(separator);
      menu.insertBefore(bottomSep, null);
      menu.dataset.addedSep = true;
      menu.dataset.topSep = topSep.id;
      menu.dataset.bottomSep = bottomSep.id;
    } else if (!found.length) {
      console.error('Could not find any elements in the menu to reorder!');
      return;
    }
    // Iterate in reverse because we push to the top
    found.reverse();
    found.forEach(function(child) {
      menu.insertBefore(child, placeOnTop ? menu.children[0] : null);
    });
    var sepToHide = document.getElementById(placeOnTop ?
      menu.dataset.bottomSep : menu.dataset.topSep);
    var sepToShow = document.getElementById(!placeOnTop ?
      menu.dataset.bottomSep : menu.dataset.topSep);
    sepToHide.style.display = 'none';
    sepToShow.style.display = '';
  }

  var observers = [];
  var control = waitForKeyElements('body > [role="menu"]', function(menu) {
    // Observe when the menu is shown again so we can properly reorder
    var observer = new MutationObserver(function(mutationList) {
      mutationList.forEach(function(mutation) {
        if (mutation.type === 'attributes' &&
          mutation.target === menu &&
          mutation.attributeName === 'tabindex' &&
          +menu.tabIndex === 0) {
          doReorder(menu);
        }
      });
    });
    observer.observe(menu, {
      attributes: true,
    });
    observers.push(observer);

    // Do the initial reorder
    doReorder(menu);
  });

  // Bind a function to the window to kill this script
  window.killGmailMenuReorder = function() {
    clearInterval(control);
    observers.forEach(function(o) { o.disconnect(); });
  };


  // https://gist.github.com/mjblay/18d34d861e981b7785e407c3b443b99b
  /*--- waitForKeyElements():  A utility function, for Greasemonkey scripts,
    that detects and handles AJAXed content. Forked for use without JQuery.
    Usage example:
        waitForKeyElements (
            "div.comments"
            , commentCallbackFunction
        );
        //--- Page-specific function to do what we want when the node is found.
        function commentCallbackFunction (element) {
            element.text ("This comment changed by waitForKeyElements().");
        }

    IMPORTANT: Without JQuery, this fork does not look into the content of
    iframes.
*/
  function waitForKeyElements(
    selectorTxt,    /* Required: The selector string that
                      specifies the desired element(s).
                  */
    actionFunction, /* Required: The code to run when elements are
                      found. It is passed a jNode to the matched
                      element.
                  */
    bWaitOnce      /* Optional: If false, will continue to scan for
                      new elements even after the first match is
                      found.
                  */
  ) {
    var targetNodes, btargetsFound;
    targetNodes = document.querySelectorAll(selectorTxt);

    if (targetNodes && targetNodes.length > 0) {
      btargetsFound = true;
      /*--- Found target node(s).  Go through each and act if they
          are new.
      */
      targetNodes.forEach(function(element) {
        var alreadyFound = element.dataset.found == 'alreadyFound' ? 'alreadyFound' : false;

        if (!alreadyFound) {
          //--- Call the payload function.
          var cancelFound = actionFunction(element);
          if (cancelFound) {
            btargetsFound = false;
          } else {
            element.dataset.found = 'alreadyFound';
          }
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
      delete controlObj[controlKey];
    }
    else {
      //--- Set a timer, if needed.
      if (!timeControl) {
        timeControl = setInterval(function() {
          waitForKeyElements(selectorTxt,
            actionFunction,
            bWaitOnce
          );
        },
          300
        );
        controlObj[controlKey] = timeControl;
      }
    }
    waitForKeyElements.controlObj = controlObj;
    return timeControl;
  }
})();
