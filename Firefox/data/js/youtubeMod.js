/*
	youtubeMod.js
	This script runs on youtube.com/watch?v=*
	It adds a "add" button to the page to easily add Youtubers to the extension
*/
self.port.emit("loadData");
self.port.once("channels", function(channels) {
	var isNewYoutuber = true;
	var userName;

	if (window.location.href.indexOf('watch?v=') !== -1) {
		userName = document.getElementsByClassName('yt-user-name')[0];
		userName = userName.getAttribute('data-ytid');
		userName = userName.substring(2).trim();
	} else {
		userName = document.getElementsByClassName('yt-uix-subscription-button')[0];
		userName = userName.getAttribute('data-channel-external-id');
		userName = userName.substring(2).trim();
	}
	//console.log('BBBB '  + JSON.stringify(self.options.channels, null, 4))
	for (var i = channels.length - 1; i >= 0; i--) {
		if(userName === channels[i].id) {
			isNewYoutuber = false;
			break;
		}
	};

	var addBtn = document.createElement('button');
		addBtn.setAttribute('class', 'yt-uix-button yt-uix-button-size-default yt-uix-button-has-icon yt-uix-button-subscribe-branded');
		addBtn.setAttribute('style', 'background-image: linear-gradient(to top, rgba(199, 26, 166, 1) 0px, rgba(230, 34, 200, 1) 100%); margin-right: 12px;');
		
		if (isNewYoutuber) {
			addBtn.innerHTML = self.options.btnAddTxt;
			addBtn.addEventListener('click', addYoutuber);
		} else {
			addBtn.innerHTML = self.options.btnAddedTxt;
			addBtn.setAttribute('disabled', 'disabled');
		}

	var container = document.getElementsByClassName(' yt-uix-button-subscription-container with-preferences')[0];
	var susBtn = container.getElementsByTagName('button')[0];
	container.insertBefore(addBtn, susBtn);

	function addYoutuber() {
		if(document.getElementById('myY-modal')) {
			document.getElementById('myY-modal').setAttribute('style', '');
		}
		else {
			var modal = document.createElement('div');
				modal.setAttribute('class', 'modal');
				modal.setAttribute('id', 'myY-modal');
				modal.innerHTML = '<div style="font-weight: bolder">'+self.options.btnAddingTxt+'...</div>';
			document.body.appendChild(modal);
		}

		self.port.emit('addYoutuber', userName);
	}

	self.port.on('done', function(status) {
		if (status.isError === false) {
			addBtn.setAttribute('disabled', 'disabled');
			addBtn.removeEventListener('click', addYoutuber, false);
			addBtn.innerHTML = self.options.btnAddedTxt;
		} else {
			alert(self.options.errMsg);
		}

		//remove/hide
		document.getElementById('myY-modal').setAttribute('style', 'display:none');
	});
});