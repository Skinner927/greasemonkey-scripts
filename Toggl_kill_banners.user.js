// ==UserScript==
// @name         Toggl Kill Banner
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @version      0.2
// @description  Kills annoying banners in Toggl
// @author       skinner927
// @match        https://www.toggl.com/*
// @match        http://www.toggl.com/*
// @grant        none
// ==/UserScript==

window.setInterval(function(){
    var el = document.getElementById('badge-notifications');
    if(el !== null){
        el.style.display='none';
    }
}, 1000);
