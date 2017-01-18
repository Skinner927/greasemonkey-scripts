// ==UserScript==
// @name         Lowes credit login fix.
// @namespace    http://dennisskinner.com
// @version      0.1
// @description  Lowes credit card login is broken with adblockers/ghostery
// @author       Dennis Skinner
// @match        https://credit.lowes.com/LowesMarketing/marketing/LowesLogin.jsp
// @grant        none
// ==/UserScript==
/* jshint -W097 */
'use strict';

window.fnCheckLoginSubmit = function(){};