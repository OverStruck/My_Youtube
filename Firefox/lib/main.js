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

    DATA.load(function(ExtensionData) {
        //---------required modules & setup -------------------------------
        //var {ActionButton} = require("sdk/ui/button/action"); //button ui
        var {
            ToggleButton
        } = require('sdk/ui/button/toggle');
        var {
            Panel
        } = require("sdk/panel"); //panel (for main popup)
        var Request = require("sdk/request").Request; //network requests
        var tabs = require("sdk/tabs");
        var translate = require("sdk/l10n").get;
        var notifications = require("sdk/notifications");
        var pageMod = require("sdk/page-mod"); //needed to add contentscripts
        var self = require("sdk/self");

        var optionsURL = "options.html";

        //first install
        if (ExtensionData.isNewInstall) {
            getYoutuber("ZgwLCu6tSLEUJ30METhJHg", function(response) {
                response = response.json;
                ExtensionData.channels[0].videoTitles = getVideoTitles(response.feed);
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
                "https://www.youtube.com/watch?v=*",
                "http://www.youtube.com/watch?v=*",
                "https://www.youtube.com/user/*",
                "http://www.youtube.com/user/*",
                "https://www.youtube.com/channel/*",
                "http://www.youtube.com/channel/*"
            ],
            contentScriptWhen: 'ready',
            contentScriptFile: self.data.url("js/youtubeMod.js"),
            contentStyleFile: self.data.url("css/youtubeMod.css"),
            contentScriptOptions: {
                btnAddTxt: translate('YtModBtnAddTxt'),
                btnAddedTxt: translate('YtModBtnAddedTxt'),
                btnAddingTxt: translate('YtModBtnAddingTxt'),
                errMsg: translate('YtModErrMsg')
            },
            attachTo: 'top',
            onAttach: function onAttach(worker) {
                //console.log('A---->:    ' + JSON.stringify(ExtensionData.channels, null, 4))
                worker.port.on('loadData', function() {
                    worker.port.emit("channels", ExtensionData.channels);
                });
                worker.port.on("addYoutuber", function(userName) {
                    /*sadly, we have to make 2 network requests
                one to get the channel thumbnail
                and the second one to get the videos because youtube*/
                    getYoutuber(userName, function(res) {
                        if (res.statusText === "OK") {
                            res = res.json;
                            getYoutuber(userName, function(response) {
                                if (response.statusText === "OK") {
                                    response = response.json;
                                    var youtuber = response.feed;
                                    ExtensionData.channels.push({
                                        'id': res.entry.author[0].yt$userId.$t,
                                        'name': youtuber.author[0].name.$t,
                                        'thumbnail': res.entry.media$thumbnail.url,
                                        'videoTitles': getVideoTitles(youtuber),
                                        'newVideos': false,
                                        'url': res.entry.link[0].href
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
            getYoutuber(account.id, function(response) {
                response = response.json;
                var newVideosCount = compareVideos(getVideoTitles(response.feed), account.videoTitles);
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
                    var videos = proccessYoutubeFeed(response.feed);
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
            }, true);
        }

        function getYoutuber(account, callback, getVideos) {
            var url = 'http://gdata.youtube.com/feeds/api/users/' + account;
            var params = {
                "v": 2,
                "alt": 'json'
            };
            //extra parameters needed to get account videos
            if (getVideos) {
                url += '/uploads';
                params['start-index'] = 1;
                params['max-results'] = 4;
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

        function getVideoTitles(data) {
            var entries = data.entry,
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

    });

}, 1000);