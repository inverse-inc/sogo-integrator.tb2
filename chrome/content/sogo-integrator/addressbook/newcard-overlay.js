/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("newcard-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://sogo-integrator/content/addressbook/folder-handler.js"]);

function SIOnNewCardOverlayLoad() {
	if (gEditCard.selectedAB == kPersonalAddressbookURI) {
		var handler = new AddressbookHandler();
		var existing = handler.getExistingDirectories();
		var personalURL = sogoBaseURL() + "Contacts/personal/";
		var directory = existing[personalURL]
			.QueryInterface(Components.interfaces.nsIRDFResource);
		gEditCard.selectedAB = directory.Value;
		document.getElementById("abPopup").value = directory.Value;
	}
}

window.addEventListener("load", SIOnNewCardOverlayLoad, false);
