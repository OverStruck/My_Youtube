//localize
var objects = document.getElementsByTagName('*');
for (var i = 0; i < objects.length; i++) {
	if (objects[i].dataset && objects[i].dataset.message) {
		objects[i].innerHTML = chrome.i18n.getMessage(objects[i].dataset.message);
	}
}

//load user settings
DB_load(function() {

	$('#options').click(function() {
		openTab("options.html");
	});

	//don't do anything if we don't have any accounts to work with
	if (ExtensionData.accounts.length === 0) {
		$('.modal:first').remove();
		$('#novids').show();
	}

	var selectedAccount, //used to keep track of the selected account
		vidContainer = $('#videos'), //div containing videos
		userData = $('#user_data'), //span containing some info about the Youtube account selected, such as username
		updateMsg = $('.modal span'), //div containing the "loading msg" screen
		clickedEl; //variable use to track the element click in case the user wants to mark a video as watched

	generateSidebar();
	initialize(); //start

	/*
		Now we're going to load ONLY any new uploaded videos
	*/
	function initialize() {

		var length = ExtensionData.accounts.length - 1, //we'll loop through all saved accounts
			newVideos = [], //array to keep all the new videos at
			newVideosHTML = ''; //will hold the html containing new vids

		//currentAccount is used to keep track of how many accounts have new videos.
		//we need this number to track and update our cache
		var currentAccount = 0;
		//will display "new videos" in this case
		userData.text(chrome.i18n.getMessage('popuph2'));
		/*
			Because loading only new videos takes some time, we only want to do it when neccesary.
			So we're using a simple cache-like system so that we don't have to connect to Youtube everytime.

			If we have cached videos, we use that. We clean the cache when new videos are found in the background.
		*/
		if (ExtensionData.newVideosCache.length > 0) {
			loadCache();
		} else {
			//loading msg
			updateMsg.eq(0).text(chrome.i18n.getMessage('popupMsg1'));
			//if we don't have any cache, we need to connect to Youtube
			loadNewVideos(currentAccount);
		}

		function loadCache() {
			//loop through cache found
			for (var i = 0; i < ExtensionData.newVideosCache.length; i++) {
				var cache = ExtensionData.newVideosCache[i];
				//the array might contain a "null" inside it, so filter that out
				if (cache) {
					newVideosHTML += generateNewVideosHTML(cache.videos, cache.accountIndex, cache.videoIndex, cache.cacheIndex);
				}
			}
			//when the user has watch all new videos we won't have any html to display
			if (newVideosHTML !== '') {
				displayVideos(newVideosHTML);
			} else {
				error(3); //error msg: no new videos found
			}
		}

		//@param i integer the account index
		function loadNewVideos(i) {
			updateMsg.eq(1).text(ExtensionData.accounts[i].name);
			loadVideos(ExtensionData.accounts[i].uploadsPlayListId).done(function(response) {
				var videos = proccessYoutubeFeed(response.items);
				var save = false;
				if (videos) {
					var account = {
						"accountName": ExtensionData.accounts[i].name,
						"accountIndex": i,
						"videos": []
					};
					for (var j = 0; j < videos.length; j++) {
						var isNew = isNewVideo(videos[j].title, i, true);
						if (isNew) {
							save = true;
							videos[j].isNew = true;
							videos[j].videoIndex = j;
							videos[j].cacheIndex = currentAccount;
							newVideosHTML += generateNewVideosHTML([videos[j]], i, j, currentAccount);
						} else {
							videos[j].isNew = false;
						}
						account.videos.push(videos[j]);
					}
					if (save) {
						currentAccount++;
						newVideos.push(account);
					}
				}
				//keep loding videos
				if (i < length) {
					loadNewVideos(++i);
				} else {
					//finally show videos
					if (newVideos.length) {
						//cache new videos
						ExtensionData.newVideosCache = newVideos;
						DB_save(function() {
							displayVideos(newVideosHTML);
						});
					} else {
						error(3); //no new videos
					}
				}
			});
		}
	}

	/**
	 * Creates the sidebar with the Youtube account's images & adds a click listener
	 */
	function generateSidebar() {
		var sidebar = $('#sidebar'); //div containing sidebar
		var sidebarHTML = '';
		//loop through accounts and display image on sidebar
		for (var i = 0; i < ExtensionData.accounts.length; i++) {
			var account = ExtensionData.accounts[i];
			//populate html
			sidebarHTML += '<div class="ss" data-id="' + i + '"><a href="#" id="' + account.uploadsPlayListId + '">' +
				'<img src="' + account.thumbnail + '"' +
				'alt="' + account.name + '" width="60"' +
				' title="' + account.name + '"></a></div>';
		}
		//populate sidebar
		sidebar.html(sidebarHTML);

		//add click listener to side bar
		sidebar.find('a').each(function() {
			var self = $(this);
				//the account name, ej: "PMVTutoriales"
			var accountName = self.find('img:first').attr('title');
				//the Youtube account PLAYLIST ID which is some long string
			var accountPlayListId = self.attr('id');
				//the account number (integer), ej: 7
			var accountID = self.parent().data('id');

			self.off("click").click(function(event) {
				selectedAccount = accountID;
				$('.selected:first').removeClass('selected');
				self.parent().addClass('selected');
				loadVideos(accountPlayListId).done(function(response) {
					var videos = proccessYoutubeFeed(response.items);
					if (videos) {
						var html = generateSideBarVideosHTML(videos);
						//display account name
						userData.text(accountName);
						displayVideos(html);
					} else {
						//error msg: no videos found for selected acount
						error(1);
					}
				}).fail(function() {
					//this might be any kind of connection error such as Youtube being down
					error(2);
				});
			});
		});
	}

	/**
	 * Loads most recent Youtube videos from selected account
	 * @param {String} uploadsPlayListId the id of the uploads play list
	 * @retun {Object} promise the jQuery promise of being done
	 */
	function loadVideos(uploadsPlayListId) {
		return $.ajax({
			url: 'https://www.googleapis.com/youtube/v3/playlistItems',
			dataType: 'json',
			cache: false,
			data: {
				'part': 'snippet',
                'key': 'AIzaSyBbTkdQ5Pl_tszqJqdafAqF0mVWWngv9HU',
                'maxResults': 4,
                'playlistId': uploadsPlayListId,
                'fields': 'items(snippet,status)'
			}
		});
	}

	/**
	 * Extracts the neccesary information from the Youtube feed (video, title, url, etc)
	 * @param {Object} data the Youtube feed
	 * @return {Array} videos an array containing objects with each videos' meta-data
	 */
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
                            "author": snippet.channelTitle
                        });
                    }
                }
                
            }
            return videos;
        }

	/**
	 * Display's the account's videos on the popup
	 * @param {Array} videos an array containing objects with each videos' meta-data
	 */
	function displayVideos(videos) {
		vidContainer.fadeOut('fast', function() {
			vidContainer.html(videos).promise().done(function() {
				activateVideos();
				activateRightClick();
				vidContainer.fadeIn('fast');
			});
		});
	}

	/**
	* right "click" event listener
	*/
	function activateRightClick() {
		//add listener
		$('.vid').each(function(i) {
			$(this).off('mousedown').on('mousedown', function(e) {
				//right click
				if (e.which === 3) {
					triggerClick(e.target, {
						markingVideoAsWatched: false,
						rightClick: true
					});
				}
			});
		});
	}

	/**
	 * Main function when marking videos as watched
	 * Basically it just triggers the click event which updates everything
	 * We pass an extra parameter to prevent going to the video url
	 * @param el the element clicked
	 */
	function triggerClick(el, params) {
		var elem = $(el);
		if (params.markingVideoAsWatched)//quick fix
			elem = elem.siblings('div');

		elem.trigger('click', params);
	}

	/**
	 * Generates the neccesary HTML displaying the account's videos
	 * @param {Array} videos an array containing objects with each videos' meta-data
	 * @param {Number} onlyNew The account index in the channels array
	 * @return {String} html a long string containing html
	 */
	function generateNewVideosHTML(videos, onlyNew) {
		var html = '';
		for (var i = 0; i < videos.length; i++) {
			//filter out videos not new!
			if (!videos[i].isNew) {
				continue;
			}
			html += '<div class="container">' +
				'<div class="vid" data-videourl="' + videos[i].url + '" data-videoindex="' + videos[i].videoIndex + '" data-cacheindex="' + videos[i].cacheIndex + '" data-accountindex="' + onlyNew + '" ' +
				'title="' + chrome.i18n.getMessage('popup_tooltip') +" "+ videos[i].author + '" >' +
				'<a href="#">' +
				'<img src="' + videos[i].thumbnail + '" alt="' + videos[i].title + '" class="wrap thumb">' +
				'<span class="t">' + videos[i].title + '</span>' +
				'<span class="description">' + videos[i].description.substring(0, 120) + '</span>' +
				'</a></div>'+
				'<span class="details">'+chrome.i18n.getMessage('uploadedBy')+' <i>'+videos[i].author+'</i></span>' +
				'<button class="details">'+chrome.i18n.getMessage('contextMenu')+'</button></div>';
		}
		return html;
	}

	/**
	 * Generates the neccesary HTML displaying the account's videos
	 * @param {Array} videos an array containing objects with each videos' meta-data
	 * @return {String} html a long string containing html
	 */
	function generateSideBarVideosHTML(videos) {
		var html = '';
		for (var i = 0; i < videos.length; i++) {
			html += '<div class="container">' +
				'<div class="vid" data-videourl="' + videos[i].url + '" data-videoid="' + videos[i].id + '" >' +
				'<a href="#">' +
				'<img src="' + videos[i].thumbnail + '" alt="' + videos[i].title + '" class="wrap thumb">' +
				'<span class="t">' + isNewVideo(videos[i].title) + '</span>' +
				'<span class="description">' + videos[i].description.substring(0, 120) + '</span>' +
				'</a></div></div>';
		}
		return html;
	}

	/**
	 * Adds a click event listener to the account's videos
	 */
	function activateVideos() {
		$('.vid').each(function(i) {
			//if user is viewing a particular account, we use a particular algorith
			if (selectedAccount !== undefined) {
				activateSideBarVideos(this, i);
			} else {
				activateNewVideos(this);
			}
		});
	}

	/**
	 * Adds a click event listener to the account's videos
	 * This function is used when loading ONLY new videos
	 * @param {Object} _this the html element to add a click listener to
	 */
	function activateNewVideos(_this) {
		var self = $(_this);

		self.off('click').click({markingVideoAsWatched: false, rightClick: false}, function(event, params) {
			params = params || event.data; //defaults

			var title = self.find('.t:first').text(); //current video title
			var url = self.data("videourl"); //current video url
			var videoIndex = self.data('videoindex'); //the video position in the list of saved videos for the selected account
			var accountIndex = self.data('accountindex'); //the account position in the list of channels
			var cacheIndex = self.data('cacheindex'); //the account position in the cache list of videos
			var currentVideos = ExtensionData.accounts[accountIndex].videoTitles; //our currently saved videos - might be outdated -
			var freshVideos = ExtensionData.newVideosCache[cacheIndex].videos; //videos fresh from Youtube
			/*
				Update current list of saved videos to match the position of the new list of fresh videos.
				This makes sure that we don't mark already watched videos as "new".
			*/
			
			for (var i = 0; i < currentVideos.length; i++) {
				for (var k = 0; k < freshVideos.length; k++) {
					if (currentVideos[i] === freshVideos[k].title && i !== k) {
						var temp = currentVideos[k];
						currentVideos[k] = currentVideos[i];
						currentVideos[i] = temp;
					}
				}
			}
			//inser new title into the list of saved videos
			currentVideos[videoIndex] = title;
			//update extension data with updated list of videos
			ExtensionData.accounts[accountIndex].videoTitles = currentVideos;
			//update cache
			ExtensionData.newVideosCache[cacheIndex].videos[videoIndex].isNew = false;

			//update the icon number count
			chrome.browserAction.getBadgeText({}, function(result) {
				var update = parseInt(result) - 1;
				chrome.browserAction.setBadgeText({
					text: update > 0 ? update.toString() : ''
				});
			});
			//save changes
			DB_save(function() {
				if (!params.markingVideoAsWatched) {
					openTab(url, params.rightClick);
				} else {
					self.parent().fadeOut('fast');
				}
			});
		});

		//mark as watched
		$('button.details').each(function() {
			$(this).off('click').click(function(e) {
				triggerClick(e.target, {
					markingVideoAsWatched: true,
					rightClick: false
				});
			});
		});
	}

	/**
	 * Adds a click event listener to the account's videos
	 * This function is used when loading any acount's videos, old and new
	 * @param {Object} _this the html element to add a click listener to
	 * @param {Number} i
	 */
	function activateSideBarVideos(_this, number) {
		var self = $(_this);
		var title = self.find('.title:first').text(); //current title
		var url = self.data("videourl"); //current url
		
		//we are dealing with new unwatched video
		if (self.find('.newVid').length > 0) {
			self.off('click').click({markingVideoAsWatched: false, rightClick: false}, function(event, params) {
				params = params || event.data; //defaults

				var currentVideos = ExtensionData.accounts[selectedAccount].videoTitles;
				var freshVideos = document.getElementsByClassName('title');
				/*
					Update current list of saved videos to match the position of the new list of fresh videos.
					This makes sure that we don't mark already watched videos as "new".
				*/
				for (var i = 0; i < currentVideos.length; i++) {
					for (var k = 0; k < freshVideos.length; k++) {
						if (currentVideos[i] === freshVideos[k].innerHTML && i !== k) {
							var temp = currentVideos[k];
							currentVideos[k] = currentVideos[i];
							currentVideos[i] = temp;
						}
					}
				}
				//inser new title into the list of saved videos
				currentVideos[number] = title;
				//update extension data with updated list of videos
				ExtensionData.accounts[selectedAccount].videoTitles = currentVideos;

				/*
					Update cache
					Sometimes this might fail because the cache is empty, so we use try catch 
				*/
				try {
					for (var i = 0; i < ExtensionData.newVideosCache.length; i++) {
						for (var j = 0; j < ExtensionData.newVideosCache[i].videos.length; j++) {
							var videos = ExtensionData.newVideosCache[i].videos[j];
							if (videos.title === title) {
								ExtensionData.newVideosCache[i].videos[j].isNew = false;
								break;
							}
						}
					}
				} catch (e) {
					console.warn('Could not update cache. Error: ' + e.message);
				}

				//update the icon number count
				chrome.browserAction.getBadgeText({}, function(result) {
					var update = parseInt(result) - 1;
					chrome.browserAction.setBadgeText({
						text: update > 0 ? update.toString() : ''
					})
				});

				//save extensions data array
				DB_save(function() {
					if (!params.markingVideoAsWatched) {
						openTab(url, params.rightClick);
					} else {
						self.parent().fadeOut('fast');
					}
				});
			});

		} else {
			self.off('click').click({markingVideoAsWatched: false, rightClick: false}, function(event, params) {
				params = params || event.data; //defaults

				if (!params.markingVideoAsWatched) {
					openTab(url, params.rightClick);
				} else {
					alert(chrome.i18n.getMessage('contextMenuMsg'));
				}
			});
		}
	}

	/**
	 * determines whether a video is new
	 * @param {String} title a video title
	 * @param {Number} [optional] account the account ID number
	 * @param {boolean} bool [optional] if it's set to true, returns true if video is new
	 * @param {String} title the video title
	 */
	function isNewVideo(title, account, bool) {
		account = (account === undefined ? selectedAccount : account);
		var tit = ExtensionData.accounts[account].videoTitles,
			newTxt = chrome.i18n.getMessage('newTxt');
			
		for (var i = 0; i < tit.length; i++) {
			if (tit[i] === title) {
				return bool ? false : '<span class="title">' + title + '</span>';
			}
		}
		return bool ? true : '<span class="title">' + title + '</span> <span class="newVid">(' + newTxt + ')</span>';
	}

	/**
	 * Displays an error message
	 * @param {Number} errNum the error number
	 */
	function error(errNum) {
		vidContainer.fadeOut('fast', function() {
			$(this).html(

			getErrorTxt({
				header: 'popupE' + errNum + '_H',
				msg: 'popupE' + errNum + '_B'
			})

			).fadeIn('fast');
		});
	}

	/**
	 * Get the correct error message from _locales folder
	 * @param {Object} msg the error message
	 */
	function getErrorTxt(msg) {
		return '<div class="error">' +
			'<h1>' + chrome.i18n.getMessage(msg.header) + '</h1>' +
			'<p>' + chrome.i18n.getMessage(msg.msg) + '</p></div>';
	}

	/**
	 * opens a new tab
	 * @param {String} url the url to open
	 */
	function openTab(url, rightClick) {

		//if the user is opening the video using by rightclicking, we want to do the opposite of
		//whatever setting they have for " Open videos in the current tab"

		var openInNewTab = (rightClick ? ExtensionData.prefs['open_in_current_tab'] : !ExtensionData.prefs['open_in_current_tab']);

		if (openInNewTab) {
			chrome.tabs.query({
				'active': true
			}, function(tabs) {
				chrome.tabs.update(tabs[0].id, {
					url: url
				});
				window.close();
			});
		} else {
			chrome.tabs.create({
				url: url
			});
		}
	}

});