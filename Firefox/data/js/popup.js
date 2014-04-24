//run extension when its data has been loaded
self.port.once("run", function(obj) {
	main(obj.data, obj.translation);
});

function main(data, translation) {
	//don't do anything if we don't have any channels to work with
	if (data.channels.length === 0) {
		$('.modal:first').remove();
		$('#novids').show();
	}

	//click listener for options button
	$('#options').click(function() {
		openTab("options");
	});

	var selectedAccount; 				//to keep track of the selected account
	var vidContainer = $('#videos'); 	//div containing videos
	var userData 	 = $('#user_data'); //span containing some info about the Youtube account selected, such as username
	var updateMsg 	 = $('.modal span'); //div containing the "loading msg" screen

	generateSidebar();
	initialize(); //start

	/*
		Now we're going to load ONLY any new uploaded videos
	*/
	function initialize() {

		var length 		  = data.channels.length - 1; //we'll loop through all saved channels
		var newVideos 	  = []; //array to keep all the new videos
		var newVideosHTML = ''; //will hold the html containing new vids

		//currentAccount is used to keep track of how many channels have new videos.
		//we need this number to track and update our cache
		var currentAccount = 0;

		//will display "new videos" in this case
		userData.text(translation['popuph2']);

		/*
			Because loading only new videos takes some time, we only want to do it when neccesary.
			So we're using a simple cache-like system so that we don't have to connect to Youtube everytime.

			If we have cached videos, we use that. We clean the cache when new videos are found in the background.
		*/
		if (data.cache.length > 0) {
			loadCache();
		} else {
			//loading msg
			updateMsg.eq(0).text(translation['popupMsg1']);
			//if we don't have any cache, we need to connect to Youtube
			loadNewVideos(0);
		}

		function loadCache() {
			//loop through cache found
			for (var i = 0; i < data.cache.length; i++) {
				var cache = data.cache[i];
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
			updateMsg.eq(1).text(data.channels[i].name);
			loadVideos(data.channels[i].id).done(function(response) {
				var videos = proccessYoutubeFeed(response.feed);
				var save = false;
				if (videos) {
					var account = {
						"accountName": data.channels[i].name,
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
						data.cache = newVideos;
						DB_save(function() {
							displayVideos(newVideosHTML);
						});
					} else {
						error(3); //no new videos
					}
				}
			});
		};
	}

	/**
	 * Creates the sidebar with the Youtube account's images & adds a click listener
	 */
	function generateSidebar() {
		var sidebar = $('#sidebar'); //div containing sidebar
		var sidebarHTML = '';
		//loop through channels and display image on sidebar
		for (var i = 0; i < data.channels.length; i++) {
			var account = data.channels[i];
			//populate html
			sidebarHTML += '<div class="ss" data-id="' + i + '"><a href="#" id="' + account.id + '">' +
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
				//we might need this to load videos
			var accountYoutubeID = self.attr('id');
				//the account number (integer), ej: 7
			var accountID = self.parent().data('id');
			/* 
			Sometimes account names have spaces, in which case we can't load its videos
			so we use the youtube id which is secure
			*/
			var account = (accountName.indexOf(' ') >= 0 ? accountYoutubeID : accountName)
			//click listener
			self.off("click").click(function(event) {
				selectedAccount = accountID;
				$('.selected:first').removeClass('selected');
				self.parent().addClass('selected');
				loadVideos(account).done(function(response) {
					var videos = proccessYoutubeFeed(response.feed);
					if (videos) {
						var html = generateSideBarVideosHTML(videos);
						//display account name
						userData.text(accountName);
						displayVideos(html);
					} else {
						//error msg: no videos found for selected acount
						error(1);
					}
				});
			});
		});
	}

	/**
	 * Loads most recent Youtube videos from selected account
	 * @param {String} accountName the account name or ID
	 */
	function loadVideos(accountName) {
		return $.ajax({
			url: 'https://gdata.youtube.com/feeds/api/users/' + accountName + '/uploads',
			dataType: 'json',
			cache: false,
			data: {
				v: 2,
				alt: 'json',
				"start-index": 1,
				"max-results": 4
			}
		});
	}

	/**
	 * Extracts the neccesary information from the Youtube feed (video, title, url, etc)
	 * @param {Object} data the Youtube feed
	 * @return {Array} videos an array containing objects with each videos' meta-data
	 */
	function proccessYoutubeFeed(data) {
		var feed = data.entry;
		var videos = [];
		if (feed === undefined) {
			//error this account has no videos
			return false;
		}
		for (var i = 0; i < feed.length; i++) {
			var entry = feed[i];
			var title = entry.title.$t; //Video title
			var link = entry.link[0].href; //Video link
			var img = entry.media$group.media$thumbnail[1].url; //video thumbnail
			var description = entry.media$group.media$description.$t; //video description
			var author = entry.author[0].name.$t; //creato's Youtube name

			videos.push({
				"id": i, //the video number (0 -> 3)
				"title": title,
				"url": link,
				"thumbnail": img,
				"description": description,
				"author": author
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
			})
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
				'title="' + translation['popup_tooltip'] +" "+ [videos[i].author] + '" >' +
				'<a href="#">' +
				'<img src="' + videos[i].thumbnail + '" alt="' + videos[i].title + '" class="wrap thumb">' +
				'<span class="t">' + videos[i].title + '</span>' +
				'<span class="description">' + videos[i].description.substring(0, 120) + '</span>' +
				'</a></div>'+
				'<span class="details">Subido por: <i>'+videos[i].author+'</i></span>' +
				'<button class="details">Marcar como visto</button></div>';
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
			var currentVideos = data.channels[accountIndex].videoTitles; //our currently saved videos - might be outdated -
			var freshVideos = data.cache[cacheIndex].videos; //videos fresh from Youtube
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
			data.channels[accountIndex].videoTitles = currentVideos;
			//update cache
			data.cache[cacheIndex].videos[videoIndex].isNew = false;

			//update the icon number count
			//we need to use window.self because be have a local "self" variable
			window.self.port.emit("updateBadge");
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

				var currentVideos = data.channels[selectedAccount].videoTitles;
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
				data.channels[selectedAccount].videoTitles = currentVideos;

				/*
					Update cache
					Sometimes this might fail because the cache is empty, so we use try catch 
				*/
				try {
					for (var i = 0; i < data.cache.length; i++) {
						for (var j = 0; j < data.cache[i].videos.length; j++) {
							var videos = data.cache[i].videos[j];
							if (videos.title === title) {
								data.cache[i].videos[j].isNew = false;
								break;
							}
						}
					}
				} catch (e) {
					console.warn('Could not update cache. Error: ' + e.message);
				}

				//update the icon number count
				window.self.port.emit("updateBadge");

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
					window.alert(translation['contextMenuMsg']);
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
		var tit = data.channels[account].videoTitles,
			newTxt = translation['newTxt'];
			
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
			'<h1>' + translation[msg.header] + '</h1>' +
			'<p>' + translation[msg.msg] + '</p></div>';
	}

	/**
	 * opens a new tab
	 * @param {String} url the url to open
	 */
	function openTab(url, rightClick) {
		//if the user is opening the video using by rightclicking, we want to do the opposite of
		//whatever setting they have for " Open videos in the current tab"

		var openInNewTab = (rightClick ? data.prefs['open_in_current_tab'] : !data.prefs['open_in_current_tab']);
		self.port.emit("open_tab", {
			"url": url,
			"inNewTab": openInNewTab
		});
	}

	/*
	This function "ports" or streamlines My Youtube DB's functions
	to work with Firefox. This is a layer of abstraction to keep
	the main code as intact as possible
 	*/

	function DB_save(callback) {
		self.port.emit("DB_save", data);

		self.port.once("DB_saved", function() {
			callback();
		});
	}
}