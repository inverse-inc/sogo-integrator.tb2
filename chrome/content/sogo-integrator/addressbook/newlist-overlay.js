/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("newlist-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://sogo-integrator/content/addressbook/folder-handler.js"]);

function SIOnNewListOverlayLoad() {
	var abPopup = document.getElementById("abPopup");
	if (abPopup.value == kPersonalAddressbookURI) {
		var handler = new AddressbookHandler();
		var existing = handler.getExistingDirectories();
		var personalURL = sogoBaseURL() + "Contacts/personal/";
		var directory = existing[personalURL]
			.QueryInterface(Components.interfaces.nsIRDFResource);
		abPopup.value = directory.Value;
	}
}

window.addEventListener("load", SIOnNewListOverlayLoad, false);
