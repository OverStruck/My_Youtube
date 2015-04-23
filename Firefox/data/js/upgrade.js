//Firefox - upgrade.js

//get all strings to translate
var strings = [];
for (var i = 1; i <= 9; i++)
    strings.push("errMsg" + i);

strings.push("lang");
//translate
self.port.emit("translation", strings);
self.port.once("translation", function(response) {
    var translation = response.translation;
    //../locales/es/logo.png
    $("#logo").css("background-image", "url('./locales/" + translation.lang + "/logo.png')");
    main(response.data, translation, response.addonVersion);
});

function main(ExtensionData, translation, addonVersion) {
	window.alert('helo');
}