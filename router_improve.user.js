// ==UserScript==
// @name         Router Improvements
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @updateURL    https://github.com/Skinner927/greasemonkey-scripts/raw/master/router_improve.user.js
// @author       skinner927
// @version      0.1
// @description  Adds helpful buttons to the router interface
// @match        https://192.168.7.1/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    function _click(el, openClass) {
        if (!el) {
            console.error('No element passed!', openClass, el);
            return;
        }
        if (!el.classList.contains(openClass)) {
            el.click();
        }
    }

    function _clickTab(el, openClass, parentN) {
        openClass = openClass || 'selected'
        if (typeof parentN !== 'number') {
            parentN = 2;
        }
        if (!el) {
            console.error('No element passed!', openClass, parentN, el);
            return;
        }
        var parent = el;
        while(parentN > 0) {
            parent = el.parentElement;
            parentN--;
        }
        if (parent && !parent.classList.contains(openClass)) {
            el.click();
        }
    }

    function _next(fn, delay) {
        if (typeof delay !== 'number') {
            delay = 500;
        }
        setTimeout(fn, delay);
    }

    function openTransmission(next) {
        _click(document.querySelector('a[name="transmisson-control"]'), 'deployed');
        if (next) {
            _next(next);
        }
    }

    function openTransmissionNat(next) {
        openTransmission(function() {
            _click(document.querySelector('a[name="nat"]'), 'selected');
            if (next) {
                _next(next);
            }
        });
    }

    function openTransmissionNatVirtualServers(next) {
        openTransmissionNat(function() {
            _clickTab(document.querySelector('a[data-name="virtual-server"]'));
            if (next) {
                _next(next);
            }
        });
    }

    // Build menu
    GM_addStyle(`
.ds-main-menu {
position: absolute;
top: 0;
left: 50%;
transform: translateX(-50%);
text-align: center;
}
.ds-main-menu button {
display: inline-block;
padding: 4px 8px;
margin: 0 4px;
}
`);

    var mainMenu = document.createElement('div');
    document.querySelector('div.top-header-wrap').appendChild(mainMenu);
    mainMenu.classList.add('ds-main-menu');

    var label = document.createElement('span');
    label.style.color = 'white';
    label.innerHTML = 'Quick Links: ';
    mainMenu.appendChild(label);

    var btnVirtualServers = document.createElement('button');
    btnVirtualServers.innerHTML = 'Virtual Servers';
    btnVirtualServers.addEventListener('click', function() {
        openTransmissionNatVirtualServers();
    });
    mainMenu.appendChild(btnVirtualServers);

})();

