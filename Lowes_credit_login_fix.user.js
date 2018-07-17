// ==UserScript==
// @name         Lowes credit login fix.
// @namespace    https://github.com/Skinner927/greasemonkey-scripts
// @version      0.1
// @description  Lowes credit card login is broken with adblockers/ghostery
// @author       skinner927
// @match        https://credit.lowes.com/LowesMarketing/marketing/LowesLogin.jsp
// @grant        none
// ==/UserScript==
/* jshint -W097 */
'use strict';

window.fnCheckLoginSubmit = window.fnCheckLoginSubmit || function(){};
