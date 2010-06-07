/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("properties-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://inverse-library/content/sogoWebDAV.js",
					 "chrome://sogo-integrator/content/sogo-config.js"]);

window.addEventListener("load", onLoadOverlay, false);

var folderURL = "";
var originalName = "";
var originalColor = "";

function onLoadOverlay() {
	if (window.arguments && window.arguments[0]) {
		var calendarName = document.getElementById("calendar-name");
		originalName = calendarName.value;
		folderURL = document.getElementById("calendar-uri").value;
		originalColor = document.getElementById("calendar-color").color;

		if (folderURL.indexOf(sogoBaseURL()) > -1) {
			var rows = ["calendar-readOnly-row", "calendar-cache-row"];
			for each (var row in rows) {
					document.getElementById(row).setAttribute("collapsed", "true");
			}
		}
	}
}

function onOverlayAccept() {
	var rc;

	var newFolderURL = document.getElementById("calendar-uri").value;
	var newName = document.getElementById("calendar-name").value;
	var newColor = document.getElementById("calendar-color").color;

	if (newFolderURL.indexOf(sogoBaseURL()) > -1
			&& newFolderURL == folderURL) {
		var changeName = (newName != originalName);
		var changeColor = (newColor != originalColor);
		if (changeName || changeColor) {
			var proppatch = new sogoWebDAV(newFolderURL, this);
			var query = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
									 + "<propertyupdate xmlns=\"DAV:\">"
									 + "<set><prop>");
			if (changeName)
				query += "<displayname>" + xmlEscape(newName) + "</displayname>";
			if (changeColor)
				query += ("<calendar-color xmlns=\"http://apple.com/ns/ical/\">"
									+ newColor + "FF</calendar-color>");
			query += "</prop></set></propertyupdate>";
			proppatch.proppatch(query);
			rc = false;
		}
		else
			rc = onAcceptDialog();
	}
	else
		rc = onAcceptDialog();

	return rc;
}

function onDAVQueryComplete(status, result) {
	// dump("folderURL: " + folderURL + "\n");

	if (status == 207) {
// 		for (var k in result) {
// 			if (folderURL.indexOf(k) > -1
// 					&& result[k][200]
// 					&& result[k][200]["displayname"]) {
		if (onAcceptDialog())
			setTimeout("window.close();", 100);
// 				break;
// 			}
// 		}
	}
	else {
		var strBundle = document.getElementById("propertiesMessages");
		window.alert(strBundle.getString("serverUpdateFailed") + "\n" + status);
	}
}
