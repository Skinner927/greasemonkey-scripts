// ==UserScript==
// @name         Unanet modifications
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/unanet.user.js
// @icon         https://www.google.com/s2/favicons?domain=unanet.biz
// @author       skinner927
// @version      1.0
// @match        *://*.unanet.biz/*
// @run-at       document-end
// @require      https://yestacos.com/raw/Nycto/PicoModal/master/src/picoModal.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/selectize.js/0.13.3/js/standalone/selectize.min.js
// @resource     SELECTIZE_DEFAULT_CSS https://cdnjs.cloudflare.com/ajax/libs/selectize.js/0.13.3/css/selectize.default.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

/* Changelog *
 * 1.0 - Initial release.
 */

(function unanetGMMod() {
  'use strict';
  const ID = 'unanetgmmod';
  const IGNORE_CLASS = ID + '-ignore'
  // Add css
  GM_addStyle(GM_getResourceText('SELECTIZE_DEFAULT_CSS'));
  GM_addStyle(`
    .unanet-gm-button {
      border: 1px solid black;
      padding: 2px;
      cursor: pointer;
    }
  `)

  // Handle select elements
  waitForKeyElements(
    'select',
    noDupes(ID + '-select', handleNewSelect),
    false
  );

  function handleNewSelect($select) {
    const elSelect = $select[0];
    if (!elSelect.multiple) {
      return;
    }
    var launchBtn = document.createElement('span');
    //elSelect.parentElement.appendChild(launchBtn);
    $select.after(launchBtn);
    launchBtn.innerText = 'popout';
    launchBtn.classList.add('unanet-gm-button');
    launchBtn.addEventListener('click', function launchBtnClick() {
      var btnBar = '<div><span class="unanet-gm-button cancel">cancel</span><span class="unanet-gm-button save" style="float:right">save</span></div>';
      picoModal({
        content: '<div>' + btnBar + '<br><br><div class="' + IGNORE_CLASS + '">' + elSelect.outerHTML + '</div></div>',
        width: 'auto',
        closeButton: false,
        modalStyles: function (styles) {
          styles.overflow = 'visible';
          styles['min-width'] = '800px';
          return styles;
        },
      })
        .afterCreate(function(modal){
          var $newSelect = $(modal.modalElem().getElementsByTagName('select')[0]);
          $newSelect.val($select.val());
          $newSelect.selectize({});
          var selectizeInstance = $newSelect[0].selectize;

          modal.modalElem().addEventListener('click', function(e) {
            if (e.target.classList.contains('item')) {
              selectizeInstance.removeItem(e.target.dataset.value);
              selectizeInstance.refreshItems();
              selectizeInstance.refreshOptions();
            }
          });
          modal.modalElem().querySelector('span.unanet-gm-button.cancel').addEventListener('click', function cancelClick() {
            modal.close();
          });
          modal.modalElem().querySelector('span.unanet-gm-button.save').addEventListener('click', function saveClick() {
            $select.val($newSelect.val());
            modal.close();
          });
        })
        .afterClose(function launchBtnModalAfterClose(modal) {
          modal.destroy();
        })
        .show();
    });
  }

  function noDupes(key, fn) {
    return function wrapper($el) {
      if (!$el.data(key)) {
        $el.data(key, '1');
        if ($el.hasClass(IGNORE_CLASS) || $el.parent().hasClass(IGNORE_CLASS)) {
          // skip
          return;
        }
        fn($el);
      }
    };
  }

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
