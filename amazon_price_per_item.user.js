// ==UserScript==
// @name         Amazon price per item
// @description  Show how much each item costs per bundle/pack and how much alternatives (colors/options) cost.
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/amazon_price_per_item.user.js
// @downloadURL  https://github.com/Skinner927/greasemonkey-scripts/raw/master/amazon_price_per_item.user.js
// @icon         https://www.amazon.com/favicon.ico
// @author       skinner927
// @author       LudooOdOa
// @version      1.20
// @match        *://*.amazon.com/*
// @match        *://*.amazon.fr/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      code.jquery.com
// @require      https://code.jquery.com/jquery-3.3.1.slim.min.js
// ==/UserScript==

/* TODO/BUGFIX
  - https://www.amazon.com/dp/B098RX89VV needs to update color prices when size changes.
*/

/* Changelog
 * 1.20 - i18n support.
 * 1.15 - Add "/pack" support.
 * 1.14 - Fetch prices of product Twister color/variation/options.
 * 1.13 - Greatly improve estimates on "twister" product pages (multiple options).
 * 1.12 - Amazon has many sub-paths, so now match everything.
 * 1.11 - Fix item detail price selector.
 * 1.10 - Fix item detail selector. Add 'pieces' and 'pcs' qualifiers.
 * 1.9  - Add CamelCamelCamel price tracker.
 * 1.8  - Add icon.
 * 1.7  - Add X per Y (3 per box) support.
 * 1.6  - Add ability to debug via url param `appi=1`. Fix review links and
          missing suggested items.
 * 1.5  - Add ReviewMeta and Fakespot review rating buttons.
 * 1.4  - Improve testing & debugging. Fixed newSuggestedItem.
 * 1.3  - Add sweet title parser buildTitleParser() for parsing human words.
 * 1.2  - Fix for prices that show a range (eg. $22.95 - $40.22).
 * 1.1  - Add support for suggested items in item details.
 * 1.0  - Initial release.
 */

/*
i18n fr samples:
- https://www.amazon.fr/Amazon-Basics-Piles-Rechargeables-Pr%C3%A9-Charg%C3%A9es/dp/B007B9NXAC/ref=sr_1_5_pp
- https://www.amazon.fr/Piles-Auditives-Rayovac-Appareil-Auditif/dp/B0CZS7X64G/ref=asc_df_B0C46K6SM7/
*/

/* global module:writable, $:readonly */
// Hand rolled to work with node require and run in the browser
(function (factory) {
  function isObj(val) {
    return val === "object";
  }

  if (
    isObj(typeof exports) &&
    isObj(typeof module) &&
    isObj(typeof module.exports)
  ) {
    // All of this so I don't have to use a testing framework 0_o
    module.exports = exports = function factoryWrapper(theWindow, theDocument) {
      theWindow = isObj(typeof theWindow)
        ? theWindow
        : isObj(typeof window)
        ? window
        : isObj(typeof globalThis)
        ? globalThis
        : { document: {} };

      return factory(theWindow, theDocument || theWindow.document || {}, true);
    };
  } else {
    // Hopefully in a browser
    factory(window, document, false);
  }
})(function factory(window, document, returnExports) {
  "use strict";

  // If we're not returning exports, run the gm script
  var ID = "gm_amazon_price_per_item";
  var DEBUG = false;
  if (!DEBUG && window.location.search.indexOf("appi=1") !== -1) {
    DEBUG = true;
  }
  var STYLE_ESTIMATED = "color:blue;";

  const LOCALE = document.documentElement.lang; //"en-US"
  const segments = LOCALE.split("-");
  const country = segments[0];
  const region = segments[1];
  //var DECIMAL_SEPARATOR="."
  const DECIMAL_SEPARATOR = new Intl.NumberFormat(LOCALE)
    .format(1.1)
    .replaceAll("1", "");
  //var THOUSANDS_SEPARATOR=",";
  const THOUSANDS_SEPARATOR = new Intl.NumberFormat(LOCALE)
    .format(1111)
    .replaceAll("1", "");
  const currencies = {
    fr: "EUR",
    en: "USD",
  };
  const CURRENCY_MODE = currencies[country] || currencies.en;

  const i18n_strings = {
    fr: {
      item: "unité",
      estimated: function (perItem) {
        return `Environ ${perItem} par unité`;
      },
    },
    en: {
      item: "item",
      estimated: function (perItem) {
        return `Estimated ${perItem} per item`;
      },
    },
  };
  const i18n = i18n_strings[country] || i18n_strings.en;

  const formatter = new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY_MODE,
  });

  if (DEBUG || !returnExports) {
    // We blast this simply so we can get a context if we need to debug
    console.log(ID, "Starting", window.location);
  }

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
  log("will log all messages");

  function noop() {}

  // Reviewers
  // https://imgur.com/a/pL9d7ky
  var reviewers = [
    {
      title: "ReviewMeta",
      img: "https://i.imgur.com/fnNe1Uw.png",
      urlPrefix: "https://reviewmeta.com/search?q=",
      urlSuffix: "",
    },
    {
      title: "Fakespot",
      img: "https://i.imgur.com/lyqq1NG.png",
      urlPrefix: "https://www.fakespot.com/analyze?url=",
      urlSuffix: "",
    },
    {
      title: "CamelCamelCamel",
      img: "https://i.imgur.com/SmTu2yE.png",
      urlPrefix: "https://camelcamelcamel.com/search?sq=",
      urlSuffix: "",
    },
  ];

  // Returns an array of HTML strings.
  function generateReviewLinks(itemUrl, cssWidth) {
    itemUrl = itemUrl ? encodeURIComponent(itemUrl) : null;
    cssWidth = cssWidth || "20px";

    return reviewers.map(function (r) {
      var a = document.createElement("a");
      if (itemUrl) {
        a.href = r.urlPrefix + itemUrl + r.urlSuffix;
        a.target = "_blank";
      }
      a.title = r.title;
      a.style = "text-decoration: none;";

      var img = document.createElement("img");
      img.src = r.img;
      img.style = `height: auto; width: ${cssWidth};`;

      a.appendChild(img);
      var result = a.outerHTML;

      img.remove();
      a.remove();
      return result;
    });
  }

  var getCountFromTitle = buildTitleParser();

  var searchPageItemCounter = 0;

  function addEstimatedToElement(
    priceInPennies,
    itemCount,
    $sibling,
    style,
    klass
  ) {
    if (!priceInPennies || !itemCount || !$sibling) {
      return;
    }
    // Price in pennies
    var perItem = formatter.format(
      toFixedCeil(priceInPennies / itemCount / 100, 2)
    );
    var priceInDollars = formatter.format(toFixedCeil(priceInPennies / 100, 2));

    var $note = null;
    if (1 == style) {
      $note = $(`
        <div class="a-section a-spacing-small aok-align-center">
          <span class="a-size-small" title="${itemCount} @ ${priceInDollars}" style="${STYLE_ESTIMATED}">
            ${perItem}/${i18n.item}
          </span>
        </div>
      `);
    } else {
      $note = $(`
        <div class="a-section a-spacing-small aok-align-center">
          <span class="a-size-small">
            <span style="${STYLE_ESTIMATED}">${i18n.estimated(perItem)}</span>
            <span class="a-color-secondary">(${itemCount} @ ${priceInDollars})</span>
          </span>
        </div>
      `);
    }

    $note.addClass(klass || ID).insertAfter($sibling);
  }

  /**
   * @typedef {Object} PriceTuple
   * @property {string} price String representation of price with $ prefix
   * @property {Number} dollars
   * @property {Number} cents
   * @property {Number} pennies (dollars * 100) + pennies
   */

  /**
   * Convert price string to a tuple of
   *   [ Full price string with $, Dollars, Cents, TotalPennies]
   *
   * Takes:
   *  $1,234.99 = $1,234.99
   *  $.50  = $0.50
   *  $0.22  = $0.22
   *  $1 = $1.00
   *  bacon $ 123 . 99 potato
   *  123
   *  123 99
   *  123<sup>99</sup>
   *
   *
   * @param {string} price
   * @returns {PriceTuple|null} null on error
   */
  function parsePrice(price) {
    if (!price) {
      return null;
    }
    price = price.trim();
    if (!price) {
      return null;
    }

    var whole = NaN;
    var cents = NaN;
    // TODO: i18n currency sign, thousands sep, fraction sep
    var match = price.match(/\$ *([0-9,]*) *\. *(\d*)/);
    if (!match) {
      // TODO: i18n thousands sep, fraction sep
      // Try without dollar sign
      match = price.match(/([0-9,]*) *\. *(\d*)/);
    }
    if (match && match.length === 3) {
      // TODO: i18n thousands sep
      var m1 = match[1].replace(/,/g, "").trim();
      var m2 = match[2].trim();
      whole = m1 ? parseInt(m1, 10) : 0;
      cents = m2.trim() ? parseInt(m2, 10) : 0;
    } else {
      if (!parsePrice.CHAR_0) {
        // init
        parsePrice.CHAR_0 = "0".charCodeAt(0);
        parsePrice.CHAR_9 = "9".charCodeAt(0);
      }
      // No decimal means we might be dealing with something like
      // `44<sup>99</sup>`
      var wholeStr = "";
      var centsStr = "";
      var state = 0;
      for (var i = 0; i < price.length; i++) {
        var c = price.charCodeAt(i);
        if (c < parsePrice.CHAR_0 || c > parsePrice.CHAR_9) {
          // Invalid character
          if (1 === state) {
            if (THOUSANDS_SEPARATOR === price[i]) {
              // Ignore commas
              continue;
            }
            // Advance to cents
            state++;
          } else if (state >= 3) {
            // Done with cents, we're done with the loop
            break;
          }
          continue;
        }
        // valid char
        switch (state) {
          case 0: // pre-dollars
            state++; // fall-through
          case 1: // dollars
            wholeStr += price[i];
            break;
          case 2: // post-dollars, pre-cents
            state++; // fall-through
          case 3: // cents
            centsStr += price[i];
            break;
          default:
            throw new Error("Unknown state " + state);
        }
      }
      if (wholeStr || centsStr) {
        whole = wholeStr ? parseInt(wholeStr, 10) : 0;
        cents = centsStr ? parseInt(centsStr, 10) : 0;
      }
    }

    if (isNaN(whole) || isNaN(cents)) {
      return null;
    }
    let pennies = cents + whole * 100;
    return {
      dollars: whole,
      cents: cents,
      pennies: pennies,
      price: formatter.format(pennies / 100),
    };
  }

  function parsePriceToPennies(priceText) {
    var result = parsePrice(priceText);
    return result ? result.pennies : null;
  }

  // Gets called for each search page product item
  // eg: https://www.amazon.com/s?k=air+duster&i=office-products
  function newSearchPageItem($item) {
    function localLog() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("newSearchPageItem");
      log.apply(log, args);
    }

    var itemId = searchPageItemCounter++;
    localLog(itemId, $item);

    if (!$item.data("asin")) {
      localLog("No asin, likely suggested item container, skipping");
      return;
    }

    // There's no longer an easy way to snag the title so we have to
    // figure the "title" is any element that's not the price.
    // Additionally, it seems css class prefixes change by the day so we have
    // to use goofy selectors.
    var $title = null;
    var $price = null;
    var text = [];
    $item.find('a[class*="text-normal"]').each(function () {
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
    text = text.join("\n");
    if (!text || !$title) {
      localLog("Cannot find title", itemId, $item);
      return;
    }

    // Add review links to title
    var parent = $title.parent().parent(); // div > h2 > $title
    // Links are not immediately bound so we must poll for them
    pollUntil({
      success: (url) => {
        var a = generateReviewLinks(url).join("\n");
        parent.append($("<div />").addClass(ID).append(a));
      },
      failure: () => localLog("No title link for ", $item),
      // prop gives us absolute url
      test: () => $title.prop("href"),
      // 100intv * 100loop / 1000ms = 10s (random adds some jitter)
      interval: 100 + Math.floor(Math.random() * 10 + 1),
      loops: 100,
    });

    var countInPack = getCountFromTitle(text);

    if (!countInPack) {
      localLog("Cannot find count", itemId, text, $item);
      return;
    } else if (!$price) {
      localLog("Cannot find price", itemId, text, $item);
      return;
    }

    function getNumberFrom($el) {
      return parseInt($el.text().replace(/[^0-9]/g, ""), 10);
    }

    var whole = getNumberFrom($price.find('[class*="price-whole"]').first());
    var cents = getNumberFrom($price.find('[class*="price-fraction"]').first());

    if (isNaN(whole) || isNaN(cents)) {
      localLog("Bad price", itemId, $item);
      return;
    }

    // Price in pennies
    var price = cents + whole * 100;
    var perItem = formatter.format(toFixedCeil(price / countInPack / 100, 2));
    var priceInDollars = formatter.format(price / 100);

    // Stick the per/item price in a row below the price.
    var $row = $price.closest(".a-row");
    $(`
    <div class="a-row a-spacing-none">
      <div class="a-size-small a-text-normal">
        <span style="${STYLE_ESTIMATED}">${i18n.estimated(perItem)}</span>
        <span class="a-color-secondary">(${countInPack} @ ${priceInDollars})</span>
      </div>
    </div>
    `)
      .addClass(ID)
      .appendTo($row);

    localLog("Success", itemId, $item);
  }

  // In order of preference
  var DETAILS_PAGE_PRICE_SELECTORS = [
    ".a-price.priceToPay .a-offscreen",
    ".a-price.apexPriceToPay .a-offscreen",
    ".a-price.priceToPay",
    ".a-price.apexPriceToPay",
    // Add centerCol because right-col can have subscription prices
    "#centerCol .a-price .a-offscreen",
    // twister
    "#snsDetailPagePrice",
    ".a-price .a-offscreen",
  ];
  var DETAILS_PAGE_PRODUCT_TITLE_SELECTOR = "#productTitle";
  var NEW_ITEM_DETAILS_CLASS = ID + "-newItemDetails";
  var newItemDetailsAbort = new AbortController();
  // Gets called on each product details page
  // https://www.amazon.com/Dust-Off-Compressed-Gas-Duster-Pack/dp/B01MQFCYW0
  // https://www.amazon.com/dp/B01CQOV3YO
  function newItemDetails($title) {
    function localLog() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("newItemDetails");
      log.apply(log, args);
    }
    localLog($title);

    // Abort any previous fetches and create a new controller
    newItemDetailsAbort.abort();
    newItemDetailsAbort = new AbortController();

    // Add review links
    var a = generateReviewLinks(
      window.location.href.split("#")[0],
      "40px"
    ).join("\n");

    $title
      .parent()
      .parent()
      .append($("<div />").addClass(NEW_ITEM_DETAILS_CLASS).append(a));

    // There are many ways a product's price is displayed.
    // When an item has options, such as colors or maybe multi-pack we have
    // to analyze these options too. The options/colors/variance block is called
    // "twister".
    //
    // 1. Single price -- no twister
    // https://www.amazon.com/Gallon-White-Bucket-Lid-Container/dp/B008GMC8RM
    //
    // 2. Single price -- with twister with prices, but no titles (use parent's quantity)
    // https://www.amazon.com/dp/B09L5MRR3L
    // https://www.amazon.com/dp/B016XTADG2 (no quantity just prices)
    //
    // 3. No count, but other options have count but no prices!
    //   We need to query the linked product to get its price :D
    // https://www.amazon.com/dp/B098RX89VV (Double decker: color & size)
    // https://www.amazon.com/dp/B01CRPV4UK
    //
    // 4. Single price with twister where each option has its own price and count.
    // https://www.amazon.com/gp/product/B008KJEYLO
    // https://www.amazon.com/Get-French-Kitchen-Dish-Sponge/dp/B0866QQW9F
    //

    // Count
    var countInPack = getCountFromTitle($title.text());
    if (!countInPack) {
      localLog("No count on details", $title);
    } else {
      var foundPrice = DETAILS_PAGE_PRICE_SELECTORS.some(function (selector) {
        var $price = $(selector);
        if (!$price.is(":visible")) {
          return false;
        }
        var priceInPennies = parsePriceToPennies($price.text());
        if (null !== priceInPennies) {
          addEstimatedToElement(
            priceInPennies,
            countInPack,
            $price,
            0,
            NEW_ITEM_DETAILS_CLASS
          );
          return true;
        }
        return false;
      });
      if (!foundPrice) {
        localLog("failed to find price!", $title);
      }
    }

    // Twister
    $("#twisterContainer li").each(function () {
      var $li = $(this);
      if ($li.hasClass(NEW_ITEM_DETAILS_CLASS)) {
        return;
      }
      $li.addClass(NEW_ITEM_DETAILS_CLASS);

      var $button = $li.find("button");
      if (!$button.length) {
        localLog("Failed to find button", $li);
        return;
      }

      // Try to figure out where we add our augments to.
      // There's many different twister buttons.
      var $addElementsTo = $button.find(".twisterSwatchWrapper");
      if (!$addElementsTo.length) {
        var $innerImg = $button.find("img");
        if ($innerImg.length) {
          // Float the image left because these type of twisters have no style.
          // https://www.amazon.com/dp/B01CRPV4UK
          $innerImg.css("float", "left");
          $addElementsTo = $innerImg.parent();
        } else {
          var $innerDiv = $button.children("div");
          if ($innerDiv.length) {
            $addElementsTo = $innerDiv;
          }
        }
      }

      // Check if this twister item has a price
      var $price = $button.find(".unified-price").first();
      if ($price.length) {
        $addElementsTo = $price.parent().parent();
      }
      // Final sanity fallback to button
      if (!$addElementsTo || !$addElementsTo.length) {
        $addElementsTo = $button;
      }

      var theParsedPrice = parsePrice($price.text());
      // Let's see if it has a title to parse a count out of
      var optionCount = getCountFromTitle($button.text());

      if (null !== theParsedPrice) {
        if (null !== optionCount) {
          // We have all the data we need
          addEstimatedToElement(
            theParsedPrice.pennies,
            optionCount,
            $addElementsTo,
            1,
            NEW_ITEM_DETAILS_CLASS
          );
          // Return because we don't need to query the sub-page.
          return;
        }
        if (null === countInPack) {
          // This page doesn't have a count so it's unlikely any of the
          // twister items to either. Price is already there. Not worth
          // doing a fetch to get Prime status.
          return;
        }
      }

      // Fetch the other product's page and scrape as much as we can :D

      var url = null;
      // Even though dpUrl has the URL we don't want to use it becuase it has possible tracking flags
      var asin = $li.data("defaultasin") || $li.data("csaCItemId");
      if (asin) {
        url = "/dp/" + asin;
      } else {
        url = $li.data("dpUrl");
        if (!url) {
          localLog("Failed to get URL/ASIN for twister li", $li);
          return;
        }
      }

      $addElementsTo.css({ display: "flex", "flex-direction": "column" });

      // Shove a ... div below the button of this option to signal prices are
      // loading. It will be updated later.
      var $loading = $(
        `<div class="${NEW_ITEM_DETAILS_CLASS}" style="${STYLE_ESTIMATED} text-align:center; line-height:1em;">...</div>`
      ).appendTo($addElementsTo);

      // Fetch the products product page and parse the price out.
      fetch(url, { signal: newItemDetailsAbort.signal })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch " + url);
          }
          return res.text();
        })
        .then((html) => {
          const parser = new DOMParser();
          const htmlDoc = parser.parseFromString(html, "text/html");

          // Only update price if it wasn't found
          var foundPrice = null;
          var countInDetail = getCountFromTitle(htmlDoc.title);
          var $primeHtml = null;
          if (null === theParsedPrice) {
            foundPrice = _findPagePriceInHtml(htmlDoc);
            $primeHtml = $(
              '<span class="a-icon-prime-with-text a-color-secondary aok-align-center a-size-small"></span>'
            );
            if (null !== foundPrice) {
              var featureHtml =
                $("#priceBadging_feature_div").first().html() || "";
              if (-1 !== featureHtml.indexOf("icon-prime")) {
                // Prime icon
                $primeHtml.append(
                  $(
                    '<i class="a-icon a-icon-prime a-icon-mini" role="presentation"></i>'
                  )
                );
                // One-Day, Two-Day, Same-Day
                var primeCtx = $("#priceBadging_feature_div")
                  .first()
                  .text()
                  .match(/\w+-[Dd]ay/);
                if (primeCtx) {
                  $primeHtml.append(
                    $(
                      // Leave the trailing whitespace!
                      '<span style="white-space:nowrap;"> ' +
                        primeCtx[0] +
                        "</span>"
                    )
                  );
                }
              }
            } else {
              if (null === theParsedPrice) {
                // Throw because if we don't have price we can't do anything
                throw new Error("Failed to parse price");
              }
              foundPrice = theParsedPrice;
            }
          }

          // Scrape the title too in case this twister item has a count
          // and the parent does not.
          var variantTitle = htmlDoc.querySelector(
            DETAILS_PAGE_PRODUCT_TITLE_SELECTOR
          );
          var variantCount = null;
          if (variantTitle) {
            variantCount = getCountFromTitle(variantTitle.textContent);
          }

          // Display results
          if (null !== foundPrice) {
            if (null !== countInDetail) {
              addEstimatedToElement(
                foundPrice.pennies,
                countInDetail,
                $addElementsTo,
                1,
                NEW_ITEM_DETAILS_CLASS
              );
            }
            $loading.text("");
            $loading.append($("<div>" + foundPrice.price + "</div>"));
            $loading.append($primeHtml);
          } else {
            $loading.remove();
          }
        })
        .catch((e) => {
          $loading.text("!");
          $loading.css("font-weight", "bold");
          $loading.css("color", "red");
          localLog("twister fetch error: " + url, $li, e);
        });
    });
  }

  function _findPagePriceInHtml(htmlDoc) {
    for (var s = 0; s < DETAILS_PAGE_PRICE_SELECTORS.length; s++) {
      var items = htmlDoc.querySelectorAll(DETAILS_PAGE_PRICE_SELECTORS[s]);
      if (!items) {
        continue;
      }
      for (var i = 0; i < items.length; i++) {
        var parsed = parsePrice(items[i].textContent);
        if (parsed) {
          return parsed;
        }
      }
    }
    return null;
  }

  // Suggested items are towards the bottom of a product page
  // "Customers who shopped for this item, also purchased..."
  function newSuggestedItem($item) {
    function localLog() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("newSuggestedItem");
      log.apply(log, args);
    }
    localLog($item);

    var $a = $item.find("a.a-link-normal.a-text-normal").first();
    var addTo = $a.parent().parent();

    // Review buttons
    var a = generateReviewLinks($a.prop("href")).join("\n");
    addTo.append(
      $(
        '<div class="a-size-mini a-spacing-none a-spacing-top-small ' +
          ID +
          '_sug" />'
      )
        .addClass(ID)
        .append(a)
    );

    var title = $a.text().trim();
    if (!title) {
      title = $item.find("a[href] > span").text().trim();
    }
    var countInPack = getCountFromTitle(title);

    if (!countInPack) {
      //localLog("No count", $item);
      return;
    }

    var $price = $item.find(".a-price > span").first();
    var parsed = parsePrice($price.text().trim());
    if (!parsed) {
      localLog("Bad price", title, "item:", $item, "<a>:", $a);
      return;
    }

    var perItem = formatter.format(
      toFixedCeil(parsed.pennies / countInPack / 100, 2)
    );
    var priceInDollars = parsed.price;

    $price
      .parents(".a-row")
      .first()
      .after(
        `
      <div class="a-row a-text-normal ${ID}">
        <span style="${STYLE_ESTIMATED}">${i18n.estimated(perItem)}</span>
        <span class="a-color-secondary">(${countInPack} @ ${priceInDollars})</span>
      </div>
      `
      );
  }

  // Called once jQuery is loaded and page is ready
  function main() {
    log("Starting Main");

    // This is the only way to get jQuery on the damn page.
    // We can't share a reference to it either.
    // This is something seemingly unique to FF, but should be fine in both.
    if (DEBUG && !unsafeWindow.$ && !unsafeWindow.jQuery && !unsafeWindow.$j) {
      GM_xmlhttpRequest({
        method: "GET",
        url: "https://code.jquery.com/jquery-3.3.1.slim.min.js",
        onload: function (response) {
          var src = 'var JQ_DO_NO_CONFLICT = typeof $ !== "undefined";\n\n';
          src += response.responseText;
          src +=
            "\n\n" +
            `
          if (JQ_DO_NO_CONFLICT) {
            window.$j = $.noConflict(true);
            console.log("%cInjected jQuery as $j", "color:blue");
          } else {
            console.log("%cInjected jQuery as $", "color:blue");
          }
          `;

          var script = document.createElement("script");
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
      ".s-result-item",
      noDupes(ID + "-newSearchPageItem", newSearchPageItem),
      false
    );
    // Individual product page
    waitForKeyElements(
      DETAILS_PAGE_PRODUCT_TITLE_SELECTOR,
      noDupes(ID + "-newItemDetails", newItemDetails),
      false
    );
    // Suggested items on the individual product pages
    waitForKeyElements(
      '.a-carousel-card[role="listitem"]',
      noDupes(ID + "-newSuggestedItem", newSuggestedItem),
      false
    );
  }

  if (returnExports) {
    return {
      buildTitleParser: buildTitleParser,
      pollUntil: pollUntil,
      parsePrice: parsePrice,
    };
  }

  // Wait for jQuery to be loaded
  if (window.$) {
    log("jQuery is on the page, starting main");
    $(main);
  } else {
    log("waiting for jQuery");
    var waitForJQ = null;
    var count = 0;
    var clearWaitForJQ = function () {
      if (waitForJQ) {
        window.clearInterval(waitForJQ);
        waitForJQ = null;
      }
    };
    waitForJQ = window.setInterval(function () {
      count++;
      if (window.$ && waitForJQ) {
        log("Found jQuery and starting main");
        clearWaitForJQ();
        $(main);
      } else if (count > 300) {
        // About 30 seconds
        clearWaitForJQ();
        console.error(ID, "After 30 seconds could not load jQuery");
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
  function pollUntil(
    successOrObj,
    failure,
    test,
    validator,
    interval,
    loops,
    _iniL
  ) {
    var success = successOrObj;
    if (typeof successOrObj === "object") {
      // Extract params
      success = successOrObj.success;
      failure = failure || successOrObj.failure;
      test = test || successOrObj.test;
      validator = validator || successOrObj.validator;
      interval = interval || successOrObj.interval;
      loops = loops || successOrObj.loops;
    }
    // Validate on first run only
    if (typeof _ol !== "number") {
      success = success || noop;
      if (typeof test !== "function") {
        throw Error("success must be a function or null");
      }
      failure = failure || noop;
      if (typeof test !== "function") {
        throw Error("failure must be a function or null");
      }
      if (typeof test !== "function") {
        throw Error(
          "test must be a function (how else else are we gonna test?)"
        );
      }
      if (validator && typeof validator !== "function") {
        throw Error("validator must be a function");
      }
      if (typeof interval !== "number") {
        throw Error("interval must be a number");
      }
      if (typeof loops !== "number") {
        throw Error("loops must be a number");
      }
      if (loops < 1) {
        throw Error(
          "You cannot start pollUntil with anything less than 1 loop"
        );
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
    setTimeout(
      pollUntil,
      interval,
      success,
      failure,
      test,
      validator,
      interval,
      nextLoops,
      _iniL
    );
  }

  function buildTitleParser(expose) {
    expose = expose || {};
    const qualWords = "(?:[a-zA-Z\\-]+(?: |-)?){1,4}"; // We allow up to 4 words
    const qualNumbers = "\\d[\\d,. ]*"; // Allow 1,234 1.234 1 234
    const qualQty = "(?:(" + qualNumbers + ")|(" + qualWords + "))";
    /*
    Qualifiers -
    These are the overall matches that we use to identify packs.
    The first index is the "prefix"
    and the second index is the "suffix"
    wherein the number (be it a digit or words) lies between.
    Both values will be added to a regex so make it work correctly.
    Ensure any groups () are non-capturing (?:...).
    If supplying a RegExp directly, ensure the case-insensitive flag is set and
    there are exactly 2 capturing groups. The first group is for digits, the
    second is words (see `qualQty`).
    */
    var qualifiers = [
      ["", " per \\w"], // X per Box. X per pack.
      ["", "[ /-]*pack"], // 2 pack or 2-pack or 2 -pack or 2pack (but not "packs")
      ["", "[ ,]*count"], // 4 count or 4, count or 4Count
      ["\\w+ of ", ""], // foobar of X: pack of 3, box of 12
      ["", "[ -]*pieces"], // 2 pieces
      ["", "[ -]*pcs"], // 2 pcs

      ["lots? de ", ""], // Lot de 7
      new RegExp("^(?:(" + qualNumbers + ")|(\\x00))", "i"), // 2 things
    ];

    var regExes = qualifiers
      .filter((q) => !!q)
      .map(function (qual) {
        if (qual instanceof RegExp) {
          return qual;
        }
        return new RegExp("\\b" + qual[0] + qualQty + qual[1] + "\\b", "i");
      });

    // Let's build all word numbers
    // https://stackoverflow.com/a/493788/721519

    // Some common slang for numbers
    var numberSlang = {
      2: ["twin", "double"],
      3: ["triple"],
      4: ["quad"],
    };

    var units = [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
      "fifteen",
      "sixteen",
      "seventeen",
      "eighteen",
      "nineteen",
    ];
    var tens = [
      "",
      "",
      "twenty",
      "thirty",
      "forty",
      "fifty",
      "sixty",
      "seventy",
      "eighty",
      "ninety",
    ];
    var scales = ["hundred", "thousand", "million", "billion", "trillion"];

    if (country === "fr") {
      // TODO : use const { ToWords } = require('to-words'); for all languages
      units = [
        "zero",
        "un",
        "deux",
        "trois",
        "quatre",
        "cing",
        "six",
        "sept",
        "huit",
        "neuf",
        "dix",
        "onze",
        "douze",
        "treize",
        "quatorze",
        "quinze",
        "seize",
        "dix-sept",
        "dix-huit",
        "dix-neuf",
      ];
      tens = [
        "",
        "",
        "vingt",
        "trente",
        "quarante",
        "cinquantte",
        "soixante",
        "soixante-dix",
        "quatre-vingt",
        "quatre-vingt-dix",
      ];
      scales = ["centaine", "millier", "million", "milliard", "trilliard"];
    }

    /* numberWords */
    // Build numberWords which will be a map for all words to a tuple that will
    // descibe the value of the word.
    var numberWords = {
      and: [1, 0],
    };
    units.forEach(function (word, i) {
      numberWords[word] = [1, i];
    });
    tens.forEach(function (word, i) {
      if (word) {
        numberWords[word] = [1, i * 10];
      }
    });
    scales.forEach(function (word, i) {
      numberWords[word] = [Math.pow(10, i * 3 || 2), 0];
    });
    Object.keys(numberSlang).forEach(function (num) {
      numberSlang[num].forEach(function (word) {
        numberWords[word] = [1, parseInt(num, 10)];
      });
    });

    function handleMatch(match, logIndent) {
      logIndent = logIndent || "";
      if (!match) {
        log(logIndent + "no match");
        return null;
      }
      var digits = match[1];
      var text = match[2];

      // Digits trump text numbers
      if (digits) {
        log(logIndent + "digits=" + digits);
        digits = digits.replace(/[ .,]/g, "");
        var d = parseInt(digits, 10);
        if (d && !isNaN(d)) {
          log(logIndent + "parsed int=" + d);
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
      return typeof result === "number" && result > 0 ? result : null;
    }

    // Parse a string for a count
    function parseTitle(title) {
      title = (title || "").trim().toLowerCase();
      for (var i = 0; i < regExes.length; i++) {
        var exp = regExes[i];
        exp.lastIndex = 0; // Reset it

        log("parseTitle title=" + title);
        var result = handleMatch(title.match(exp), "  ");
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
    selectorTxt /* Required: The jQuery selector string that
                      specifies the desired element(s).
                  */,
    actionFunction /* Required: The code to run when elements are
                      found. It is passed a jNode to the matched
                      element.
                  */,
    bWaitOnce /* Optional: If false, will continue to scan for
                      new elements even after the first match is
                      found.
                  */,
    iframeSelector /* Optional: If set, identifies the iframe to
                      search.
                  */
  ) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined") targetNodes = $(selectorTxt);
    else targetNodes = $(iframeSelector).contents().find(selectorTxt);

    if (targetNodes && targetNodes.length > 0) {
      btargetsFound = true;
      /*--- Found target node(s).  Go through each and act if they
          are new.
      */
      targetNodes.each(function () {
        var jThis = $(this);
        var alreadyFound = jThis.data("alreadyFound") || false;

        if (!alreadyFound) {
          //--- Call the payload function.
          var cancelFound = actionFunction(jThis);
          if (cancelFound) btargetsFound = false;
          else jThis.data("alreadyFound", true);
        }
      });
    } else {
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
    } else {
      //--- Set a timer, if needed.
      if (!timeControl) {
        timeControl = setInterval(function () {
          waitForKeyElements(
            selectorTxt,
            actionFunction,
            bWaitOnce,
            iframeSelector
          );
        }, 300);
        controlObj[controlKey] = timeControl;
      }
    }
    waitForKeyElements.controlObj = controlObj;
  }
});
