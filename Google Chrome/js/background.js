/* 
  My Youtube (Google Chrome) background.js file 
  Last update 5/12/2015

  This is the brain file of the extension
  it is akin to main.js in firefox extensions
*/
DB_load(function() {
	//first install
	if (ExtensionData.isNewInstall) {
		getYoutuber('UUZgwLCu6tSLEUJ30METhJHg').done(function(response) {
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

	var totalNewVideos = 0;
	var newVideosHash = '';
	var oldVideosHash = '';
	var notificationText = '';
	var currentAccount = 0;
	var newVideos = [];

	checkNewVideos(currentAccount);

	function checkNewVideos(count) {
		//we need to get the lastest data
		DB_load(function() {
			var account = ExtensionData.accounts[count];
			getYoutuber(account.uploadsPlayListId, true).done(function(response) {
				var newVideos = compareVideos(getVideoTitles(response.items), account.videoTitles);
				var save = false;
				//if newVideos > 0, add the number to the total newVideos number
				if (newVideos) {
					ExtensionData.accounts[count].newVideos = true;
					totalNewVideos += newVideos;
					newVideosHash += account.name + totalNewVideos;

					/*
                this is probably quite messy
                basically, instead of just counting how many new videos we have
                we want to SAVE those new videos, that way, when the popup shows
                we already have the new videos saved and thus, there's no need to connect
                to youtube to fetch those videos (otherwise we are connecting twice for no good reason)

                this of course, needs to be re-factored since we are doing kind of the same thing in popup.js
                */
					var videos = proccessYoutubeFeed(response.items);
					var _account = {
						"accountName": ExtensionData.channels[count].name,
						"accountIndex": count,
						"videos": []
					};

					for (var j = 0; j < videos.length; j++) {
						var isNew = isNewVideo(videos[j].title, count);
						if (isNew) {
							save = true;
							videos[j].isNew = true;
							videos[j].videoIndex = j;
							videos[j].cacheIndex = currentAccount;
						} else {
							videos[j].isNew = false;
						}

						_account.videos.push(videos[j]);
					}

					if (save) {
						currentAccount++;
						newVideos.push(_account);
					}

				} else {
					ExtensionData.accounts[count].newVideos = false;
				}
				//stop recursive function if count > the number of total accounts saved
				if (count < ExtensionData.accounts.length - 1) {
					checkNewVideos(++count);
					//count++;
					//DB_save(function() {
					//checkNewVideos(count);
					//});
				} else {
					//if totalNewVideos > 0, update icon badge number
					if (totalNewVideos) {
						chrome.browserAction.setBadgeText({
							text: totalNewVideos.toString()
						});
						//show popup letting user know of new videos
						if (oldVideosHash !== newVideosHash) {
							ExtensionData.cache = newVideos;
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
						//reset
						newVideos = [];
						newVideosHash = '';
						totalNewVideos = 0;
						currentAccount = 0;
					}
					//check for new videos every X minutes
					DB_save(keepCheking);
				}
			});
		});
	}

	function keepCheking() {
		setTimeout(function() {
			checkNewVideos(currentAccount);
		}, ExtensionData.prefs['check_interval']);
	}

	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (request === 'notificationText') {
			sendResponse(notificationText);
		}
	});

	function getYoutuber(account, getVideos) {
		//var url = 'http://gdata.youtube.com/feeds/api/users/' + account;
		var url = 'https://www.googleapis.com/youtube/v3/';
		var params = {
			'part': 'snippet',
			'key': 'AIzaSyBbTkdQ5Pl_tszqJqdafAqF0mVWWngv9HU'
		, };
		//extra parameters needed to get account videos
		if (getVideos) {
			url += 'playlistItems';
			params.maxResults = 4;
			params.playlistId = account;
			params.fields = 'items(snippet,status)';
		} else {
			params.id = account;
			params.part += ',contentDetails';
			url += 'channels';
		}

		return $.ajax({
			url: url,
			dataType: 'json',
			cache: false,
			data: params
		});
	}

	//@param Array data
	function getVideoTitles(data) {
		var result = [];
		var snippets;

		for (var i = 0; i < data.length; i++) {
			snippets = data[i];
			for (var key in snippets) {
				if (snippets.hasOwnProperty(key)) {
					var snippet = snippets[key];
					if (snippet.title !== undefined) {
						result.push(snippet.title);
					}
				}
			}

		}
		return result;
	}

	function proccessYoutubeFeed(data) {
		var videos = [];
		if (data === undefined) {
			//error this account has no videos
			return false;
		}

		var snippets;
		var youtubeVideoUrl = 'https://www.youtube.com/watch?v=';

		for (var i = 0; i < data.length; i++) {

			snippets = data[i];
			for (var key in snippets) {
				if (snippets.hasOwnProperty(key)) {
					var snippet = snippets[key];

					videos.push({
						"id": i, //the video number (0 -> 3)
						"title": snippet.title,
						"url": youtubeVideoUrl + snippet.resourceId.videoId,
						"thumbnail": snippet.thumbnails.medium.url,
						"description": snippet.description,
						"author": snippet.channelTitle,
					});
				}
			}

		}
		return videos;
	}

	function compareVideos(a, b) {
		var length = a.length;
		var diff = 0;
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

	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			switch (request.msg) {
				case "loadData":
					sendResponse({
						channels: ExtensionData.accounts,
						translation: {
							btnAddTxt: translate('YtModBtnAddTxt'),
							btnAddedTxt: translate('YtModBtnAddedTxt'),
							btnAddingTxt: translate('YtModBtnAddingTxt'),
							errMsg: translate('YtModErrMsg')
						}
					});
					break;
				case "addYoutuber":

					addYoutuberFromMod(request.username, sendResponse);
					sendResponse({
						isError: false,
						error: ''
					});

					break;

				case "refresh":
					ExtensionData = request.ExtensionData;
				break;
				default:
					console.log("unkown request");
			}
		});

	function translate(string) {
		return chrome.i18n.getMessage(string);
	}

	function addYoutuberFromMod(userName, sendResponse) {
		/*sadly, we have to make 2 network requests
                one to get the channel thumbnail
                and the second one to get the videos because youtube*/
		getYoutuber(userName, false).done(function(res) {

			var channel = res.items[0];
			var uploadsPlayListId = channel.contentDetails.relatedPlaylists.uploads;

			getYoutuber(uploadsPlayListId, true).done(function(response) {
				ExtensionData.accounts.push({
					'id': channel.id,
					'name': channel.snippet.title,
					'thumbnail': channel.snippet.thumbnails.default.url,
					'videoTitles': getVideoTitles(response.items),
					'newVideos': false,
					'url': 'https://www.youtube.com/channel/' + channel.id,
					'uploadsPlayListId': uploadsPlayListId
				});

				DB_save(function() {
					sendMsg({
						isError: false,
						error: ''
					});
				});

			}).fail(Fail);

		}).fail(Fail);

		function Fail(jqXHR, textStatus, error) {
			sendMsg({
				isError: true,
				error: error
			});
		}

		function sendMsg(obj){
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			  chrome.tabs.sendMessage(tabs[0].id, obj);
			});
		}
	}



});