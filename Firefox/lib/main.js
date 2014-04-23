/* 
  My Youtube (FF) Main.js file 
  Last update 4/21/2014

  This is the brain file of the extension
  it is akin to background.js in chrome extensions
*/
const SS = require("sdk/simple-storage"); //simple storage 
const DATABASE = require("./Mi_Youtube_Data_2"); //import data module
//create data object (constains all extension data)
const DATA = new DATABASE.MY_YOUTUBE_DATA(SS.storage);

DATA.load(function (ExtensionData) {
    //---------required modules & setup -------------------------------
    const {ActionButton} = require("sdk/ui/button/action"); //button ui
    const {Panel} = require("sdk/panel"); //panel (for main popup)
    const Request = require("sdk/request").Request; //network requests
    const tabs = require("sdk/tabs");
    const self = require("sdk/self"); //self 
    const ss = require("sdk/simple-storage");
    const translate = require("sdk/l10n").get;
    const notifications = require("sdk/notifications");
    const tmr = require("sdk/timers");
    const pageMod = require("sdk/page-mod"); //needed to add contentscripts

    //--------first install--------------------------------------------
    if (ExtensionData.isNewInstall) {
        getYoutuber("ZgwLCu6tSLEUJ30METhJHg", function (response) {
            ExtensionData.channels[0].videoTitles = getVideoTitles(response.feed);
            ExtensionData.isNewInstall = false;
            DATA.save(ExtensionData);
            openOptions();
        }, true);
    } else if (ExtensionData.channels.length === 0) {
        openOptions();
    }

    //-------------translate strings for popup----------------------------
    var translations = {};
    translations['popupMsg1'] = translate('popupMsg1');
    translations['popup_tooltip'] = translate('popup_tooltip');
    translations['contextMenuMsg'] = translate('contextMenuMsg');
    translations['newTxt'] = translate('newTxt');

    for (let i = 0; i <= 3; i++) {
        let name = "popupE" + i + "_B";
        let name2 = "popupE" + i + "_H";

        translations[name] = translate(name);
        translations[name2] = translate(name2);
    };

    //----------create extension main button & popup setup--------------------------------
    var mainWindow; //main popup window
    //creates the main extension button
    var mainBtn = ActionButton({
        id: "mainBtn",
        label: "My Youtube",
        icon: {
            "16": "./icons/icon16.png", //paths relative to the data folder
            "38": "./icons/icon38.png",
            "48": "./icons/icon48.png"
        },
        onClick: function (state) {
            //create and initialize the main popup window
            initializeMainwindow();
            mainWindow.show();
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
        attachTo: 'top',
        onAttach: function onAttach(worker) {
        	//console.log('A---->:    ' + JSON.stringify(ExtensionData.channels, null, 4))
        	worker.port.on('loadData', function() {
        		worker.port.emit("channels", ExtensionData.channels);
        	});
            worker.port.on("addYoutuber", function (userName) {
                /*sadly, we have to make 2 network requests
                one to get the channel thumbnail
                and the second one to get the videos because youtube*/
                getYoutuber(userName, function(res) {
                    
                    getYoutuber(userName, function (response) {
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
                        worker.port.emit("done");
                    }, true);

                }, false);

            });
        }
    });

    //----------options page------------------------------------------
    pageMod.PageMod({
        include: self.data.url("options.html"),
        contentScriptFile: [
            self.data.url("js/jquery2.js"),
            self.data.url("js/options.js")
        ],
        //port event listeners
        onAttach: function (worker) {
            let translation = {};
            //listen for translation request
            worker.port.once("translation", function (strings) {
                for (var i = 0; i < strings.length; i++) {
                    //translate
                    translation[strings[i]] = translate(strings[i]);
                }
                //send translation
                worker.port.emit("translation", {
                    data: ExtensionData,
                    translation: translation
                });
            });

            //listen for save request
            worker.port.on("DB_save", function (newData) {
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
        const alarm = require("sdk/page-worker")
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

    checkNewVideos(0);

    function checkNewVideos(count) {
        //we need to get the lastest data
        var account = ExtensionData.channels[count];
        getYoutuber(account.id, function (response) {
            var newVideos = compareVideos(getVideoTitles(response.feed), account.videoTitles);
            //if newVideos > 0, add the number to the total newVideos number
            if (newVideos) {
                ExtensionData.channels[count].newVideos = true;
                totalNewVideos += newVideos;
                newVideosHash += account.name + totalNewVideos;
            } else {
                ExtensionData.channels[count].newVideos = false;
            }
            //stop recursive function if count > the number of total channels saved
            if (count < ExtensionData.channels.length - 1) {
                count++;
                DATA.save(ExtensionData);
                checkNewVideos(count);
            } else {
                //if totalNewVideos > 0, update icon badge number
                if (totalNewVideos) {
                    mainBtn.icon = "./icons/badges/" + (totalNewVideos > 9 ? 10 : totalNewVideos) + ".png";

                    //show popup letting user know of new videos
                    if (oldVideosHash !== newVideosHash) {
                        ExtensionData.cache = []; //clean cache
                        oldVideosHash = newVideosHash;
                        if (ExtensionData.prefs['show_popup']) {
                            notify(totalNewVideos);
                        }
                        if (ExtensionData.prefs['play_popup_sound'])
                            alarm.port.emit('playAlarm');
                    }
                    newVideosHash = '';
                }
                //check for new videos every X minutes
                DATA.save(ExtensionData);
                tmr.setTimeout(function () {
                    totalNewVideos = 0;
                    checkNewVideos(0);
                }, ExtensionData.prefs['check_interval']);
            }
        }, true);
    }

    function getYoutuber(account, callback, getVideos) {
        var url = 'http://gdata.youtube.com/feeds/api/users/' + account;
        var params = {
            "v": 2,
            "alt": 'json'
        }
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
            onComplete: function (response) {
                if (response.statusText === "OK")
                    callback(response.json);
                else
                    console.log("getYoutuber Error: " + response.statusText);
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
        mainWindow.once("show", function () {
            mainWindow.port.emit("run", {
                data: ExtensionData,
                translation: translations
            });
        });

        //destroy popup when hidden & reset
        mainWindow.on("hide", function () {
            DATA.save(ExtensionData);
            mainWindow.destroy();
            initializeMainwindow();
        });

        //open new tab when requested
        mainWindow.port.on("open_tab", function (prefs) {
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
        mainWindow.port.on("DB_save", function (newData) {
            ExtensionData = newData;
            mainWindow.port.emit("DB_saved");
        });

        //update badge
        mainWindow.port.on("updateBadge", function () {
            if (mainBtn.icon.indexOf("badges") !== -1) {
                let newIcon = mainBtn.icon.replace(/^\D+/g, '');
                newIcon = parseInt(newIcon) - 1;
                if (newIcon > 0)
                    mainBtn.icon = "./icons/badges/" + newIcon + ".png";
                else
                    mainBtn.icon = "./icons/icon38.png";
            }
        });

        mainWindow.port.on("log", function (msg) {
            console.log(msg);
        });
    }

    //creates the main window popup
    function createPopup() {
        return Panel({
            width: 700,
            height: 586,
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
        tabs.open(self.data.url("options.html"));
    }

    function notify(num) {
        var videoS = (num > 1) ? "videos" : "video";
        var has_have = (num > 1) ? "have" : "has";
        notifications.notify({
            title: translate("extName"),
            iconURL: self.data.url("icons/icon48.png"),
            text: translate("notificationText", num.toString(), videoS, has_have)
        });
    }

});