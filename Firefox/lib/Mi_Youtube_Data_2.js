/*
	My Youtube Data
	This file contains a "class" to save the extensions data
*/
function MY_YOUTUBE_DATA(location) {
	this.storage = location;
	this.data = {
		name: "MyYoutubeData",
		version: 3.1,
		channels: [{
			//default PMVTutoriales channel
			id: "UCZgwLCu6tSLEUJ30METhJHg",
			name: "PMVTutoriales",
			thumbnail: "https://yt3.ggpht.com/-mrEkpcfUuX4/AAAAAAAAAAI/AAAAAAAAAAA/cWFyINwhD9s/s88-c-k-no/photo.jpg",
			videoTitles: [],
			newVideos: false,
			url: "https://www.youtube.com/channel/UCZgwLCu6tSLEUJ30METhJHg",
			uploadsPlayListId: "UUZgwLCu6tSLEUJ30METhJHg" //needed for Youtube API V3
		}],
		prefs: {
			"show_popup": true,
			"play_popup_sound": true,
			"check_interval": 600000,
			"open_in_current_tab": true
		},
		isNewInstall: true,
		cache: []
	};
	//just to make some code cleaner
	this.name = this.data.name;
	this.version = this.data.version;
}

MY_YOUTUBE_DATA.prototype.load = function(callback) {
	var upgrade = false;
	if (!this.storage[this.name]) {
		//firt install, save data
		this.setValue(this.name, this.data);
	} else if (this.storage[this.name].version != this.version) {
		upgrade = true;
		this.data.isNewInstall = false;
		this.storage[this.name].channels[0] = this.data.channels[0];
		this.data.channels = this.storage[this.name].channels;
	} else {
		this.data = this.storage[this.name];
	}

	callback(this.data, upgrade);
};

MY_YOUTUBE_DATA.prototype.setValue = function(name, value) {
	this.storage[name] = value;
};

MY_YOUTUBE_DATA.prototype.update = function(newData) {
	this.data = newData;
};

MY_YOUTUBE_DATA.prototype.get = function() {
	return this.data;
};

MY_YOUTUBE_DATA.prototype.save = function(newData) {
	this.data = newData || this.data;
	this.setValue(this.name, this.data);
};

MY_YOUTUBE_DATA.prototype.delete = function() {
	delete this.storage[this.name];
};

function update(target, source) {
	var a = Object.create(target);
	Object.keys(source).map(function(prop) {
		prop in a && (a[prop] = source[prop]);
	});
	return a;
}

exports.MY_YOUTUBE_DATA = MY_YOUTUBE_DATA;