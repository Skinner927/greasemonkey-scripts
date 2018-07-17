// ==UserScript==
// @name         Frontier search redirect
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @version      0.1
// @description  Redirect Frontier ISP searches to google
// @author       skinner927
// @match        http://search.frontier.com/search/*
// @grant        none
// ==/UserScript==
/* jshint -W097 */
'use strict';
var search = unescape(window.location.search);
var match = /\?.*q=([^&]+).*/.exec(search);
var q = match[1];

if(!q){
    return;
}

/**
Usually we end on frontier because it thought we tried to hit a domain
So strip that domain bit out because we didn't actually enter the
http: and trailing slash part.
*/
if(q.indexOf('http') === 0){
    q = q.replace(/https?:\/\//, '');
    if(q.charAt(q.length-1) === '/'){
        q = q.substr(0, q.length - 1);
    }
}

window.location = 'https://www.google.com/#q=' + escape(q);
