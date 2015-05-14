/* 
  My Youtube (Google Chrome) background.js file 
  Last update 5/13/2015

  This is the brain file of the extension
  it is akin to main.js in firefox extensions
*/
DB_load(function(upgrade) {
	if (upgrade) {
		upgradeInit();
	}
	else {
		init();
	}
	function init() {
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
		} else if (ExtensionData.accounts.length === 0) {
			chrome.tabs.create({
				url: "options.html"
			});
		}

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
					var newVideosCount = compareVideos(getVideoTitles(response.items), account.videoTitles);
					var save = false;
					//if newVideos > 0, add the number to the total newVideos number
					if (newVideosCount) {
						ExtensionData.accounts[count].newVideos = true;
						totalNewVideos += newVideosCount;
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
							"accountName": ExtensionData.accounts[count].name,
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
					} else {
						//if totalNewVideos > 0, update icon badge number
						if (totalNewVideos) {
							chrome.browserAction.setBadgeText({
								text: totalNewVideos.toString()
							});
							//show popup letting user know of new videos
							if (oldVideosHash !== newVideosHash) {
								ExtensionData.newVideosCache = newVideos;
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
									notificationText = chrome.i18n.getMessage('notificationText', enNotificationText);
									chrome.notifications.create('MyYoutubeNotification', {
										type: "basic",
										iconUrl: "./icons/notification_icon.jpg",
										title: translate('extName'),
										message: notificationText,
										isClickable: false
									});
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

		function isNewVideo(title, account) {
            var tit = ExtensionData.accounts[account].videoTitles;
            for (var i = 0; i < tit.length; i++) {
                if (tit[i] === title) {
                    return false;
                }
            }
            return true;
        }

		/*var filter = {
		    url: [
		    	{
		        	hostContains: 'youtube.com',
		        	urlContains: 'watch?v=',
		    	},
		    	{
		        	hostContains: 'youtube.com',
		        	pathContains: 'channel',
		    	},
		    	{
		        	hostContains: 'youtube.com',
		        	pathContains: 'user',
		    	}
		    ]
		};
		/*
			This is a little hack in which we basically reload the tab the content script
			is running on, we do this because youtube loads pages via some type of ajax method
			and as a result the content script is not loaded when the user is navigating 
			through youtube. see: http://stackoverflow.com/questions/15824909/curious-about-the-new-way-youtube-is-loading-pages
		*/
		/*chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
			chrome.tabs.getSelected(null, function(tab) { 
				var newUrl = tab.url;
				var tabId = details.tabId;
				if (newUrl !== details.url) {
					chrome.tabs.update(tabId, {url: newUrl});
				}
			});
			
		}, filter);*/

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

	}

	function upgradeInit() {

        var channel;
        var name;
        var id;
        /*
        Due to the changes in Youtube's API V3, we need to update our channels array and objects
        to include a new property "uploadsPlayListId" because we need that ID to retreive videos 
        with the new API

        So here we have to connect to Youtube to get this ID and update existing channels*/
        (function upgradeChannels(iii) {
            id = ExtensionData.accounts[iii].id;
            name = ExtensionData.accounts[iii].name;

            id = (id.substring(0, 2) !== 'UC') ? 'UC' + id : id; //we need to add 'UC' to our old channel ids except for the first channel

            getYoutuber(id, false).done(function(response) {

				channel = response.items[0];
				ExtensionData.accounts[iii].uploadsPlayListId = channel.contentDetails.relatedPlaylists.uploads;
				ExtensionData.accounts[iii].id = id;

                if (iii < ExtensionData.accounts.length - 1) {
                        return upgradeChannels(++iii);
                } else {
                    DB_save();
                    init();
                    return true;
                }

            }).fail(function(jqXHR, textStatus, error) {
            	if (jqXHR.status === 404) {
            		ExtensionData.accounts[iii].uploadsPlayListId = null;
					ExtensionData.accounts[iii].id = id;
					console.error('No uploads playlist id found for' + ExtensionData.accounts[iii].name);
					return true;
            	} else if (jqXHR.status === 500) {
            		return upgradeChannels(iii);
            	} else {
            		var err = 'My youtube FATAL UPGRADE ERROR:' + textStatus;
            		console.error(err);
            		window.alert(err);
            	}
            });
        })(0);

    }
    
	function getYoutuber(account, getVideos) {
		//var url = 'http://gdata.youtube.com/feeds/api/users/' + account;
		var url = 'https://www.googleapis.com/youtube/v3/';
		var params = {
			'part': 'snippet',
			'key': 'AIzaSyBbTkdQ5Pl_tszqJqdafAqF0mVWWngv9HU'
		};
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

});