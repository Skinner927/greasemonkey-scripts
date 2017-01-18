// ==UserScript==
// @name         Toggl Kill Banner
// @namespace    http://toggl.gm.dennisbskinner.com
// @version      0.2
// @description  Kills annoying banners in Toggl
// @author       Dennis Skinner
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