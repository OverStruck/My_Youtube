//Firefox - Options.js

//get all strings to translate
var strings = [];
for (var i = 1; i <= 9; i++)
    strings.push("errMsg" + i);

strings.push("lang");
//translate
self.port.emit("translation", strings);
self.port.once("translation", function(response) {
    var translation = response.translation;
    //../locales/es/logo.png
    $("#logo").css("background-image", "url('./locales/" + translation.lang + "/logo.png')");
    main(response.data, translation, response.usage, response.addonVersion);
});

function main(ExtensionData, translation, usage, addonVersion) {
    //dom elements
    var fieldAdd = $('#add-field');
    var btnAdd = $('#btn-add');
    var btnSave = $('#btn-save');
    var btnDel = $('#btn-del');
    var btnClean = $('#btn-clean');
    var btnDwnSettings = $('#btn-downloadSettings');
    var res = $('#response');
    var accountsTable = $('#youtubers');
    var modal = $('.modal:first');

    iniFileLoader();

    //click event listener
    btnAdd.click(addYoutuber);
    btnClean.click(function() {
        ExtensionData.cache = [];
        DB_save(function() {
            err('errMsg8');
        });
    });

    btnSave.click(function() {
        //save the preferences
        $('.pref').each(function(i, value) {
            var self = $(this);
            if (self.attr('type') === 'checkbox') {
                switch (i) {
                    case 0:
                        ExtensionData.prefs['show_popup'] = self.is(':checked');
                        break;
                    case 1:
                        ExtensionData.prefs['play_popup_sound'] = self.is(':checked');
                        break;
                    case 2:
                        ExtensionData.prefs['open_in_current_tab'] = self.is(':checked');
                        break;
                    default:
                        err('errMsg5');
                }
            } else {
                var interval = self.val();
                if (interval === '' || isNaN(interval) || interval % 1 !== 0) {
                    interval = 10;
                    window.alert(translation.errMsg7.replace("<br>", "\n\n"));
                }

                ExtensionData.prefs['check_interval'] = parseInt(interval, 10) * 60000;
            }
        });
        DB_save(function() {
            err('errMsg6');
            btnSave.attr('style', '');
            btnSave.attr('disabled', true);
        });
        return false;
    });
    btnDel.click(function() {
        var account = accountsTable.find('.tbSel').first();
        ExtensionData.channels.splice(parseInt(account.attr('id')), 1);
        account.remove();
        btnDel.attr('disabled', true);
        btnDel.attr('style', '');
        activateSaveBtn();
        return false;
    });
    btnDwnSettings.click(function() {
        //clean cache - we only want the account info and not any videos loaded and stuff
        ExtensionData.cache = [];
        for (var i = ExtensionData.channels.length - 1; i >= 0; i--) {
            //ExtensionData.channels[i].videoTitles = [];
            ExtensionData.channels[i].newVideos = false;
        }
        saveSettings(JSON.stringify(ExtensionData));
        return false;
    });
    fieldAdd.click(function() {
        if (btnAdd.attr('disabled') === 'disabled') {
            btnAdd.attr('disabled', false);
            btnAdd.css('background-color', 'rgb(28, 62, 151)');
        }
        return false;
    });
    //"Enter" keypress event listener
    fieldAdd.keypress(function(e) {
        if (e.which == 13) {
            addYoutuber();
        }
    });
    //load settings
    $('.pref').each(function(i) {
        var self = $(this);
        if (self.attr('type') === 'checkbox') {
            switch (i) {
                case 0:
                    self.prop('checked', ExtensionData.prefs['show_popup']);
                    break;
                case 1:
                    self.prop('checked', ExtensionData.prefs['play_popup_sound']);
                    break;
                case 2:
                    self.prop('checked', ExtensionData.prefs['open_in_current_tab']);
                    break;
                default:
                    err('errMsg5');
            }
            self.change(activateSaveBtn);
        } else {
            self.val(ExtensionData.prefs['check_interval'] / 60000);
            self.focus(activateSaveBtn);
        }
    });
    //percentage of space used
    $('#usage').text(+(Math.round((usage * 100) + "e+2") + "e-2") + '%');
    //show youtubers
    var length = ExtensionData.channels.length;
    var table = $('#youtubers table');
    var columns = ['', '', ''];
    var row = 0;

    for (var j = 0; j < length; j++) {
        columns[row] += '<tr id="' + j + '"><td>► <a href="' + ExtensionData.channels[j].url +
            '" target="_blank">' + ExtensionData.channels[j].name + '</a></td></tr>';
        row++;
        if (row > 2)
            row = 0;
    }
    table.eq(0).html(columns[0]);
    table.eq(1).html(columns[1]);
    table.eq(2).html(columns[2]);

    //highlight youtubers when clicked
    accountsTable.find('tr').click(activateTR);

    function activateTR() {
        accountsTable.find('.tbSel').first().removeClass('tbSel');
        $(this).addClass('tbSel');
        if (btnDel.attr('disabled') === 'disabled') {
            btnDel.attr('disabled', false);
            btnDel.css('background-color', 'rgb(28, 62, 151)');
        }
    }

    function activateSaveBtn() {
        if (btnSave.attr('disabled') === 'disabled') {
            btnSave.attr('disabled', false);
            btnSave.css('background-color', 'rgb(231, 41, 41)');
        }
        return false;
    }

    function addYoutuber() {
        modal.fadeIn('fast');
        var account = fieldAdd.val().trim();
        if (account === '') {
            err('errMsg1');
            return false;
        }
        testYoutuber(account).done(function(response) {
            //console.log(JSON.stringify(response, null, 4))
            account = response.entry.author[0];
            //check if account exists
            if (accountExits(account.name.$t)) {
                err('errMsg2');
                return false;
            }
            var url = response.entry.link[0].href;
            getYoutuber(account.yt$userId.$t).done(function(response2) {
                //show accounts in page
                $('#youtubers table').last().append('<tr><td>► <a target="_blank" href="' + url + '">' +
                    account.name.$t + '</a></td></tr>').find('tr').last().click(activateTR);
                //update extension data
                ExtensionData.channels.push({
                    'id': account.yt$userId.$t,
                    'name': account.name.$t,
                    'thumbnail': response.entry.media$thumbnail.url,
                    'videoTitles': getVideoTitles(response2.feed),
                    'newVideos': false,
                    'url': url
                });
                fieldAdd.val('');
                if (res.text() !== translation['errMsg4'])
                    res.fadeOut('fast');

                activateSaveBtn();
            }).fail(function() {
                err('errMsg9');
            });
        }).fail(function() {
            err('errMsg3');
        });
        modal.fadeOut('fast');
        return false;
    }

    function accountExits(account) {
        for (var i = 0; i < ExtensionData.channels.length; i++) {
            if (ExtensionData.channels[i].name === account) {
                return true;
            }
        }
        return false;
    }

    function err(msg) {
        res.text(translation[msg]).fadeOut('fast').fadeIn('fast');
    }

    function getVideoTitles(data) {
        var entries = data.entry,
            result = [];
        if (entries === undefined) {
            err('errMsg4');
            return result;
        }
        //loop through result to get data
        for (var i = 0; i < entries.length; i++) {
            result.push(entries[i].title.$t);
        }
        return result;
    }

    function testYoutuber(account) {
        return $.ajax({
            url: 'https://gdata.youtube.com/feeds/api/users/' + account,
            dataType: 'json',
            data: {
                v: 2,
                alt: 'json'
            }
        });
    }

    function getYoutuber(account) {
        return $.ajax({
            url: 'https://gdata.youtube.com/feeds/api/users/' + account + '/uploads',
            dataType: 'json',
            cache: false,
            data: {
                v: 2,
                alt: 'json',
                'start-index': 1,
                'max-results': 4
            }
        });
    }

    /*
	This function "ports" or streamlines My Youtube DB's functions
	to work with Firefox. This is a layer of abstraction to keep
	the main code as intact as possible
 	*/

    function DB_save(callback) {
        self.port.emit("DB_save", ExtensionData);

        self.port.once("DB_saved", function() {
            callback();
        });
    }
    //save extension settings
    function saveSettings(data) {
        var today = (function() {
            var today = new Date();
            var dd = today.getDate(); //day
            var mm = today.getMonth() + 1; //month
            var yyyy = today.getFullYear(); //year

            if (dd < 10) {
                dd = '0' + dd;
            }
            if (mm < 10) {
                mm = '0' + mm;
            }
            today = mm + '/' + dd + '/' + yyyy;
            return today;
        })();
        //password
        //var psw = (function() {
        //if (config.user_config.custom_key && config.user_config.custom_key !== '') {
        //	return config.user_config.custom_key;
        //}
        //	return hash(today).toString();
        //})();
        var blob = new Blob([
            "──────────────────────────────────────────────────────────────────────\n\n",
            "My Youtube " + addonVersion + "\n\n",
            "THIS FILE CONTAINS YOUR MY-YOTUBE SETTINGS\n",
            "THIS INFORMATION IS NOT ENCRYPTED, IT CAN BE EASILY READ\n",
            "SAVE IT IN A SAFE PLACE OR DELETE IT WHEN NO LONGER NEEDED\n\n",
            "Date generated: " + today + "\n",
            "──────────────────────────────────────────────────────────────────────\n\n",
            //'<MyYoutube key="' + (!config.user_config.in_key ? 'ASK' : psw) + '">',
            '<MyYoutube>',
            //Tea.encrypt(data, psw),
            utf8_to_b64(data),
            "</MyYoutube>"
        ], {
            type: "text/plain;charset=utf-8"
        });

        unsafeWindow.saveAs(cloneInto(blob, unsafeWindow), "MyYoutube.settings");

        //if (!config.user_config.in_key) {
        //	$('#key').text(psw);
        //	popup($('#dMenu2'));
        //}
    }

    function hash(s) {
        s += (new Date()).getTime();
        return s.split("").reduce(function(a, b) {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a
        }, 0);
    }

    function iniFileLoader() {
        document.getElementById('upConfig').addEventListener('change', function(event) {
            var files = event.target.files; //FileList object
            var file;
            for (var i = 0; i < files.length; i++) {
                file = files[i];
                //we try to filter random files
                if (escape(file.name).indexOf('.settings') === -1) {
                    window.alert('Archivo invalido');
                    continue;
                }
            }
            var reader = new FileReader();
            reader.addEventListener('load', function(event) {
                var settings = event.target.result;
                var data = settings.match(/<MyYoutube>(.*?)<\/MyYoutube>/);
                if (data === null) {
                    window.console.error('Match parse failed');
                    window.alert('Archivo corrupto\n\n¿Que has hecho?');
                    return false;
                }
                //key = data[1];
                //if (key === 'ASK') {
                //	key = prompt('Escribe tu llave de encriptacion');
                //}
                settings = data[1];
                settings = b64_to_utf8(settings);
                try {
                    settings = JSON.parse(settings);
                } catch (e) {
                    window.console.error('JSON parse failed');
                    window.console.error(e.message);
                    window.alert('Archivo corrupto\n\n¿Que has hecho?');
                    return false;
                }
                ExtensionData = settings;
                DB_save(function() {
                    window.location.reload();
                });
            });
            //Read the text file
            reader.readAsText(file);
        });
    }

    /*
        In most browsers, calling window.btoa() on a Unicode string will cause a Character Out Of Range exception
        see: https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa
    */

    function utf8_to_b64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    function b64_to_utf8(str) {
        return decodeURIComponent(escape(window.atob(str)));
    }
}