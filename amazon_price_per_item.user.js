// ==UserScript==
// @name         Amazon price per item
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/amazon_price_per_item.user.js
// @author       skinner927
// @version      1.5
// @match        *://*.amazon.com/s/*
// @match        *://*.amazon.com/s?*
// @match        *://*.amazon.com/*/dp/*
// @match        *://*.amazon.com/dp/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      code.jquery.com
// @require      https://code.jquery.com/jquery-3.3.1.slim.min.js
// ==/UserScript==

/* Changelog *
 * 1.5 - Add ReviewMeta and Fakespot review rating buttons.
 * 1.4 - Improve testing & debugging. Fixed newSuggestedItem.
 * 1.3 - Add sweet title parser buildTitleParser() for parsing human words.
 * 1.2 - Fix for prices that show a range (eg. $22.95 - $40.22).
 * 1.1 - Add support for suggested items in item details.
 * 1.0 - Initial release.
 */

// Hand rolled to work with node require and run in the browser
(function(factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    // Just return exports
    module.exports = factory(true);
  } else {
    // Run it
    factory();
  }
})(function factory(returnExports) {
  'use strict';
  if (returnExports) {
    return {
      buildTitleParser: buildTitleParser,
      pollUntil: pollUntil,
    };
  }
  // If we're not returning exports, run the gm script
  var ID = 'gm_amazon_price_per_item';
  var DEBUG = false;
  // We blast this simply so we can get a context if we need to debug
  console.log(ID, 'Starting');

  // TODO: Drop this if everything is working
  // var realUnsafeWindow = (function getUnsafeWindow() {
  //   if (typeof unsafeWindow !== 'undefined' && unsafeWindow === window) {
  //     var node = document.createElement('div');
  //     node.setAttribute('onclick', 'return window;');
  //     return node.onclick();
  //   }
  //   return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  // })();

  function log() {
    if (DEBUG) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(ID);
      console.info.apply(console, args);
    }
  }

  function noop(){}

  // Reviewers
  // https://imgur.com/a/pL9d7ky
  var reviewers = [
    {
      title: 'ReviewMeta',
      img: 'https://i.imgur.com/fnNe1Uw.png',
      urlPrefix: 'https://reviewmeta.com/search?q=',
      urlSuffix: '',
    },
    {
      title: 'Fakespot',
      img: 'https://i.imgur.com/lyqq1NG.png',
      urlPrefix: 'https://www.fakespot.com/analyze?url=',
      urlSuffix: '',
    }
  ];

  function generateReviewLinks(itemUrl, cssWidth) {
    itemUrl = itemUrl ? encodeURIComponent(itemUrl) : null;
    cssWidth = cssWidth || '20px';

    return reviewers.map(function(r) {
      var href = '';
      if (itemUrl) {
        var fullUrl = r.urlPrefix + itemUrl + r.urlPrefix;
        href = ` href="${fullUrl}" target="_blank" `;
      }
      return `
      <a ${href} title="${r.title}" style="text-decoration: none;">
        <img src="${r.img}" style="height: auto; width: ${cssWidth};" />
      </a>
      `;
    });
  }

  var getCountFromTitle = buildTitleParser();

  var searchPageItemCounter = 0;
  // Gets called for each search page product item
  // eg: https://www.amazon.com/s?k=air+duster&i=office-products
  function newSearchPageItem($item) {
    var itemId = searchPageItemCounter++;
    log('newSearchPageItem', itemId, $item);

    // There's no longer an easy way to snag the title so we have to
    // figure the "title" is any element that's not the price.
    // Additionally, it seems css class prefixes change by the day so we have
    // to use goofy selectors.
    var $title = null;
    var $price = null;
    var text = [];
    $item.find('a[class*="text-normal"]').each(function() {
      var $a = $(this);
      if (!$title) {
        $title = $a; // Likely the first anchor is the title
      }
      var price = $a.find('[class*="price"]').first();
      if (price.length) {
        $price = price;
      } else {
        var trimmed = $a.text().trim();
        if (trimmed) {
          text.push(trimmed);
        }
      }
    });
    text = text.join('\n');
    if (!text || !$title) {
      log('Cannot find title', itemId, $item);
      return;
    }

    // Add review links to title
    var parent = $title.parent().parent(); // div > h2 > $title
    // Links are not immediately bound so we must poll for them
    pollUntil({
      success: (url) => {
        var a = generateReviewLinks(url).join('\n');
        parent.append($('<div />').addClass(ID).append(a));
      },
      failure: () => log('No title link for ', $item),
      // prop gives us absolute url
      test: () => $title.prop('href'),
      // 100intv * 100loop / 1000ms = 10s (random adds some jitter)
      interval: 100 + Math.floor((Math.random() * 10) + 1),
      loops: 100,
    });

    var countInPack = getCountFromTitle(text);

    if (!countInPack) {
      log('Cannot find count', itemId, text, $item);
      return;
    } else if (!$price) {
      log('Cannot find price', itemId, text, $item);
      return;
    }

    function getNumberFrom($el) {
      return parseInt($el.text().replace(/[^0-9]/g, ''), 10);
    }

    var whole = getNumberFrom($price.find('[class*="price-whole"]').first());
    var cents = getNumberFrom($price.find('[class*="price-fraction"]').first());

    if (isNaN(whole) || isNaN(cents)) {
      log('Bad price', itemId, $item);
      return;
    }

    // Price in pennies
    var price = cents + (whole * 100);
    var perItem = '$' + toFixedCeil(price / countInPack / 100, 2);
    var priceInDollars = '$' + whole + '.' + cents;

    // Stick the per/item price in a row below the price.
    var $row = $price.closest('.a-row');
    $(`
    <div class="a-row a-spacing-none">
      <div class="a-size-small a-text-normal">
        <span class="a-color-secondary">Estimated ${perItem} per item</span>
        (${countInPack} @ ${priceInDollars})
      </div>
    </div>
    `).addClass(ID).appendTo($row);

    log('Success', itemId, $item);
  }

  // Gets called on each product details page
  // https://www.amazon.com/Dust-Off-Compressed-Gas-Duster-Pack/dp/B01MQFCYW0
  function newItemDetails($title) {
    log('newItemDetails', $title);

    // Add review links
    var a = generateReviewLinks(window.location.href.split('#')[0], '40px').join('\n');
    $title.parent().parent().append($('<div />').addClass(ID).append(a));

    // Count
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
    `).addClass(ID).appendTo($price.closest('tr').parent());
  }

  // Suggested items are towards the bottom of a product page
  // "Customers who shopped for this item, also purchased..."
  function newSuggestedItem($item) {
    log('newSuggestedItem', $item);

    var $a = $item.find('a').first();
    var addTo = $a.parent();

    // Review buttons
    var a = generateReviewLinks($a.prop('href')).join('\n');
    addTo.append($('<div class="a-row" />').addClass(ID).append(a));

    var title = $item.find('.p13n-sc-truncate').text().trim();
    if (!title) {
      title = $item.find('.p13n-sc-truncated').text().trim();
    }
    var countInPack = getCountFromTitle(title);

    if (!countInPack) {
      log('No count', $item);
      return;
    }

    var $price = $item.find('.p13n-sc-price');
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
    <div class="a-row a-size-small">
      Estimated ${perItem} per item
      <div class="a-color-secondary">(${countInPack} @ ${priceInDollars})</div>
    </div>
    `).addClass(ID).appendTo(addTo);
  }

  // Called once jQuery is loaded and page is ready
  function main() {
    log('Starting Main');

    // This is the only way to get jQuery on the damn page.
    // We can't share a reference to it either.
    // This is something seemingly unique to FF, but should be fine in both.
    if (DEBUG && !unsafeWindow.$ && !unsafeWindow.jQuery && !unsafeWindow.$j) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://code.jquery.com/jquery-3.3.1.slim.min.js',
        onload: function(response) {
          var src = 'var JQ_DO_NO_CONFLICT = typeof $ !== "undefined";\n\n'
          src += response.responseText;
          src += '\n\n' + `
          if (JQ_DO_NO_CONFLICT) {
            window.$j = $.noConflict(true);
            console.log("%cInjected jQuery as $j", "color:blue");
          } else {
            console.log("%cInjected jQuery as $", "color:blue");
          }
          `;

          var script = document.createElement('script');
          script.textContent = src;
          document.body.append(script);
        },
      });
    }

    // Prevent hitting an element twice with the same handler (was happening)
    function noDupes(key, fn) {
      return function wrapper($el) {
        if (!$el.data(key)) {
          $el.data(key, true);
          fn($el);
        }
      };
    }

    // Product search pages
    waitForKeyElements(
      '.s-result-item',
      noDupes(ID + '-newSearchPageItem', newSearchPageItem),
      false
    );
    // Individual product page
    waitForKeyElements(
      '#productTitle',
      noDupes(ID + '-newItemDetails', newItemDetails),
      false
    );
    // Suggested items on the individual product pages
    waitForKeyElements(
      '.a-carousel-card[role="listitem"]',
      noDupes(ID + '-newSuggestedItem', newSuggestedItem),
      false
    );
  }

  // Wait for jQuery to be loaded
  if (window.$) {
    $(main);
  } else {
    var waitForJQ = null;
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
        console.error(ID, 'After 30 seconds could not load jQuery');
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

  /**
   * Poll a function until the value you're looking for is returned.
   *
   * @param {Function|object|null} successOrObj If validator passes this is
   *  called. If given an object its keys are pulled as the same parameters to
   *  this function.
   * @param {Function|null} failure If we've timed out this is called.
   * @param {Function} test Function to return the test value. Called once
   *  for every test iteration.
   * @param {Function|null} validator Special function that is passed the
   *  return value of the `test()`. Should return `true` if the the given
   *  value is what you are looking for. If no validator function is given,
   *  we simply evaluate the return of `test()` for truthy.
   * @param {int} interval Time in ms to sleep between iterations.
   * @param {int} loops Number of iterations.
   * @param {int} _iniL Internal flag to know the original loop count and to
   *  trigger validation checks. Do not pass this manually.
   */
  function pollUntil(successOrObj, failure, test, validator, interval, loops, _iniL) {
    var success = successOrObj;
    if (typeof successOrObj === 'object') {
      // Extract params
      success = successOrObj.success;
      failure = failure || successOrObj.failure;
      test = test || successOrObj.test;
      validator = validator || successOrObj.validator;
      interval = interval || successOrObj.interval;
      loops = loops || successOrObj.loops;
    }
    // Validate on first run only
    if (typeof _ol !== 'number') {
      success = success || noop;
      if (typeof test !== 'function') {
        throw Error('success must be a function or null');
      }
      failure = failure || noop;
      if (typeof test !== 'function') {
        throw Error('failure must be a function or null');
      }
      if (typeof test !== 'function') {
        throw Error('test must be a function (how else else are we gonna test?)');
      }
      if (validator && typeof validator !== 'function') {
        throw Error('validator must be a function');
      }
      if (typeof interval !== 'number') {
        throw Error('interval must be a number');
      }
      if (typeof loops !== 'number') {
        throw Error('loops must be a number');
      }
      if (loops < 1) {
        throw Error('You cannot start pollUntil with anything less than 1 loop');
      }
      _iniL = loops; // initial loops
    }

    var val = void 0;
    if (loops > 0) {
      val = test();
      if (validator ? validator(val, loops, _iniL) : !!val) {
        // passed!
        success(val, loops, _iniL);
        return;
      }
    }
    var nextLoops = loops - 1;
    if (nextLoops <= 0) {
      // Out of time, thanks for playing
      failure(val, loops, _iniL);
      return;
    }
    // Try again
    setTimeout(pollUntil, interval, success, failure, test, validator, interval, nextLoops, _iniL);
  }

  function buildTitleParser(expose) {
    expose = expose || {};
    /*
    Qualifiers -
    These are the overall matches that we use to identify packs.
    The first index is the "prefix"
    and the second index is the "suffix"
    wherein the number (be it a digit or words) lies between.
    Both values will be added to a regex so make it work correctly.
    Ensure any groups () are non-capturing (?:...)
    */
    var qualifiers = [
      ['', '[ -]*pack'],  // 2 pack or 2-pack or 2 -pack or 2pack
      ['', '[ ,]*count'], // 4 count or 4, count or 4Count
      ['\\w of ', ''],    // foobar of X: pack of 3, box of 12
    ];

    var regExes = qualifiers.map(function(qual) {
      var words = '(?:[a-zA-Z\\-]+(?: |-)?){1,4}'; // We allow up to 4 words
      return new RegExp(qual[0] + '(?:(\\d+)|(' + words + '))' + qual[1]);
    });

    // Let's build all word numbers
    // https://stackoverflow.com/a/493788/721519

    // Some common slang for numbers
    var numberSlang = {
      2: ['twin', 'double'],
      3: ['triple'],
      4: ['quad']
    }

    var units = [
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
      'sixteen', 'seventeen', 'eighteen', 'nineteen',
    ];
    var tens = [
      '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
      'seventy', 'eighty', 'ninety',
    ];
    var scales = ['hundred', 'thousand', 'million', 'billion', 'trillion'];

    /* numberWords */
    // Build numberWords which will be a map for all words to a tuple that will
    // descibe the value of the word.
    var numberWords = {
      and: [1, 0],
    };
    units.forEach(function(word, i) {
      numberWords[word] = [1, i];
    });
    tens.forEach(function(word, i) {
      if (word) {
        numberWords[word] = [1, i * 10];
      }
    });
    scales.forEach(function(word, i) {
      numberWords[word] = [Math.pow(10, (i * 3) || 2), 0];
    });
    Object.keys(numberSlang).forEach(function(num) {
      numberSlang[num].forEach(function(word) {
        numberWords[word] = [1, parseInt(num, 10)];
      });
    });

    function handleMatch(match) {
      if (!match) {
        return null;
      }
      var digits = match[1];
      var text = match[2];

      // Digits trump text numbers
      if (digits) {
        var d = parseInt(digits, 10);
        if (d && !isNaN(d)) {
          return d;
        }
      }
      if (!text) {
        return null;
      }

      // Ok, figure out what it's saying :D
      var current = 0;
      var result = 0;
      var started = false;
      var words = text.trim().split(/[ -]/);
      for (var i = 0; i < words.length; i++) {
        var word = words[i];
        if (!(word in numberWords)) {
          // This causes a break only if we've at least once captured something
          if (started) {
            break;
          }
          continue;
        }
        started = true;

        var values = numberWords[word];
        var scale = values[0];
        var increment = values[1];
        current = current * scale + increment;
        if (scale > 100) {
          result += current;
          current = 0;
        }
      }
      result += current;
      return (typeof result === 'number') && result > 0 ? result : null;
    }

    // Parse a string for a count
    function parseTitle(title) {
      title = (title || '').trim().toLowerCase();
      for (var i = 0; i < regExes.length; i++) {
        var exp = regExes[i];
        exp.lastIndex = 0; // Reset it

        var result = handleMatch(title.match(exp));
        if (result) {
          return result;
        }
      }
      return null;
    }

    expose.regExes = regExes;
    expose.handleMatch = handleMatch;
    expose.parseTitle = parseTitle;

    return parseTitle;
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
});
