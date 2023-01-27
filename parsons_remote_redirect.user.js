// ==UserScript==
// @name         Parsons 401 to remote redirect
// @description  Add a window function "parsonsRemote()" that can be invoked in the console to redirect the current page to remote.parsons.us.
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @downloadURL  https://github.com/Skinner927/greasemonkey-scripts/raw/master/parsons_remote_redirect.user.js
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/parsons_remote_redirect.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=parsons.com
// @author       skinner927
// @version      1.0
// @match        *://*.parsons.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function parsonsRemote() {
        var loc = "" + window.location;
        var parts = loc.split("://");
        var protocol = parts.shift();
        var remainder = parts.join("://");

        window.location = "https://remote.parsons.us/" + protocol + "/" + remainder;
    }

    function everySecond(){
        // Export
        if (!window.parsonsRemote) {
            window.parsonsRemote = parsonsRemote;
        }

        // Add a button if we know it's a 401
        if (1 === document.body.childNodes.length
            && "PRE" === document.body.childNodes[0].tagName
            && !document.getElementById("parsons-remote-button")
            && 0 === document.body.childNodes[0].innerText.indexOf("401 ")
           ) {
            var $btn = document.createElement("BUTTON");
            $btn.innerText = "Reload page in remote.parsons.us";
            $btn.id = "parsons-remote-button";
            $btn.type = "button";
            $btn.addEventListener('click', parsonsRemote);
            document.body.insertBefore($btn, document.body.childNodes[0]);
        }
    }

    setInterval(everySecond, 1000);
    everySecond();
})();
