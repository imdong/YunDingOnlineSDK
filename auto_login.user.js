// ==UserScript==
// @name         云顶修仙 自动登录
// @namespace    https://www.qs5.org/?ydxx_auto_login
// @version      0.1
// @description  云顶修仙 自动登录
// @author       ImDong
// @match        http://yundingxx.com:3366/login
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let bcode = location.hash.match(/#autologin=([^\$]+)/);
    if (!bcode) {
        return;
    }

    let info = JSON.parse(decodeURIComponent(atob(bcode[1])));
    if (info) {
        document.getElementById('email').value = info.email;
        document.getElementById('pwd').value = info.pwd;
        window.is_r = true;
        document.getElementById('login-sub').click()
    }

})();
