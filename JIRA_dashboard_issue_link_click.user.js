// ==UserScript==
// @name         JIRA Dashboard Issue Click
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @version      0.1
// @description  When clicking an issue number on the jira dashboard, just open the damn thing.
// @author       skinner927
// @match        https://*.atlassian.net/secure/RapidBoard.jspa*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var dataKey = 'fixjiraclick';
    setInterval(function() {
        $('.ghx-row > a').each(function(){
            var a = $(this);
            if (a.data(dataKey)) {
                return;
            }
            a.css('cursor', 'pointer');
            a.data(dataKey, true);
            a.attr('target', '_blank');
            a.click(function(e) {
                e.stopPropagation();
            });
        });
    }, 500);
})();
