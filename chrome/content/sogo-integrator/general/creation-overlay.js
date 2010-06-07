/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("creation-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/general/creation-utils.js"]);

window.addEventListener("load", onCreationDialog, false);

function onCreationDialog() {
	var button = document.getElementById("createButton");
	button.addEventListener("click", onCreateButtonClick, false);
	window.addEventListener("dialogaccept", onDialogAccept, false);
}

function onCreateButtonClick(event) {
	_confirmCreation();
}

function onDialogAccept(event) {
	dump("accept\n");
	_confirmCreation();
	event.preventDefault();
}

function onCreationDone() {
 	setTimeout("window.close()", 100);
}

function _confirmCreation() {
	var createInput = document.getElementById("createInput");
	var folderName = "" + createInput.value;

	if (folderName.replace(/(^\s+|\s+$)/g, '').length > 0)
		createFolder(folderName, window.arguments[0].creationGetHandler(),
								 window);
}
