/* 
  My Youtube (FF) Main.js file 

  This is the brain file of the extension
  it is akin to background.js in chrome extensions
*/
var tmr = require("sdk/timers");
tmr.setTimeout(function() {

    var SS = require("sdk/simple-storage"); //simple storage 
    var DATABASE = require("./Mi_Youtube_Data_2"); //import data module
    //create data object (varains all extension data)
    var DATA = new DATABASE.MY_YOUTUBE_DATA(SS.storage);
    //we want the user's FF version for version-dependent features
    var FF_VERSION = parseInt(require("sdk/system").version);
	
    //todo - inform user he's using too much info
    //SS.on("OverQuota", function() {
    //window.alert('Storage limit exceeded');
    //});

//---------required modules & setup -------------------------------

        var {ToggleButton} = require('sdk/ui/button/toggle');
        var {Panel} = require("sdk/panel"); //panel (for main popup)
        var Request = require("sdk/request").Request; //network requests
        var tabs = require("sdk/tabs");
        var translate = require("sdk/l10n").get;
        var notifications = require("sdk/notifications");
        var pageMod = require("sdk/page-mod"); //needed to add contentscripts
        var self = require("sdk/self");
        var optionsURL = "options.html";
        var upgradeURL = "upgrade.html";

    DATA.load( function(ExtensionData, upgrade) {
        if (upgrade) {
            upgradeInit(ExtensionData);
        }
        else {
            init(ExtensionData);
        }
    

    function init(ExtensionData) {

        //first install
        if (ExtensionData.isNewInstall) {
            getYoutuber("UUZgwLCu6tSLEUJ30METhJHg", function(response) {
                response = response.json.items;
                ExtensionData.channels[0].videoTitles = getVideoTitles(response);
                ExtensionData.isNewInstall = false;
                DATA.save(ExtensionData);
                openOptions();
            }, true);
        } else if (ExtensionData.channels.length === 0) {
            openOptions();
        }

        //-------------translate strings for popup----------------------------
        //chrome is superior in this aspect
        var translations = {};
        translations['popupMsg1'] = translate('popupMsg1');
        translations['popup_tooltip'] = translate('popup_tooltip');
        translations['contextMenuMsg'] = translate('contextMenuMsg');
        translations['newTxt'] = translate('newTxt');
        translations['optsFooter2'] = translate('optsFooter2');
        translations['contextMenu'] = translate('contextMenu');
        translations['uploadedBy'] = translate('uploadedBy');

        for (var i = 0; i <= 3; i++) {
            var name = "popupE" + i + "_B";
            var name2 = "popupE" + i + "_H";

            translations[name] = translate(name);
            translations[name2] = translate(name2);
        }

        //----------create extension main button & popup setup--------------------------------
        var mainWindow; //main popup window
        //creates the main extension button
        var mainBtn = ToggleButton({
            id: "mainBtn",
            label: "My Youtube",
            badge: '',
            icon: {
                "16": "./icons/icon16.png", //paths relative to the data folder
                "38": "./icons/icon38.png",
                "48": "./icons/icon48.png"
            },
            onChange: function(state) {
                if (state.checked) {
                    initializeMainwindow();
                    mainWindow.show({
                        position: mainBtn
                    });
                }
            }
        });
        
        //youtube.com contentscript
        pageMod.PageMod({
        	include: [
        		"https://www.youtube.com/*",
                "http://www.youtube.com/*",
        	],
        	contentScriptWhen: 'end',
        	contentScriptFile: self.data.url("js/YouTube_Disable_Red_Bar_aka_SPF.js"),
        	attachTo: 'top'
        });
        
        pageMod.PageMod({
            include: [
                "https://www.youtube.com/watch?v=*",
                "http://www.youtube.com/watch?v=*",
                "https://www.youtube.com/user/*",
                "http://www.youtube.com/user/*",
                "https://www.youtube.com/channel/*",
                "http://www.youtube.com/channel/*"
            ],
            contentScriptWhen: 'end',
            contentScriptFile: self.data.url("js/myYoutubeMod.js"),
            contentStyleFile: self.data.url("css/youtubeMod.css"),
            contentScriptOptions: {
                btnAddTxt: translate('YtModBtnAddTxt'),
                btnAddedTxt: translate('YtModBtnAddedTxt'),
                btnAddingTxt: translate('YtModBtnAddingTxt'),
                errMsg: translate('YtModErrMsg')
            },
            attachTo: 'top',
            onAttach: function onAttach(worker) {

                worker.port.on('loadData', function() {
                    worker.port.emit("channels", ExtensionData.channels);
                });
                worker.port.on("addYoutuber", function(userName) {
                /*sadly, we have to make 2 network requests
                one to get the channel thumbnail
                and the second one to get the videos because youtube*/
                    getYoutuber(userName, function(res) {
                        if (res.statusText === "OK") {
                            channel = res.json.items[0];
                            var uploadsPlayListId = channel.contentDetails.relatedPlaylists.uploads;
                            getYoutuber(uploadsPlayListId, function(response) {
                                if (response.statusText === "OK") {
                                    ExtensionData.channels.push({
                                        'id': channel.id,
                                        'name': channel.snippet.title,
                                        'thumbnail': channel.snippet.thumbnails.default.url,
                                        'videoTitles': getVideoTitles(response.json.items),
                                        'newVideos': false,
                                        'url': 'https://www.youtube.com/channel/' + channel.id,
                                        'uploadsPlayListId': uploadsPlayListId
                                    });
                                    DATA.save(ExtensionData);
                                    worker.port.emit("done", {
                                        isError: false,
                                        error: ''
                                    });
                                } else {
                                    worker.port.emit("done", {
                                        isError: true,
                                        error: response.status
                                    });
                                }
                            }, true);
                        } else {
                            worker.port.emit("done", {
                                isError: true,
                                error: res.status
                            });
                        }

                    }, false);

                });
            }
        });

        //----------options page------------------------------------------
        pageMod.PageMod({
            include: self.data.url(optionsURL),
            contentScriptFile: [
                self.data.url("js/jquery2.js"),
                self.data.url("js/options.js")
            ],
            //port event listeners
            onAttach: function(worker) {
                var translation = {};
                //listen for translation request
                worker.port.once("translation", function(strings) {
                    for (var i = 0; i < strings.length; i++) {
                        //translate
                        translation[strings[i]] = translate(strings[i]);
                    }
                    //send translation
                    worker.port.emit("translation", {
                        data: ExtensionData,
                        translation: translation,
                        usage: SS.quotaUsage,
                        optionsURL: optionsURL,
                        addonVersion: self.version
                    });
                });

                //listen for save request
                worker.port.on("DB_save", function(newData) {
                    ExtensionData = newData;
                    DATA.save(newData);
                    worker.port.emit("DB_saved");
                });
            }
        });

        //open options on request
        require("sdk/simple-prefs").on("btnOptions", openOptions);

        //------Setup alarm------------------------------------------
        if (ExtensionData.prefs['play_popup_sound']) {
            var alarm = require("sdk/page-worker")
                .Page({
                    contentScript: "self.port.on('playAlarm', function() {document.getElementById('alarm').play();});",
                    contentScriptWhen: "ready",
                    contentURL: self.data.url("blank.html")
                });
        }

        //-------------check videos-----------------------------------
        var totalNewVideos = 0;
        var newVideosHash = '';
        var oldVideosHash = '';
        var notificationText = '';
        var currentAccount = 0;
        var newVideos = [];

        checkNewVideos(currentAccount);

        function checkNewVideos(count) {
            //we need to get the lastest data
            var account = ExtensionData.channels[count];
            getYoutuber(account.uploadsPlayListId, function(response) {
            	if (response.statusText === "OK") {
	                response = response.json;
	                var newVideosCount = compareVideos(getVideoTitles(response.items), account.videoTitles);
	                var save = false;
	                //if newVideosCount > 0, add the number to the total newVideos number
	                if (newVideosCount) {
	                    ExtensionData.channels[count].newVideos = true;
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
	                    ExtensionData.channels[count].newVideos = false;
	                }
	                //stop recursive function if count > the number of total channels saved
	                if (count < ExtensionData.channels.length - 1) {
	                    //DATA.save(ExtensionData);
	                    checkNewVideos(++count);
	                } else {
	                    //show popup letting user know of new videos
	                    if ((totalNewVideos > 0) && (oldVideosHash !== newVideosHash)) {
	                        if (FF_VERSION >= 36) {
	                            mainBtn.badge = totalNewVideos;
	                        } else {
	                            mainBtn.icon = "./icons/badges/" + (totalNewVideos > 9 ? 10 : totalNewVideos) + ".png";
	                        }

	                        //ExtensionData.cache = []; //clean cache
	                        ExtensionData.cache = newVideos; //THIS WE WANT! - save new videos found
	                        oldVideosHash = newVideosHash;

	                        if (ExtensionData.prefs['show_popup'])
	                            notify(totalNewVideos);

	                        if (ExtensionData.prefs['play_popup_sound'])
	                            alarm.port.emit('playAlarm');
	                    }
	                    //reset
	                    newVideos = [];
	                    newVideosHash = '';
	                    totalNewVideos = 0;
	                    currentAccount = 0;
	                    //check for new videos every X minutes
	                    DATA.save(ExtensionData);
	                    tmr.setTimeout(function() {
	                        checkNewVideos(currentAccount);
	                    }, ExtensionData.prefs['check_interval']);
                	}
            	} else if(response.status !== 404) {
            		//reset
	                newVideos = [];
					newVideosHash = '';
					totalNewVideos = 0;
					currentAccount = 0;
	                    //check for new videos every X minutes
					DATA.save(ExtensionData);
					tmr.setTimeout(function() {
						checkNewVideos(currentAccount);
					}, ExtensionData.prefs['check_interval']);

					console.error('My Youtube New Videos Check error: ' + response.statusText);
            	}
            }, true);
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
                            "author": snippet.channelTitle
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

        //----------------------------------------------------
        function initializeMainwindow() {
            mainWindow = createPopup();

            //run popup js when it is shown
            mainWindow.once("show", function() {
                mainWindow.port.emit("run", {
                    data: ExtensionData,
                    translation: translations
                });
            });

            //destroy popup when hidden & reset
            mainWindow.on("hide", function() {
                DATA.save(ExtensionData);
                mainBtn.state('window', {
                    checked: false
                });
                mainWindow.destroy();
                initializeMainwindow();
            });

            //open new tab when requested
            mainWindow.port.on("open_tab", function(prefs) {
                mainWindow.hide();
                if (prefs.url === "options")
                    openOptions();
                else if (prefs.inNewTab)
                    tabs.open(prefs.url);
                else {
                    //sometimes we are not in a normal tab (with an regular web page loaded)
                    //so we can't redirect that tab to the video, hence we just open a new tab
                    try {
                        tabs.activeTab.attach({
                            contentScript: 'window.location.href = "' + prefs.url + '";'
                        });
                    } catch (e) {
                        tabs.open(prefs.url);
                    }
                }
            });

            //save data state
            mainWindow.port.on("DB_save", function(newData) {
                ExtensionData = newData;
                mainWindow.port.emit("DB_saved");
            });

            //update badge
            mainWindow.port.on("updateBadge", function() {
                if (FF_VERSION >= 36) {
                    mainBtn.badge = (mainBtn.badge - 1) > 0 ? mainBtn.badge - 1 : '';
                } else if (mainBtn.icon.indexOf("badges") !== -1) {
                    var newIcon = mainBtn.icon.replace(/^\D+/g, '');
                    newIcon = parseInt(newIcon) - 1;
                    if (newIcon > 0)
                        mainBtn.icon = "./icons/badges/" + newIcon + ".png";
                    else
                        mainBtn.icon = "./icons/icon38.png";
                }
            });

            mainWindow.port.on("log", function(msg) {
                console.log(msg);
            });
        }

        //creates the main window popup
        function createPopup() {
            return Panel({
                width: 720,
                height: 595,
                position: {
                    top: 0,
                    right: 0
                },
                contentScriptFile: [
                    self.data.url("js/jquery2.js"),
                    self.data.url("js/popup.js")
                ],
                contentScriptWhen: "ready",
                contentURL: self.data.url("popup.html")
            });
        }

        function openOptions() {
            //open new tab
            tabs.open(self.data.url(optionsURL));
        }

        function notify(num) {
            var notificationText = num;
            if (translate('lang') === 'es') {
                if (num > 1)
                    notificationText += ' nuevos videos han sido subidos';
                else
                    notificationText += ' nuevo video ha sido subido';
            } else {
                if (num > 1)
                    notificationText += ' new videos have been uploaded';
                else
                    notificationText += ' new video has been';
            }
            notifications.notify({
                title: translate("extName"),
                iconURL: self.data.url("icons/icon48.png"),
                text: notificationText
            });
        }

        function isNewVideo(title, account) {
            //account = (account === undefined ? selectedAccount : account);
            var tit = ExtensionData.channels[account].videoTitles;

            for (var i = 0; i < tit.length; i++) {
                if (tit[i] === title) {
                    return false;
                }
            }
            return true;
        }

    }

    function upgradeInit(ExtensionData) {

        var channel;
        var name;
        var id;
        /*
        Due to the changes in Youtube's API V3, we need to update our channels array and objects
        to include a new property "uploadsPlayListId" because we need that ID to retreive videos 
        with the new API

        So here we have to connect to Youtube to get this ID and update existing channels*/
        (function upgradeChannels(iii) {
            id = ExtensionData.channels[iii].id;
            name = ExtensionData.channels[iii].name;

            id = (iii > 0) ? 'UC' + id : id; //we need to add 'UC' to our old channel ids except for the first channel

            getYoutuber(id, function(response) {
                if (response.statusText === "OK") {
                    channel = response.json.items[0];
                    ExtensionData.channels[iii].uploadsPlayListId = channel.contentDetails.relatedPlaylists.uploads;
                    ExtensionData.channels[iii].id = id;
                } else {
                    ExtensionData.channels[iii].uploadsPlayListId = null;
                    ExtensionData.channels[iii].id = id;
                    console.error('No uploads playlist id found');
                }

                if (iii < ExtensionData.channels.length - 1) {
                        return upgradeChannels(++iii);
                } else {
                    DATA.save(ExtensionData);
                    init(ExtensionData);
                    return true;
                }

            }, false);
        })(0);

    }

     /*
        @param string account - the account id OR playlist id #confusing?
        @param function callback the callback function
        @param bool getVideos - get or not video data
    */
    function getYoutuber(account, callback, getVideos) {
            //var url = 'http://gdata.youtube.com/feeds/api/users/' + account;
            var url = 'https://www.googleapis.com/youtube/v3/';
            var params = {
                'part': 'snippet',
                'key': 'AIzaSyBbTkdQ5Pl_tszqJqdafAqF0mVWWngv9HU',
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
            
            Request({
                url: url,
                headers: {
                    'Cache-control': 'no-cache'
                },
                content: params,
                onComplete: function(response) {
                    callback(response);
                },
            }).get();
    }

} );

}, 1000);