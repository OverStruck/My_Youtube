﻿//localize
var objects = document.getElementsByTagName('*');
for (var i = 0; i < objects.length; i++) {
	if (objects[i].dataset && objects[i].dataset.message) {
		objects[i].innerHTML = chrome.i18n.getMessage(objects[i].dataset.message);
	}
}
$('#x').attr('href', '_locales/' + chrome.i18n.getMessage('lang') + '/history.html')
DB_load(function() {
	//dom elements
	var fieldAdd = $('#add-field'),
		btnAdd = $('#btn-add'),
		btnSave = $('#btn-save'),
		btnDel = $('#btn-del'),
		btnClean = $('#btn-clean'),
		res = $('#response'),
		accountsTable = $('#youtubers');
	//click event listener
	btnAdd.click(addYoutuber);
	btnClean.click(function() {
		ExtensionData.newVideosCache = []
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
					default:
						err('errMsg5');
				}
			} else {
				var interval = self.val();
				if (interval === '' || isNaN(interval))
					interval = 10;
				else if (interval % 1 !== 0) {
					interval = 10;
					alert(chrome.i18n.getMessage('errMsg7'));
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
		ExtensionData.accounts.splice(parseInt(account.attr('id')), 1);
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
	})
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
				default:
					err('errMsg5');
			}
			self.change(activateSaveBtn);
		} else {
			self.val(ExtensionData.prefs['check_interval'] / 60000);
			self.focus(activateSaveBtn);
		}
	});
	//show youtubers
	var length = ExtensionData.accounts.length;
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
				
				table += '<tr id="' + i + '"><td>► <a href="' + ExtensionData.accounts[i].url + '" target="_blank">' +
					ExtensionData.accounts[i].name + '</a></td></tr>';
				
			}
			table += '</table>';
			accountsTable.append(table);
		} catch (e) {console.log(e.message)}
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
		testYoutuber(account)
			.done(function(response) {
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
				ExtensionData.accounts.push({
					'id': account.yt$userId.$t,
					'name': account.name.$t,
					'thumbnail': response.entry.media$thumbnail.url,
					'videoTitles': getVideoTitles(response2),
					'newVideos': false,
					'url': url
				});
				fieldAdd.val('');
				if (res.text() !== chrome.i18n.getMessage('errMsg4'))
					res.fadeOut('fast');

				activateSaveBtn();
			});
		})
			.fail(function() {
			err('errMsg3');
		});
		return false;
	}

	function accountExits(account) {
		for (var i = 0; i < ExtensionData.accounts.length; i++) {
			if (ExtensionData.accounts[i].name === account) {
				return true;
			}
		}
		return false;
	}

	function err(msg) {
		res.text(chrome.i18n.getMessage(msg)).fadeOut('fast').fadeIn('fast');
	}

	function getVideoTitles(data) {
		var entries = data.feed.entry,
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
});