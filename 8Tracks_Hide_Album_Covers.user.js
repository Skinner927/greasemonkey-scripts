// ==UserScript==
// @name         Hide 8Tracks Album Covers
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/8Tracks_Hide_Album_Covers.user.js
// @author       skinner927
// @version      1.1
// @match        https://8tracks.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/* Changelog *
 * 1.1 - Fix button text wrapping on Windows
 * 1.0 - Initial release
 */

(function () {
  'use strict';

  var COVER_CSS_CLASS = 'ds-art-cover';

  var HIDE_COVERS_VAL_KEY = 'DS_HIDE_ART_COVERS';
  var HIDE_COVERS = strToBool(GM_getValue(HIDE_COVERS_VAL_KEY, true));

  var SHOW_COVERS_HOVER_KEY = 'DS_SHOW_ART_COVERS_HOVER';
  var SHOW_COVERS_HOVER = strToBool(GM_getValue(SHOW_COVERS_HOVER_KEY, true));

  // stored as int not float (may be string though so always parseInt)
  var COVERS_OPACITY_KEY = 'DS_HIDE_ART_OPACITY';
  var COVERS_OPACITY_DEFAULT = 93;

  // By default we hide covers
  GM_addStyle(`
    .ds-art-cover {
      background: #d4d4d4;
      opacity: 1;
      width: 100%;
      height: 100%;
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
  `);
  // This is toggled
  var ART_COVER_SHOW = `
    .ds-art-cover {
      display: none;
    }
  `;
  // Store refs to style elements
  var artCoverShowStyleElement = GM_addStyle('');
  var artCoverOpacityStyleElement = GM_addStyle('');

  // INIT
  (function init() {
    addConfigMenu();

    if (HIDE_COVERS) {
      hideArtCovers();
    } else {
      showArtCovers();
    }

    // Bind watchers to any art covers that come up
    // Order matters as later covers can't override earlier covers.

    // Single playlist playing page
    waitForKeyElements('div#mix_art_wrapper', addCoverContainer('>a'));
    // So you can still click play for above
    GM_addStyle('.quick_actions { z-index: 2; }');
    // Playlist spotlight on list page
    // This has to come before the generic ones as we need to bind this specially.
    waitForKeyElements('div#featured_collection_mixes div.cover', addCoverContainer('>a', null, null, true));

    // "Related Articles'" on single playlist page
    waitForKeyElements('div.card.blog_card>div.master_image', addCoverContainer());
    // "Related Collections" on single playlist page
    waitForKeyElements('div.suggested_collection.card div.covers', addCoverContainer(null, null, {
      height: '75px',
    }));

    // Covers on the list pages
    waitForKeyElements('div.mix_square div.cover', addCoverContainer('>a', 'div.mix_square'));
    // "Similar Playlists"
    waitForKeyElements('div.card.sidebar_mix div.cover', addCoverContainer('>a'));

    // Grouped covers
    waitForKeyElements('div.covers', addCoverContainer('>a'));
  })();

  function strToBool(value) {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return !!value;
  }

  /**
   * Hide and show art cover functions toggle global CSS that... hide and show
   * the art covers.
   */
  function hideArtCovers() {
    artCoverShowStyleElement.innerHTML = '';
    HIDE_COVERS = true;
    GM_setValue(HIDE_COVERS_VAL_KEY, HIDE_COVERS);
    document.getElementById('ds-art-cover-toggle-button').innerHTML = 'Show Album Covers';
  }
  function showArtCovers() {
    artCoverShowStyleElement.innerHTML = ART_COVER_SHOW;
    HIDE_COVERS = false;
    GM_setValue(HIDE_COVERS_VAL_KEY, HIDE_COVERS);
    document.getElementById('ds-art-cover-toggle-button').innerHTML = 'Hide Album Covers';
    // Safety first
    $('.' + COVER_CSS_CLASS).css('display', '');
  }

  function toggleShowCoversOnHover() {
    SHOW_COVERS_HOVER = !SHOW_COVERS_HOVER;
    GM_setValue(SHOW_COVERS_HOVER_KEY, SHOW_COVERS_HOVER);
    var txt = SHOW_COVERS_HOVER ?
      'Don\'t Show Album on Hover' :
      'Show Album on Hover';
    document.getElementById('ds-art-cover-hover-toggle-button').innerHTML = txt;
  }

  function updateArtCoverOpacity(value) {
    value = parseInt(value, 10);
    GM_setValue(COVERS_OPACITY_KEY, value);
    // Simply update the element
    artCoverOpacityStyleElement.innerHTML = [
      '.ds-art-cover {',
      ' opacity: ' + (value / 100) + ';',
      '}',
    ].join('');
  }

  function addCoverContainer(wrapperSelector, hoverElementSelector, customCss, clobber) {
    /**
     * Function is meant to be passed in as the second argument to
     *  `waitForKeyElements().`
     *
     * The element resolved by `waitForKeyElements()` is our "container".
     * By default, we'll use the "container" as our wrapper. The wrapper is
     * where we'll add the `.ds-art-cover` element to block the cover image.
     * If `wrapperSelector` is specified we'll use
     * `container.find(wrapperSelector)` to resolve the wrapper, otherwise the
     * container will be the wrapper. If the wrapper already contains a
     * `div.ds-art-cover` we'll skip adding the cover entirely.
     *
     * By default we bind the `hover()` listener to the container. If
     * `hoverElementSelector` is specified, we'll use that selector instead.
     * If `hoverElementSelector` is a string, we'll resolve the hover element
     * with `cover.closest(hoverElementSelector)` which will look from the
     * cover up to the HTML node. If `hoverElementSelector` is a function
     * we'll pass the `cover` element to the function and use the result
     * of the function as the element to bind `hover()` to.
     *
     * @param {string|null} [wrapperSelector=container] Optional jQuery Selector
     *  for resolving the wrapper where we put the cover hider.
     * @param {string|function|null} [hoverElementSelector=container] Optional
     *  JQuery selector or function that is given `cover` element and result is
     *  used as the `hover()` element.
     * @param {object|null} [customCss=null] Optional dictionary/object of
     *  custom css for the cover element.
     * @param {bool} [clobber=false] If true, we'll remove any child cover
     *  elements before adding ours.
     */
    return function addCover(container) {
      /**
       * @param {jQuery} container Element specified to waitForKeyElements
       */
      var wrapper = wrapperSelector ? container.find(wrapperSelector) : container;

      var children = wrapper.find('div.' + COVER_CSS_CLASS);
      if (!children.empty()) {
        if (!clobber) {
          // Skip this one
          return;
        }
        // clobber
        children.remove();
      }

      // Add the cover
      var cover = $('<div class="' + COVER_CSS_CLASS + '" />');
      if (customCss) {
        cover.css(customCss);
      }
      wrapper.append(cover);

      // Resolve hover element
      var hoverElement = container;
      if (hoverElementSelector) {
        if (typeof hoverElementSelector === 'function') {
          hoverElement = hoverElementSelector(cover);
        } else {
          hoverElement = cover.closest(hoverElementSelector).first();
        }
      }

      // We set display on our element explicitly when we're hovering it,
      // but global CSS takes care of it otherwise.
      hoverElement.hover(function () {
        // Hover in
        if (HIDE_COVERS && SHOW_COVERS_HOVER) {
          cover.css('display', 'none');
        }
      }, function () {
        // Hover out
        cover.css('display', '');
      });
    };
  }

  function addConfigMenu() {
    /**
     * This creates the configuration menu up top.
     * We're currently using the 'EightTrax' font for an icon.
     */
    GM_addStyle(`
      #ds-art-cover-menu {
        position: absolute;
        top: 0;
        right: 0;
        font-size: 15px;
        line-height: 16px;
      }

      /* Mostly snagged from search button */
      .ds-art-cover-menu-btn {
        font-size: 15px;
        font-weight: bold;
        position: absolute;
        top: 0px;
        right: 0px;
        height: 36px;
        padding-top: 11px;
        line-height: 16px;
        width: 36px;
        text-align: center;
        color: #fff;
        border-radius: 19px;
        z-index: 15;
        overflow: hidden;
        opacity: 1;
      }

      .ds-art-cover-icon {
        font-family: "EightTrax";
        speak: none;
        font-style: normal;
        font-weight: normal;
        font-variant: normal;
        text-transform: none;
        line-height: 1;
        text-decoration: none !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;

        font-size: 15px;
        font-weight: 700;
        line-height: 15px;
        min-width: 36px;
        width: 36px;
      }
      .ds-art-cover-icon.eye:before {
        content: "\\\e943";
      }

      .ds-art-cover-menu-drop {
        position: absolute;
        top: 40px;
        left: -15px;
        transform: translateX(-50%);
        min-width: 220px;
        background: #eee;
        border: 2px solid #0394da;
        border-radius: 10px;
        padding: 10px;

        display: none;
      }

      .ds-art-cover-menu-drop > div {
        margin-bottom: 7px;
      }
      .ds-art-cover-menu-drop > div:last-child {
        margin-bottom: 0;
      }

      .ds-art-cover-menu-button {
        width: 100%;
        display: block;
        white-space: nowrap;
      }

      .ds-art-cover-slider-container {
        display: flex;
      }
      .ds-art-cover-slider {
        flex-grow: 1;
      }
    `);

    var menu = $('<div id="ds-art-cover-menu"></div>').appendTo('#header_middle');

    ////
    // Create the menu button and dropdown where our input lives
    var menuButton = $(`<a href="javascript:void 0;" class="ds-art-cover-menu-btn button_blue">
      <i class="ds-art-cover-icon eye"></i>
    </a>`.trim()).appendTo(menu);
    var menuDrop = $('<div class="ds-art-cover-menu-drop" />')
      .appendTo(menu);
    menuButton.click(function () {
      var flipped = menuDrop.css('display') === 'none' ? 'block' : 'none';
      menuDrop.css('display', flipped);
    });

    ////
    // Toggle show/hide album covers
    // Gets updated every time we toggle
    var toggleBtn = $('<button class="ds-art-cover-menu-button" ' +
      'id="ds-art-cover-toggle-button">Toggle Cover</button>');
    toggleBtn.click(function () {
      if (!HIDE_COVERS) {
        hideArtCovers();
      } else {
        showArtCovers();
      }
    });
    menuDrop.append($('<div />').append(toggleBtn));

    ////
    // Toggle what we do on hover
    // Gets updated every time we toggle show on hover
    var hoverBtn = $('<button class="ds-art-cover-menu-button" ' +
      'id="ds-art-cover-hover-toggle-button">Toggle Hover</button>');
    hoverBtn.click(() => toggleShowCoversOnHover());
    menuDrop.append($('<div />').append(hoverBtn));
    // This will init the toggle button text
    SHOW_COVERS_HOVER = !SHOW_COVERS_HOVER;
    toggleShowCoversOnHover();

    ////
    // Opacity slider
    var sliderValue = $('<span style="width:35px; text-align:right;" />');
    var slider = $('<input type="range" min="1" max="100" class="ds-art-cover-slider" />');
    // Updates
    // This will update the UI
    var updateSliderVal = function (val) {
      sliderValue.html(val + '%');
    };
    // This will update the CSS with a debounce so we don't go nuts
    var applySliderUpdate = debounce(function (val) {
      updateArtCoverOpacity(val);
    }, 20);
    slider.on('input', function () {
      var val = parseInt(slider.val(), 10);
      updateSliderVal(val);
      applySliderUpdate(val);
    });
    slider.on('change', () => applySliderUpdate.flush());
    // Build slider container
    var sliderContainer = $('<div class="ds-art-cover-slider-container" />');
    sliderContainer.append(slider);
    sliderContainer.append(sliderValue);
    menuDrop.append(sliderContainer);
    // Get current value
    var val = parseInt(GM_getValue(COVERS_OPACITY_KEY, COVERS_OPACITY_DEFAULT), 10);
    // initial update
    updateArtCoverOpacity(val);
    slider.val(val);
    updateSliderVal(val);
  }

  //===========================================================================
  // Libraries
  //===========================================================================

  /*
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
      targetNodes.each(function () {
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
        timeControl = setInterval(function () {
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

    var debounced = function () {
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

    debounced.clear = function () {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    debounced.flush = function () {
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
