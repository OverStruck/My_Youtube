DB_load(function() {
	//first install
	if (ExtensionData.isNewInstall) {
		getYoutuber('ZgwLCu6tSLEUJ30METhJHg').done(function(response) {
			ExtensionData.accounts[0].videoTitles = getVideoTitles(response);
			ExtensionData.isNewInstall = false;
			DB_save(function() {
				chrome.tabs.create({
					url: "options.html"
				});
			});
		});
		return false;
	} else if (ExtensionData.accounts.length === 0) {
		chrome.tabs.create({
			url: "options.html"
		});
		return false;
	}

	//create menu
	chrome.contextMenus.create({
		id: "mark-as-watched",
		title: chrome.i18n.getMessage('contextMenu'),
		contexts: ["image"],
		documentUrlPatterns: ["chrome-extension://*/nyz_popup.html"],
		targetUrlPatterns: ["https://*.ytimg.com/*/mqdefault.jpg", "http://*.ytimg.com/*/mqdefault.jpg"]
	});

	var totalNewVideos = 0,
		newVideosHash = '',
		oldVideosHash = '',
		notificationText = '';
	//check for new videos uploaded and update icon badge number
	checkNewVideos(0);

	function checkNewVideos(count) {
		//we need to get the lastest data
		DB_load(function() {
			var account = ExtensionData.accounts[count];
			getYoutuber(account.id).done(function(response) {
				var newVideos = compareVideos(getVideoTitles(response), account.videoTitles);
				//if newVideos > 0, add the number to the total newVideos number
				if (newVideos) {
					ExtensionData.accounts[count].newVideos = true;
					totalNewVideos += newVideos;
					newVideosHash += account.name + totalNewVideos;
				} else {
					ExtensionData.accounts[count].newVideos = false;
				}
				//stop recursive function if count > the number of total accounts saved
				if (count < ExtensionData.accounts.length - 1) {
					count++;
					DB_save(function() {
						checkNewVideos(count);
					});
				} else {
					//if totalNewVideos > 0, update icon badge number
					if (totalNewVideos) {
						chrome.browserAction.setBadgeText({
							text: totalNewVideos.toString()
						});
						//show popup letting user know of new videos
						if (oldVideosHash !== newVideosHash) {
							ExtensionData.newVideosCache = []; //clean cache
							oldVideosHash = newVideosHash;
							if (ExtensionData.prefs['show_popup']) {
								//localize msgs
								var enNotificationText = [totalNewVideos];
								if (totalNewVideos > 1) {
									enNotificationText[1] = 's';
									enNotificationText[2] = 'have';
								} else {
									enNotificationText[1] = '';
									enNotificationText[2] = 'has';
								}
								notificationText = chrome.i18n.getMessage('notificationText', enNotificationText)
								var popup = webkitNotifications.createHTMLNotification('notification.html');

								popup.show();

								//close popup after 5 seconds
								setTimeout(function() {
									popup.cancel();
								}, 5000);
							}
							if (ExtensionData.prefs['play_popup_sound'])
								$('#alarm')[0].play();
						}
						newVideosHash = '';
					}
					//check for new videos every X minutes
					DB_save(keepCheking);
				}
			});
		});
	}

	function keepCheking() {
		setTimeout(function() {
			totalNewVideos = 0;
			checkNewVideos(0);
		}, ExtensionData.prefs['check_interval']);
	}

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (request === 'notificationText') {
			sendResponse(notificationText);
		}
	});

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

	function getVideoTitles(data) {
		var entries = data.feed.entry,
			result = [];
		if (entries === undefined) {
			return result;
		}
		//loop through result to get data
		for (var i = 0; i < entries.length; i++) {
			result.push(entries[i].title.$t);
		}
		return result;
	}

	function compareVideos(a, b) {
		var length = a.length,
			diff = 0;
		for (var i = 0; i < length; i++) {
			var add = 1;
			for (var j = 0; j < length; j++) {
				if (a[i] === b[j]) {
					add = 0;
					break;
				}
			}
			diff += add;
		}
		return diff;
	}
});