//Chrome - Options.js

//localize
var objects = document.getElementsByTagName('*');
for (var i = 0; i < objects.length; i++) {
	if (objects[i].dataset && objects[i].dataset.message) {
		objects[i].innerHTML = chrome.i18n.getMessage(objects[i].dataset.message);
	}
}
$('#thx a').each(function (i) {
	$(this).attr('title', chrome.i18n.getMessage('thx'+i+'b'));
});
//load user settings
DB_load(function() {
	//dom elements
    var btnSave = $('#btn-save');
    var btnDel = $('#btn-del');
    var btnClean = $('#btn-clean');
    var btnDwnSettings = $('#btn-downloadSettings');
    var res = $('#response');
    var accountsTable = $('#youtubers');
    var modal = $('.modal:first');

    iniFileLoader();

	//click event listener
	btnClean.click(function() {
		ExtensionData.newVideosCache = [];
		DB_save(function() {
			err('errMsg8');
		});
		chrome.runtime.sendMessage({
            msg: "refresh", 
            ExtensionData: ExtensionData
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
					alert(chrome.i18n.getMessage('errMsg7'));
				}

				ExtensionData.prefs['check_interval'] = parseInt(interval, 10) * 60000;
			}
		});
		DB_save(function() {
			err('errMsg6');
			btnSave.attr('style', '');
			btnSave.attr('disabled', true);
		});

		chrome.runtime.sendMessage({
            msg: "refresh", 
            ExtensionData: ExtensionData
        });
		return false;
	});
	btnDel.click(function() {
		var account = accountsTable.find('.tbSel').first();
		ExtensionData.accounts.splice(parseInt(account.attr('id')), 1);
		account.remove();
		btnDel.attr('disabled', true);
		btnDel.attr('style', '');
		activateSaveBtn();
		return false;
	});
	btnDwnSettings.click(function() {
        //clean cache - we only want the account info and not any videos loaded and stuff
        ExtensionData.newVideosCache = [];
        for (var i = ExtensionData.accounts.length - 1; i >= 0; i--) {
            //ExtensionData.channels[i].videoTitles = [];
            ExtensionData.accounts[i].newVideos = false;
        }
        saveSettings(JSON.stringify(ExtensionData));
        return false;
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
    DB_usage();
	//show youtubers
	var length = ExtensionData.accounts.length;
	var table = $('#youtubers table');
    var columns = ['', '', ''];
    var row = 0;

    for (var j = 0; j < length; j++) {
        columns[row] += '<tr id="' + j + '"><td>► <a href="' + ExtensionData.accounts[j].url +
            '" target="_blank">' + ExtensionData.accounts[j].name + '</a></td></tr>';
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

	function err(msg) {
		res.text(chrome.i18n.getMessage(msg)).fadeOut('fast').fadeIn('fast');
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
        var blob = new Blob([
            "──────────────────────────────────────────────────────────────────────\n\n",
            "My Youtube for Google Chrome " + chrome.app.getDetails().version + "\n\n",
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

        saveAs(blob, "MyYoutube.GoogleChrome.settings");
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
                chrome.runtime.sendMessage({
            		msg: "refresh", 
            		ExtensionData: ExtensionData
        		});
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

});