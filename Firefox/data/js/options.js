//get all strings to translate
var strings = [];
var objects = document.getElementsByTagName('*');
for (var i = 0; i < objects.length; i++) {
	if (objects[i].dataset && objects[i].dataset.message) {
		strings.push(objects[i].dataset.message);
	}
}
for (var i = 1; i <= 8; i++)
	strings.push("errMsg" + i);

$('#thx a').each(function (i) {
	strings.push('thx'+i+'b');
});

strings.push("lang");

//translate
self.port.emit("translation", strings);
self.port.once("translation", function(response) {
	var translation = response.translation;
	for (var i = 0; i < objects.length; i++) {
		if (objects[i].dataset && objects[i].dataset.message) {
			objects[i].innerHTML = translation[objects[i].dataset.message];
		}
	}

	$('#thx a').each(function (i) {
		$(this).attr('title', translation['thx'+i+'b']);
	});

	$('#x').attr('href', '_locales/' + translation['lang'] + '/history.html');
	$("#logo").css("background-image", "url('images/" + translation['lang'] + "_logo.png')")
	main(response.data, translation);
});

function main(ExtensionData, translation) {
	//dom elements
	var fieldAdd = $('#add-field');
	var btnAdd = $('#btn-add');
	var btnSave = $('#btn-save');
	var btnDel = $('#btn-del');
	var btnClean = $('#btn-clean');
	var res = $('#response');
	var accountsTable = $('#youtubers');
	//click event listener
	btnAdd.click(addYoutuber);
	btnClean.click(function() {
		ExtensionData.cache = []
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
					window.alert(translation['errMsg7'].replace("<br>", "\n\n"));
				}

				ExtensionData.prefs['check_interval'] = parseInt(interval, 10) * 60000;
			}
		});
		DB_save(function() {
			err('errMsg6');
			btnSave.attr('style', '')
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
	//show youtubers (needs to be re-factored)
	var length = ExtensionData.channels.length;
	(function showAccs(start, end) {
		var stop = false;
		if (start > length) {
			start = start - length;
			stop = true;
		}
		if (end > length) {
			end = length - 1;
			stop = true;
		}
		try {
			var table = '<table cellpadding="3" cellspacing="1">';
			for (var i = start; i <= end; i++) {
				
				table += '<tr id="' + i + '"><td>► <a href="' + ExtensionData.channels[i].url + '" target="_blank">' +
					ExtensionData.channels[i].name + '</a></td></tr>';
				
			}
			table += '</table>';
			accountsTable.append(table);
		} catch (e) {console.log("ERROR: " + e.message)}
		if (!stop)
			showAccs(end + 1, end + 10);
	})(0, 10);

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
		var account = fieldAdd.val().trim();
		if (account === '') {
			err('errMsg1');
			return false;
		}
		testYoutuber(account).done(function(response) {
			console.log(JSON.stringify(response, null, 4))
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
			});
		}).fail(function() {
			err('errMsg3');
		});
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
}