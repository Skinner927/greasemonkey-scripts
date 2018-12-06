// ==UserScript==
// @name         Amazon price per item
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/amazon_price_per_item.user.js
// @author       skinner927
// @version      1.0
// @match        *://*.amazon.com/s/*
// @match        *://*.amazon.com/*/dp/*
// @run-at       document-start
// @require      https://code.jquery.com/jquery-3.3.1.slim.min.js
// ==/UserScript==

(function() {
  'use strict';
  var DEBUG = false;

  function log() {
    if (DEBUG) {
      console.info.apply(console, arguments);
    }
  }

  function getCountFromTitle(title) {
    title = (title || '').trim().toLowerCase();

    var match = title.match(/pack of (\d)+/) // pack of 3
      || title.match(/(\d+)( |-)pack/)       // 2 pack or 2-pack
      || title.match(/(\d+),? count/)        // 4 count or 4, count
      || null;

    if (match) {
      var strCount = match[1].trim();
      var count = parseInt(strCount, 10);
      if (!isNaN(count) && strCount === ('' + count) && count !== 0) {
        return count;
      }
    }
    return false;
  }

  // Gets called for each search page product item
  function newSearchPageItem($item) {
    var title = $item.find('.s-access-title').text();

    // Find the number in the pack (if it's a pack at all)
    var countInPack = getCountFromTitle(title);

    if (!countInPack) {
      log('No count', $item);
      return;
    }

    var $priceBlock = $item.find('.sx-price');
    if ($priceBlock.length < 1) {
      log('Cannot find price', $item);
      return;
    }

    var whole = parseInt(
      $priceBlock.find('.sx-price-whole').text().trim(),
      10);
    var cents = parseInt(
      $priceBlock.find('.sx-price-fractional').text().trim(),
      10);

    if (isNaN(whole) || isNaN(cents)) {
      log('Bad price', $item);
      return;
    }

    // Price in pennies
    var price = cents + (whole * 100);
    var perItem = '$' + toFixedCeil(price / countInPack / 100, 2);
    var priceInDollars = '$' + whole + '.' + cents;

    // Stick the per/item price in a row below the price.
    var $row = $priceBlock.closest('.a-row');
    $(`
    <div class="a-row a-spacing-none">
      <div class="a-size-small a-text-normal">
        <span class="a-color-secondary">Estimated ${perItem} per item</span>
        (${countInPack} @ ${priceInDollars})
      </div>
    </div>
    `).appendTo($row);
  }

  // Get's called on each product details page
  function newItemDetails($title) {
    var countInPack = getCountFromTitle($title.text());

    if (!countInPack) {
      log('No count', $title);
      return;
    }

    // If we got this far we should be on the page, so we can query directly
    var $price = $('#priceblock_ourprice');
    var priceParts = $price.text().trim()
      .replace('$', '').split('.');
    var whole = parseInt(priceParts[0], 10);
    var cents = parseInt(priceParts[1], 10);

    if (isNaN(whole) || isNaN(cents)) {
      log('Bad price', $title);
      return;
    }

    // Price in pennies
    var price = cents + (whole * 100);
    var perItem = '$' + toFixedCeil(price / countInPack / 100, 2);
    var priceInDollars = '$' + whole + '.' + cents;

    $(`
    <tr><td colspan="2" class="a-size-base">
      Estimated ${perItem} per item
      <span class="a-color-secondary">(${countInPack} @ ${priceInDollars})</span>
    </td></tr>
    `).appendTo($price.closest('tr').parent());
  }

  // Called once jQuery is loaded and page is ready
  function main() {
    // Product search pages
    waitForKeyElements('.s-result-item', newSearchPageItem, false);
    // Individual product page
    waitForKeyElements('#productTitle', newItemDetails, false);
  }

  // Wait for jQuery to be loaded
  if (window.$) {
    $(main);
  } else {
    var waitForJQ;
    var count = 0;
    var clearWaitForJQ = function() {
      if (waitForJQ) {
        window.clearInterval(waitForJQ);
        waitForJQ = null;
      }
    };
    waitForJQ = window.setInterval(function() {
      count++;
      if (window.$ && waitForJQ) {
        clearWaitForJQ();
        $(main);
      } else if (count > 300) {
        // About 30 seconds
        clearWaitForJQ();
        console.error('After 30 seconds could not load jQuery');
      }
    }, 100);
  }

  // toFixed but rounds up always
  function toFixedCeil(num, precision) {
    var fixed = parseFloat(num.toFixed(precision));
    if (num > fixed) {
      fixed += 1 / Math.pow(10, precision);
    }
    return fixed.toFixed(precision);
  }

  /*--- waitForKeyElements():  A utility function, for Greasemonkey scripts,
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

})();
