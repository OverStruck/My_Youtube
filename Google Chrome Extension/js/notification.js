//localize
var objects = document.getElementsByTagName('*');
for (var i = 0; i < objects.length; i++) {
	if (objects[i].dataset && objects[i].dataset.message) {
		objects[i].innerHTML = chrome.i18n.getMessage(objects[i].dataset.message);
	}
}
chrome.runtime.sendMessage('notificationText', function(response) {
	document.getElementById('msg').innerHTML = response;
});