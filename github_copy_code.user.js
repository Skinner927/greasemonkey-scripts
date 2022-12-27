// ==UserScript==
// @name         GitHub Copy Code
// @description  Add a "copy" button when browsing GitHub source code.
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/github_copy_code.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @author       skinner927
// @version      1.0
// @match        *://github.com/*
// @match        *://gist.github.com/*
// @connect      github.com
// @connect      raw.githubusercontent.com
// @connect      gist.github.com
// @connect      gist.githubusercontent.com
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  var state = {};
  var rawCopyId = "raw-copy";
  var disabled = "disabled";

  var greenBg = "#a8f1c6";
  var redBg = "#f6a7a3";

  function resetCopyBg() {
    if (state.bgTimeout) {
      window.clearTimeout(state.bgTimeout);
      state.bgTimeout = null;
    }
    var a = document.getElementById(rawCopyId);
    if (a) {
      a.style.background = "";
      a.classList.remove(disabled);
    }
  }

  function copyDone(success) {
    resetCopyBg();

    var a = document.getElementById(rawCopyId);
    if (!a) {
      return;
    }
    var svg = a.querySelector("svg");
    if (svg) {
      svg.style.display = "none";
    }

    a.style.background = success ? greenBg : redBg;
    state.bgTimeout = window.setTimeout(resetCopyBg, 1000);
  }

  function copyClickedHandler(url) {
    return function copyClickedAction(e) {
      if (!e || !e.target || e.target.id !== rawCopyId) {
        return;
      }
      var svg = e.target.querySelector("svg");
      if (!svg) {
        return;
      }

      resetCopyBg();
      e.preventDefault();
      if (e.target.classList.contains(disabled)) {
        return;
      }
      e.target.classList.add(disabled);
      svg.style.display = "block";

      // Request the raw page
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        //responseType: 'blob',
        onload: function copyOnLoad(result) {
          GM_setClipboard(result.responseText, "text/plain");
          copyDone(true);
        },
        onerror: copyDone.bind(null, false),
      });
    };
  }

  setInterval(function startGitHubRawDownload() {
    // Check if our button is on the page already
    if (document.getElementById(rawCopyId)) {
      return;
    }

    var rawButton = null;
    var isGist = false;
    if (0 == window.location.host.indexOf("gist.")) {
      isGist = true;
      // Find the  "raw" button on gists
      var elements = document.querySelectorAll(".file-actions > a");
      if (!elements) {
        return;
      }
      for (var i = 0; i < elements.length; i++) {
        if ("Raw" == elements[i].innerText) {
          rawButton = elements[i];
          break;
        }
      }
    } else {
      // "Raw" button
      rawButton = document.getElementById("raw-url");
    }

    if (!rawButton) {
      // No raw button found
      return;
    }

    /* <a class="btn-sm btn BtnGroup-item">Raw</a>*/
    var a = document.createElement("A");
    a.id = rawCopyId;
    a.classList.add("btn-sm", "btn");
    if (!isGist) {
      a.classList.add("BtnGroup-item");
    }
    a.style.position = "relative";
    // https://github.com/SamHerbert/SVG-Loaders
    a.innerHTML =
      'Copy<svg stroke="currentColor" style="position: absolute; top: 0; right: 0; display: none;" width="16" height="16" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke-width="2"><circle cx="22" cy="22" r="1"><animate attributeName="r" begin="0s" calcMode="spline" dur="1.8s" keySplines="0.165, 0.84, 0.44, 1" keyTimes="0; 1" repeatCount="indefinite" values="1; 20"/><animate attributeName="stroke-opacity" begin="0s" calcMode="spline" dur="1.8s" keySplines="0.3, 0.61, 0.355, 1" keyTimes="0; 1" repeatCount="indefinite" values="1; 0"/></circle><circle cx="22" cy="22" r="1"><animate attributeName="r" begin="-0.9s" calcMode="spline" dur="1.8s" keySplines="0.165, 0.84, 0.44, 1" keyTimes="0; 1" repeatCount="indefinite" values="1; 20"/><animate attributeName="stroke-opacity" begin="-0.9s" calcMode="spline" dur="1.8s" keySplines="0.3, 0.61, 0.355, 1" keyTimes="0; 1" repeatCount="indefinite" values="1; 0"/></circle></g></svg>';

    a.addEventListener("click", copyClickedHandler(rawButton.href + ""));

    rawButton.parentElement.appendChild(a);
  }, 250);
})();
