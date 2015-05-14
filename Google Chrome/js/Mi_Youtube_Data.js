//save extension data setup
var ExtensionDataName = 'Mi_Youtube_Data',
	ExtensionData = {
	dataVersion: 3.1,
	accounts: [
    {
        //default PMVTutoriales channel
            id: "UCZgwLCu6tSLEUJ30METhJHg",
            name: "PMVTutoriales",
            thumbnail: "https://yt3.ggpht.com/-mrEkpcfUuX4/AAAAAAAAAAI/AAAAAAAAAAA/cWFyINwhD9s/s88-c-k-no/photo.jpg",
            videoTitles: [],
            newVideos: false,
            url: "https://www.youtube.com/channel/UCZgwLCu6tSLEUJ30METhJHg",
            uploadsPlayListId: "UUZgwLCu6tSLEUJ30METhJHg" //needed for Youtube API V3
    }
    ],
    prefs: {
        "show_popup": true,
        "play_popup_sound": true,
        "check_interval": 600000,
        "open_in_current_tab": true
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

function DB_usage() {
    chrome.storage.local.getBytesInUse(ExtensionDataName, function(bytesInUse) {
        if(bytesInUse === 0) return '0 Byte';
       var k = 1000;
       var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
       var i = Math.floor(Math.log(bytesInUse) / Math.log(k));
       var amount =  (bytesInUse / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];

        $('#usage').text(amount);
        
    });
}

function DB_load(callback) {
	var upgrade = false;
    chrome.storage.local.get(ExtensionDataName, function(r) {
        if (isEmpty(r[ExtensionDataName])) {
            DB_setValue(ExtensionDataName, ExtensionData, callback);
        } else if (r[ExtensionDataName].dataVersion != ExtensionData.dataVersion) {
            upgrade = true;
			r[ExtensionDataName].isNewInstall = false;
			r[ExtensionData].newVideosCache = [];
			r[ExtensionDataName].accounts[0] = ExtensionData.accounts[0];
            DB_setValue(ExtensionDataName, ExtensionData, callback);
        } else {
            ExtensionData = r[ExtensionDataName];
        }
        callback(upgrade);
    });
}

function DB_save(callback) {
    DB_setValue(ExtensionDataName, ExtensionData, callback);
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