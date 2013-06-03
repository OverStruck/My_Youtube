//save extension data setup
var ExtensionDataName = 'Mi_Youtube_Data',
	ExtensionData = {
	dataVersion: 2,
	accounts: [
    {
        //default PMVTutoriales channel
        id: "ZgwLCu6tSLEUJ30METhJHg", 
        name: "PMVTutoriales", 
        thumbnail: "https://i3.ytimg.com/i/ZgwLCu6tSLEUJ30METhJHg/1.jpg?v=516a0349", 
        videoTitles: [], 
        newVideos: false,
        url: "https://www.youtube.com/channel/UCZgwLCu6tSLEUJ30METhJHg"
    }
    ],
    prefs: {
        'show_popup': true,
        'play_popup_sound': true,
        'check_interval': 600000
    },
    isNewInstall: true,
    newVideosCache: []
};

function DB_setValue(name, value, callback) {
    var obj = {};
    obj[name] = value;
    chrome.storage.local.set(obj, function() {
        if(callback) callback();
    });
}

function DB_load(callback) {
    chrome.storage.local.get(ExtensionDataName, function(r) {
        if (isEmpty(r[ExtensionDataName])) {
            DB_setValue(ExtensionDataName, ExtensionData, callback);
        } else if (r[ExtensionDataName].dataVersion != ExtensionData.dataVersion) {
            DB_setValue(ExtensionDataName, ExtensionData, callback);
        } else {
            ExtensionData = r[ExtensionDataName];
            if (!r[ExtensionDataName]) {
                ExtensionData.newVideosCache = [];
            }
            callback();
        }
    });
}

function DB_save(callback) {
    DB_setValue(ExtensionDataName, ExtensionData, function() {
        if(callback) callback();
    });
}

function DB_clear(callback) {
    chrome.storage.local.remove(ExtensionDataName, function() {
        if(callback) callback();
    });
}

function isEmpty(obj) {
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			return false;
		}
	}
	return true;
}