//load user settings
DB_load(function() {

	var selectedAccount; //used to keep track of the selected account
	//don't do anything if we don't have any accounts to work with
	if (ExtensionData.accounts.length === 0) {
		$('.modal:first').remove();
		$('#novids').show();
	}
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
			//the account number (integer), ej: 7
			accountID = parseInt(self.parent().attr('id').split('_')[1], 10);
		/* 
		Sometimes account names have spaces, in which case we can't load its videos
		so we use the youtube id which is secure
	*/
		if (accountName.indexOf(' ') >= 0)
			accountName = self.attr('id');
		//click listener
		self.click(function() {
			selectedAccount = accountID;
			$('.selected:first').removeClass('selected');
			self.parent().addClass('selected');
			//loadVideos(accountName, accountID);
			loadVideos(accountName).done(function(feed) {
				var videos = proccessYoutubeFeed(feed);
				if (videos) {
					var html = generateVideosHTML(videos);
					userData.text(accountName);
					displayVideos(html);
				} else {
					error(1);
					//TODO - handle error when no videos are found
				}
			}).fail(function() {
				error(2);
			});
		});
	});

	//determine if there are new videos to show
	var length = ExtensionData.accounts.length - 1,
		newVideos = [],
		newVideosHTML = '';
	userData.text(chrome.i18n.getMessage('popuph2'));
	(function loadNewVideos(i) {
		loadVideos(ExtensionData.accounts[i].id).done(function(feed) {
			var videos = proccessYoutubeFeed(feed);
			if (videos) {
				for (var j = 0; j < videos.length; j++) {
					var isNew = isNewVideo(videos[j].title, i, true);
					if (isNew) {
						newVideos.push(videos[j]);
						x = generateVideosHTML([videos[j]], i, j);
						newVideosHTML += x
						displayVideos(x);
					}
				}
			}
			//keep loding videos
			if (i < length) {
				loadNewVideos(++i);
			} else {
				//if there are new vids, show them, else load first acc
				if (newVideos.length) {
					//displayVideos(newVideosHTML);
				} else {
					error(3);//no new videos
				}
			}
		});
	})(0);
	//--OLD version 1.0, might remove
	//show first account videos or account with new videos
	//selectedAccount = selectedAccount || 0;
	//$('#s_' + selectedAccount).addClass('selected');
	//loadVideos(ExtensionData.accounts[selectedAccount].id, selectedAccount);

	/**
	 * Loads most recent Youtube videos from selected account
	 * @param {String} accountName the account name
	 * @retun {Object} promise the jQuery promise of being done
	 */
	function loadVideos(accountName, accountID) {
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
		//console.log(data)
		var feed = data.feed.entry;
		videos = [];
		if (feed === undefined) {
			//error no videos
			return false;
		}
		for (var i = 0; i < feed.length; i++) {
			var entry = feed[i],
				title = entry.title.$t, //Video title
				link = entry.link[0].href, //Video link
				img = entry.media$group.media$thumbnail[1].url, //video thumbnail
				description = entry.media$group.media$description.$t; //video description

			videos.push({
				'id': i,
				'title': title,
				'url': link,
				'thumbnail': img,
				'description': description
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
	 * @return {String} html a long string containing html
	 */
	function generateVideosHTML(videos, onlyNew, vidIndex) {
		var html = '';
		videosLength = videos.length;
		for (var i = 0; i < videosLength; i++) {
			html += '<div class="vid" id="v' + videos[i].id + '" accountIndex="' + onlyNew + '">' +
				'<a href="' + videos[i].url + '">' +
				'<img src="' + videos[i].thumbnail + '" alt="' + (vidIndex !== undefined ? vidIndex : 'thumbnail') + '" class="wrap thumb">' +
				'<span class="t">' + (onlyNew !== undefined ? videos[i].title : isNewVideo(videos[i].title)) + '</span>' +
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
				activateVideosB(this, i);
			} else {
				activateVideosA(this);
			}
		});
	}

	/**
	 * Adds a click event listener to the account's videos
	 * This function is used when loading ONLY new videos
	 * @param {Object} _this the html element to add a click listener to
	 */
	function activateVideosA(_this) {
		var self = $(_this);

		self.off('click').click(function() {
			var title = self.find('.t:first').text(), //current title
				url = self.find('a:first').attr('href'), //current url
				index = parseInt(self.find('img:first').attr('alt'), 10);
			accountIndex = parseInt(self.attr('accountIndex'), 10);

			//update the icon number count
			chrome.browserAction.getBadgeText({}, function(result) {
				var update = parseInt(result) - 1;
				chrome.browserAction.setBadgeText({
					text: update > 0 ? update.toString() : ''
				});
			});
			//console.log(JSON.stringify(ExtensionData.accounts[accountIndex].videoTitles, null, 4))

			//update extension data titles array
			//var temp = ExtensionData.accounts[accountIndex].videoTitles[index];
			//console.log(temp)
			for (var i = ExtensionData.accounts[accountIndex].videoTitles.length - 1; i >= index; i--) {
				ExtensionData.accounts[accountIndex].videoTitles[i] = ExtensionData.accounts[accountIndex].videoTitles[i - 1] ;
			};
			//inser new title
			ExtensionData.accounts[accountIndex].videoTitles[index] = title;

			//console.log(JSON.stringify(ExtensionData.accounts[accountIndex].videoTitles, null, 4))
			//save extensions data array
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
	function activateVideosB(_this, i) {
		var self = $(_this);

		var title = self.find('.o:first').text(), //current title
			url = self.find('a:first').attr('href'); //current url
		//if we have title, we are dealing with new unwatched video
		if (title !== '') {
			/*
			Here we try to update our titles in the extension data titles array for the current selected account
			we do this because we check the video titles to determine if there are new videos.
			If the user clicks a new video, that means we have to update our titles array so that next time
			we check for new videos, the video just watched is not marked as new
			*/
			self.off('click').click(function() {
				var old = ExtensionData.accounts[selectedAccount].videoTitles[i],
					hasNewVideos = false;

				//remove the (NEW) text in the title, we do this because we check for the newVid class
				//to determine if there are still other new videos
				self.find('.newVid').first().remove();
				/*
				We loop through each video and compare the current title found with the one saved
				in the extension data titles array, if they are different, we synchronize them to make
				sure they are the same. This avoids having old videos marked as new.

				The only exception is if the video titles contains the class "o" in which
				case it means the the video is actually new and we don't want to synchronize it yet...
				*/
				$('.vid').each(function(j) {
					var self = $(this),
						//current video title, fresh from server
						currentTitle = self.find('.t:first').text(),
						//saved title in extension data titles array
						oldTitle = ExtensionData.accounts[selectedAccount].videoTitles[j];
					if (currentTitle !== oldTitle && !self.hasClass('o')) {
						//update extension data titles array
						ExtensionData.accounts[selectedAccount].videoTitles[j] = currentTitle;
					} else if (old === currentTitle) {
						//if the video clicked title matches the one in the loop, we update the extension data
						ExtensionData.accounts[selectedAccount].videoTitles[j] = old;
					}
					//if there's still new videos, we mark the account as having new videos still
					if (!hasNewVideos && self.find('.newVid').length > 0) {
						hasNewVideos = true;
					}
				});

				//update the icon number count
				chrome.browserAction.getBadgeText({}, function(result) {
					var update = parseInt(result) - 1;
					chrome.browserAction.setBadgeText({
						text: update > 0 ? update.toString() : ''
					})
				});
				//update extension data titles array
				ExtensionData.accounts[selectedAccount].newVideos = hasNewVideos;
				ExtensionData.accounts[selectedAccount].videoTitles[i] = title;
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
		//console.log(account)
		var tit = ExtensionData.accounts[account].videoTitles,
			newTxt = chrome.i18n.getMessage('newTxt');
		for (var i = 0; i < tit.length; i++) {
			if (tit[i] === title) {
				return bool ? false : title;
			}
		}
		return bool ? true : '<span class="o">' + title + '</span> <span class="newVid">(' + newTxt + ')</span>';;
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