/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("startup-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

var forcedPrefs = {};

function openUpdateDialog() {
  window.openDialog("chrome://sogo-integrator/content/messenger/update-dialog.xul",
										"Extensions", "status=yes");
}

function sogoIntegratorStartupOverlayOnLoad() {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	try {
		loader.loadSubScript("chrome://sogo-integrator/content/general/custom-preferences.js");
		applyForcedPrefs();
	}
	catch(e) {
		dump("Custom preference code not available.\ne: " + e + "\n");
	}

	try {
 		loader.loadSubScript("chrome://sogo-integrator/content/general/startup.js");
 		try {
 			CustomStartup();
 		}
 		catch(customE) {
 			dump("An exception occured during execution of custom startup"
 					 + " code.\nException: " + customE
 					 + "\nFile: " + customE.fileName
 					 + "\nLine: " + customE.lineNumber
 					 + "\n\n Stack:\n\n" + customE.stack);
 		}
 		dump("Custom startup code executed\n");
 	}
 	catch(e) {
 		dump("Custom startup code not available.\ne: " + e + "\n");
 	}

	if (typeof(getCompositeCalendar) == "undefined"
			|| !_setupCalStartupObserver()) {
		openUpdateDialog();
	}
}

//
// Work-around a bug in the SSL code which seems to hang Thunderbird when
// calendars are refreshing and extensions updates are being checked...
//
function _setupCalStartupObserver() {
	var handled = false;

	var compCalendar = getCompositeCalendar();
	var calDavCount = 0;
	var calendars = compCalendar.getCalendars({});
	for each (var calendar in calendars)
		if (calendar.type == "caldav"
				&& !calendar.getProperty("disabled"))
			calDavCount++;

	dump("need to start after: " + calDavCount + " cals\n");

	if (calDavCount > 0) {
		SICalStartupObserver.maxCount = calDavCount;
		compCalendar.addObserver(SICalStartupObserver);
		handled = true;
	}

	return handled;
}

function _getVersionTags(versionString) {
	var currentVersionTags = [];

	var currentString = versionString;
	var dotIndex = currentString.indexOf(".");
	if (dotIndex == 0) {
		currentString = "0" + currentString;
		dotIndex++;
	}
	while (dotIndex > -1) {
		var currentTag = currentString.substr(0, dotIndex);
		currentVersionTags.push(parseInt(currentTag));
		currentString = currentString.substr(dotIndex + 1);
		dotIndex = currentString.indexOf(".");
	}
	currentVersionTags.push(parseInt(currentString));

	return currentVersionTags;
}

function checkExtensionVersion(currentVersion, minVersion, strict) {
	var acceptable = true;

	var stop = false;

	var currentVersionTags = _getVersionTags(currentVersion);
	var minVersionTags = _getVersionTags(minVersion);

	if (currentVersionTags.length
			> minVersionTags.length) {
		var delta = currentVersionTags.length - minVersionTags.length;
		for (var i = 0; i < delta; i++)
			minVersionTags.push(0);
	}
	else if (currentVersionTags.length
					 < minVersionTags.length) {
		var delta = minVersionTags.length - currentVersionTags.length;
		for (var i = 0; i < delta; i++)
			currentVersionTags.push(0);
	}

	var max = currentVersionTags.length;
	var i = 0

	while (!stop && i < max) {
		if (currentVersionTags[i] == minVersionTags[i])
			i++;
		else {
			stop = true;
			if (strict
					|| currentVersionTags[i] < minVersionTags[i])
				acceptable = false;
		}
	}

	return acceptable;
}

function _checkSystemFolders() {
	jsInclude(["chrome://sogo-integrator/content/messenger/folders-update.js"]);

	dump("cleanup\n");
	cleanupAddressBooks();
	checkFolders();
	startFolderSync();
	dump("startup done\n");
}

function checkSystemFolders() {
	window.setTimeout(_checkSystemFolders, 100);
}

// forced prefs
function force_int_pref(key, value) {
	forcedPrefs[key] = { type: "int", value: value };
}

function force_bool_pref(key, value) {
	forcedPrefs[key] = { type: "bool", value: value };
}

function force_char_pref(key, value) {
	forcedPrefs[key] = { type: "char", value: value };
}

function applyForcedPrefs() {
	var prefService = Components.classes["@mozilla.org/preferences;1"]
		.getService(Components.interfaces.nsIPrefBranch);
	for (var key in forcedPrefs) {
		var pref = forcedPrefs[key];
		if (pref["type"] == "int") {
			prefService.setIntPref(key, pref["value"]);
		}
		else if (pref["type"] == "bool") {
			prefService.setBoolPref(key, pref["value"]);
		}
		else if (pref["type"] == "char") {
			prefService.setCharPref(key, pref["value"]);
		}
		else
			dump("unsupported pref type: " + pref["type"] + "\n");
	}
}

// composite observer
var SICalStartupObserver = {
 counter: 0,
 maxCount: -1,
 onLoad: function(calendar) {
// 		var compCalendar = getCompositeCalendar();
// 		compCalendar.removeObserver(this);
// 		dump("update dialog from observer\n");
// 		openUpdateDialog();
// 		dump("update dialog from observer done\n");
		this.counter++;
		dump("counter: " + this.counter + "\n");
		if (this.counter >= this.maxCount) {
			dump("removing observer\n");
			var compCalendar = getCompositeCalendar();
			compCalendar.removeObserver(this);
			dump("update dialog from observer\n");
			openUpdateDialog();
		}
// 		var compCalendar = getCompositeCalendar();
// 		compCalendar.removeObserver(this);
// 		dump("update dialog from observer\n");
// 		openUpdateDialog();
	},
 onStartBatch: function(calendar) {},
 onEndBatch: function(calendar) {},
 onAddItem: function(aItem) {},
 onModifyItem: function(newItem, oldItem) {},
 onDeleteItem: function(aItem) {},
 onError: function(calendar, errNo, msg) {},
 onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {},
 onPropertyDeleting: function(aCalendar, aName) {}
};

// startup

window.addEventListener("load", sogoIntegratorStartupOverlayOnLoad, false);
