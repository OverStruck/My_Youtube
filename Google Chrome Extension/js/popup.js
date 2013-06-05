//load user settings
DB_load(function() {
	//don't do anything if we don't have any accounts to work with
	if (ExtensionData.accounts.length === 0) {
		$('.modal:first').remove();
		$('#novids').show();
	}
	var selectedAccount; //used to keep track of the selected account
	//cache doms
	var vidContainer = $('#videos'),
		accountInfo = document.getElementsByClassName('.user_data')[0],
		sidebar = $('#sidebar'),
		userData = $('#user_data'),
		sidebarHTML = '';

	//loop through accounts and display image on sidebar
	for (var i = 0; i < ExtensionData.accounts.length; i++) {
		var account = ExtensionData.accounts[i];
		//populate html
		sidebarHTML += '<div class="ss" id="s_' + i + '"><a href="#" id="' + account.id + '">' +
			'<img src="' + account.thumbnail + '"' +
			'alt="' + account.name + '" width="60"' +
			' title="' + account.name + '"></a></div>';
	}
	//populate sidebar
	sidebar.html(sidebarHTML);

	//add click listener to side bar
	sidebar.find('a').each(function() {
		var self = $(this),
			//the account name, ej: "PMVTutoriales"
			accountName = self.find('img:first').attr('title'),
			//we might need this to load videos
			accountYoutubeID = self.attr('id'),
			//the account number (integer), ej: 7
			accountID = parseInt(self.parent().attr('id').split('_')[1], 10);
		/* 
		Sometimes account names have spaces, in which case we can't load its videos
		so we use the youtube id which is secure
		*/
		var account = (accountName.indexOf(' ') >= 0 ? accountYoutubeID : accountName)
		//click listener
		self.click(function() {
			selectedAccount = accountID;
			$('.selected:first').removeClass('selected');
			self.parent().addClass('selected');
			loadVideos(account).done(function(feed) {
				var videos = proccessYoutubeFeed(feed);
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

	/*
		Now we're going to load ONLY any new uploaded videos
	*/
	var length = ExtensionData.accounts.length - 1,	//we'll loop through all saved accounts
		newVideos = [],								//array to keep all the new videos at
		newVideosHTML = '';							//will hold the html containing new vids
	//will display "new videos" in this case
	userData.text(chrome.i18n.getMessage('popuph2'));
	/*
		Because loading only new videos takes some time, we only want to do it when neccesary.
		So we're using a simple cache-like system so that we don't have to connect to Youtube everytime.

		If we have cached videos, we use that. We clean the cache when new videos are found in the background.
	*/
	if (ExtensionData.newVideosCache.length > 0) {
		for (var i = 0; i < ExtensionData.newVideosCache.length; i++) {
			var cache = ExtensionData.newVideosCache[i];
			//the array might contain a "null" inside it, so filter that out
			if (cache) {
				newVideosHTML += generateNewVideosHTML(cache.videos, cache.accountIndex, cache.videoIndex, cache.index);
			}
		}
		//when the user has watch all new videos we won't have any html to display
		if (newVideosHTML !== '') {
			displayVideos(newVideosHTML);
		} else {
			//error msg: no new videos found
			error(3);
		}
	} else {
		loadNewVideos(0);
	}
	//newVideosCount is used to keep track of how many new videos are found.
	//we need this number to track and update our cache
	var newVideosCount = 0;
	function loadNewVideos(i) {
		loadVideos(ExtensionData.accounts[i].id).done(function(feed) {
			var videos = proccessYoutubeFeed(feed), save = false;
			if (videos) {
				var account = {
					'accountName': ExtensionData.accounts[i].name,
					'accountIndex': i,
					'videos': []
				};
				for (var j = 0; j < videos.length; j++) {
					var isNew = isNewVideo(videos[j].title, i, true);
					if (isNew) {
						save = true;
						videos[j].isNew = true;
						videos[j].videoIndex = j;
						videos[j].index = newVideosCount;
						account.videos.push(videos[j]);
						newVideosHTML += generateNewVideosHTML([videos[j]], i, j, newVideosCount);
						newVideosCount++;
					} else {
						videos[j].isNew = false;
						account.videos.push(videos[j]);
					}
				}
				if (save) {
					newVideos.push(account)
				}
			}
			//keep loding videos
			if (i < length) {
				loadNewVideos(++i);
			} else {
				//finally show videos
				if (newVideos.length) {
					ExtensionData.newVideosCache = newVideos;
					DB_save(function() {
						displayVideos(newVideosHTML);
					});
				} else {
					error(3);//no new videos
				}
			}
		});
	};
	/**
	 * Loads most recent Youtube videos from selected account
	 * @param {String} accountName the account name
	 * @retun {Object} promise the jQuery promise of being done
	 */
	function loadVideos(accountName) {
		return $.ajax({
			url: 'https://gdata.youtube.com/feeds/api/users/' + accountName + '/uploads',
			dataType: 'json',
			cache: false,
			data: {
				'v': 2,
				'alt': 'json',
				'start-index': 1,
				'max-results': 4
			}
		});
	}

	/**
	 * Extracts the neccesary information from the Youtube feed (video, title, url, etc)
	 * @param {Object} data the Youtube feed
	 * @return {Array} videos an array containing objects with each videos' meta-data
	 */
	function proccessYoutubeFeed(data) {
		var feed = data.feed.entry,
			videos = [];
		if (feed === undefined) {
			//error this account has no videos
			return false;
		}
		for (var i = 0; i < feed.length; i++) {
			var entry = feed[i],
				title = entry.title.$t,									//Video title
				link = entry.link[0].href,								//Video link
				img = entry.media$group.media$thumbnail[1].url,			//video thumbnail
				description = entry.media$group.media$description.$t,	//video description
				author = entry.author[0].name.$t;						//creato's Youtube name

			videos.push({
				'id': i,					//the video number (0 -> 3)
				'title': title,
				'url': link,
				'thumbnail': img,
				'description': description,
				'author': author
			});
		}
		return videos;
	}

	/**
	 * Display's the account's videos on the popup
	 * @param {Array} videos an array containing objects with each videos' meta-data
	 */
	function displayVideos(videos) {
		vidContainer.fadeOut('fast', function() {
			$(this).html(videos).promise().done(function() {
				activateVideos();
				$(this).fadeIn('fast');
			});
		});
	}

	/**
	 * Generates the neccesary HTML displaying the account's videos
	 * @param {Array} videos an array containing objects with each videos' meta-data
	 * @param {Number} onlyNew The account index in the accounts array
	 * @return {String} html a long string containing html
	 */
	function generateNewVideosHTML(videos, onlyNew) {
		var html = '';
		for (var i = 0; i < videos.length; i++) {
			//filter out videos not new!
			if (!videos[i].isNew) {
				continue;
			}
			html += '<div class="vid" id="v' + videos[i].index + '" accountIndex="' + onlyNew + '" ' +
				'title="' + chrome.i18n.getMessage('popup_tooltip', [videos[i].author]) + '" >' +
				'<a href="' + videos[i].url + '">' +
				'<img src="' + videos[i].thumbnail + '" alt="' + videos[i].videoIndex + '" class="wrap thumb">' +
				'<span class="t">' + videos[i].title + '</span>' +
				'<span class="description">' + videos[i].description.substring(0, 120) + '</span></a></div>';
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
			html += '<div class="vid" id="v' + videos[i].id + '" >'+
				'<a href="' + videos[i].url + '">' +
				'<img src="' + videos[i].thumbnail + '" alt="' + videos[i].title + '" class="wrap thumb">' +
				'<span class="t">' + isNewVideo(videos[i].title) + '</span>' +
				'<span class="description">' + videos[i].description.substring(0, 120) + '</span></a></div>';
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

		self.off('click').click(function() {

			var title = self.find('.t:first').text(),//current title
				url = self.find('a:first').attr('href'),//current url
				index = parseInt(self.find('img:first').attr('alt'), 10),
				accountIndex = parseInt(self.attr('accountIndex'), 10);

			var x = parseInt(self.attr('id').substring(1,2), 10);

			var currentVideos = ExtensionData.accounts[accountIndex].videoTitles,
				freshVideos = ExtensionData.newVideosCache[x].videos;
			//update current list of saved videos to match the position of the new list of fresh videos
			for (var i = 0; i < currentVideos.length; i++) {
				for (var k = 0; k < freshVideos.length; k++) {
					if (currentVideos[i] === freshVideos[k].title && i !== k) {
						currentVideos[k] = currentVideos[i];
						currentVideos[i] = '';
					}
				}
			}
			//inser new title
			currentVideos[index] = title;
			//update
			ExtensionData.accounts[accountIndex].videoTitles = currentVideos;
			//update cache
			ExtensionData.newVideosCache[x].videos[index].isNew = false;
			
			//update the icon number count
			chrome.browserAction.getBadgeText({}, function(result) {
				var update = parseInt(result) - 1;
				chrome.browserAction.setBadgeText({
					text: update > 0 ? update.toString() : ''
				});
			});

			DB_save(function() {
				openTab(url);
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
		var self = $(_this),
			title = self.find('.title:first').text(),	//current title
			url = self.find('a:first').attr('href');	//current url
		//we are dealing with new unwatched video
		if (self.find('.newVid').length > 0) {
			self.off('click').click(function() {

				var currentVideos = ExtensionData.accounts[selectedAccount].videoTitles,
					freshVideos = document.getElementsByClassName('title');
				//update current list of saved videos to match the position of the new list of fresh videos
				for (var i = 0; i < currentVideos.length; i++) {
					for (var k = 0; k < freshVideos.length; k++) {
						if (currentVideos[i] === freshVideos[k].innerHTML && i !== k) {
							currentVideos[k] = currentVideos[i];
							currentVideos[i] = '';
						}
					}
				}
				 
				currentVideos[number] = title;
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
				} catch(e) {}

				//update the icon number count
				chrome.browserAction.getBadgeText({}, function(result) {
					var update = parseInt(result) - 1;
					chrome.browserAction.setBadgeText({
						text: update > 0 ? update.toString() : ''
					})
				});
				
				//save extensions data array
				DB_save(function() {
					openTab(url);
				});
			});
				
		} else {
			self.off('click').click(function() {
				openTab(url);
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
		return bool ? true : '<span class="title">' + title + '</span> <span class="newVid">(' + newTxt + ')</span>';;
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
	function openTab(url) {
		chrome.tabs.create({
			url: url
		});
	}

});