// ==UserScript==
// @name          YouTube - Disable Red Bar aka SPF
// @namespace     http://userscripts.org/users/23652
// @description   Disables the Red Bar feature on YouTube so some user-scripts work
// @include       http://*.youtube.com/*
// @include       https://*.youtube.com/*
// @include       http://youtube.com/*
// @include       https://youtube.com/*
// @copyright     JoeSimmons
// @version       1.0.0
// @license       GPL version 3 or any later version; http://www.gnu.org/copyleft/gpl.html
// @downloadURL   http://userscripts.org/scripts/source/419926.user.js
// @updateURL     http://userscripts.org/scripts/source/419926.meta.js
// @grant         GM_addStyle
// ==/UserScript==

//Adapted for this extension by Overstruck (github.com/OverStruck)

var script = document.createElement("script");
script.innerHTML = '!function(){function t(){var t=window;t._spf_state&&t._spf_state.config&&(t._spf_state.config["navigate-limit"]=0,t._spf_state.config["navigate-part-received-callback"]=function(t){location.href=t})}t(),window.setInterval(t,1e3)}();';
document.body.appendChild(script);