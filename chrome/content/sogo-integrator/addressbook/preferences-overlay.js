/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("preferences-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
					 "chrome://sogo-integrator/content/sogo-config.js"]);

window.addEventListener("load", onLoadOverlay, false);

var folderURL = "";
var originalName = "";

function onLoadOverlay() {
	if (window.arguments && window.arguments[0]) {
		folderURL = document.getElementById("groupdavURL").value;
		originalName = document.getElementById("description").value;
	}
}

function onOverlayAccept() {
	var rc;

	var newFolderURL = document.getElementById("groupdavURL").value;
	var newName = document.getElementById("description").value;
	if (newFolderURL.indexOf(sogoBaseURL()) > -1
			&& newFolderURL == folderURL
			&& newName != originalName) {
		var proppatch = new sogoWebDAV(newFolderURL,
																	 new renameTarget(this));
		proppatch.proppatch("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
												+ "<propertyupdate xmlns=\"DAV:\">"
												+ "<set>"
												+ "<prop><displayname>" + xmlEscape(newName)
												+ "</displayname>"
												+ "</prop></set></propertyupdate>");
		rc = false;
	}
	else
		rc = onAccept();

	return rc;
}

function renameTarget(dlg) {
	this.dialog = dlg;
}

renameTarget.prototype = {
 onDAVQueryComplete: function(status, result) {
		var correct = false;

		if (status == 207) {
			for (var k in result) {
				if (this.dialog.folderURL.indexOf(k) > -1
						&& result[k][200]
						&& result[k][200]["displayname"]) {
					if (onAccept())
						setTimeout("window.close();", 200);
					break;
				}
			}
		}
		else {
			var strBundle = document.getElementById("preferencesMessages");
			window.alert(strBundle.getString("serverUpdateFailed") + "\n" + status);
		}
	}
};
