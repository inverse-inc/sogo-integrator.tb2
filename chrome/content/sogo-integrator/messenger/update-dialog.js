/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

var consoleSvc = Components.classes["@mozilla.org/consoleservice;1"]
	.getService(Components.interfaces.nsIConsoleService);

function logString(string) {
	if (string[string.length-1] != "\n")
		string += "\n";
	dump(string);
	if (consoleSvc)
		consoleSvc.logStringMessage(string);
// 	var logArea = document.getElementById("logArea");
// 	if (logArea)
// 		logArea.value = logArea.value + string;
}

var iCc = Components.classes;
var iCi = Components.interfaces;
var thunderbirdUID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
var shouldRestart = false;
var errorsHappened = false;

function inverseUpdateListener() {
	return this;
}

inverseUpdateListener.prototype = {
 QueryInterface: function (aIID) {
		if (!aIID.equals(Components.interfaces.nsISupports)
				&& !aIID.equals(Components.interfaces.nsIAddonUpdateCheckListener)
				&& !aIID.equals(Components.interfaces.nsIAddonUpdateListener)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}

		return this;
	},
 onAddonUpdateEnded: function(addon, status) {
		logString("addon: " + addon.id + "; status: " + status + "\n");
	},
 onAddonUpdateStarted: function(addon) {
		logString("addonupdatestarted\n");
	},
 onUpdateEnded: function() {
		logString("updateended\n");
	},
 onUpdateStarted: function() {
		logString("updatestarted\n");
	},
 onStateChange: function(addon, state, value) {
		logString("onstatechange: " + state + "\n");
	},
 onProgress: function (addon, value, maxValue) {
		logString("onprogress: " + value + "\n");
	}
};

function configureCurrentExtensions(cfExtensions) {
	if (cfExtensions.length > 0) {
		for (var i = 0; i < cfExtensions.length; i++)
			logString("configuring extension (fake): " + cfExtensions[i]);
	}
	this.configurationDone = true;
	this.restartIfPossible();
}

function uninstallCurrentExtensions(cfExtensions) {
	var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"].getService().QueryInterface(iCi.nsIExtensionManager);
	
	logString("About to remove " + cfExtensions.length + " extensions");
	if (cfExtensions.length > 0) {
		for (var i = 0; i < cfExtensions.length; i++) {
			logString("Removing existing extension: " + cfExtensions[i]);
			gExtensionManager.uninstallItem(cfExtensions[i]);
		}
	}
	this.uninstallDone = true;
	shouldRestart = true;
	this.restartIfPossible();
}

function downloadMissingExtensions(dlExtensions) {
	if (dlExtensions.length > 0) {
		//var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"].getService().QueryInterface(iCi.nsIExtensionManager);
		//     var dlDlg
		//       = window.openDialog("chrome://mozapps/content/downloads/downloads.xul",
		// 			  "ext", "chrome,dialog,centerscreen,resizable");
		window.extensionDownloads = new Array();
		//     window.downloadDialog = dlDlg;
		for (var i = 0; i < dlExtensions.length; i++) {
			logString("downloading " + dlExtensions[i].name);
			window.extensionDownloads.push(this.downloadExtension(dlExtensions[i]));
		}
		logString("starting loop");
		window.downloadInterval = window.setInterval(window.checkDownloadInterval, 500);
	}
	else {
		this.downloadsDone = true;
		logString("no extension missing");
	}
}

function getHandledExtensions() {
	var handledExtensions = new Array();

	var rdf = iCc["@mozilla.org/rdf/rdf-service;1"].getService(iCi.nsIRDFService);
	var extensions = rdf.GetResource("http://inverse.ca/sogo-integrator/extensions");
	var updateURL = rdf.GetResource("http://inverse.ca/sogo-integrator/updateURL");
	var extensionId = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#id");
	var extensionName = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#name");

	var ds = rdf.GetDataSourceBlocking("chrome://sogo-integrator/content/extensions.rdf");

	try {
		var urlNode = ds.GetTarget(extensions, updateURL, true);
		if (urlNode instanceof iCi.nsIRDFLiteral)
			handledExtensions.updateRDF = urlNode.Value;

		var targets = ds.ArcLabelsOut(extensions);
		while (targets.hasMoreElements()) {
			var predicate = targets.getNext();
			if (predicate instanceof iCi.nsIRDFResource) {
				var target = ds.GetTarget(extensions, predicate, true);
				if (target instanceof iCi.nsIRDFResource) {
					var extension = new Object();
					var id = ds.GetTarget(target, extensionId, true);
					if (id instanceof iCi.nsIRDFLiteral)
						extension.id = id.Value;
					var name = ds.GetTarget(target, extensionName, true);
					if (name instanceof iCi.nsIRDFLiteral) {
						extension.name = name.Value;
// 						logString("name: " + extension.name + "\n");
					}
					if (extension.id)
						handledExtensions.push(extension);
				}
			}
		}
	}
	catch(e) {}

	return handledExtensions;
}

function prepareRequiredExtensions(extensions) {
	var extensionsURL = new Array();
	var unconfiguredExtensions = new Array();
	var uninstallExtensions = new Array();

	var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"].getService().QueryInterface(iCi.nsIExtensionManager);
	var preferences = Components.classes["@mozilla.org/preferences;1"]
		.getService(Components.interfaces.nsIPref);

	var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
		.getService(Components.interfaces.nsIXULRuntime);

	var rdf = iCc["@mozilla.org/rdf/rdf-service;1"].getService(iCi.nsIRDFService);

	for (var i = 0; i < extensions.length; i++) {
		var extensionItem = gExtensionManager.getItemForID(extensions[i].id);
		var extensionRDFURL = extensions.updateRDF
			.replace("%ITEM_ID%", escape(extensions[i].id), "g")
			.replace("%ITEM_VERSION%", "0.00", "g")
			.replace("%PLATFORM%", escape(appInfo.OS + "_" + appInfo.XPCOMABI), "g");
		var extensionURN = rdf.GetResource("urn:mozilla:extension:" + extensions[i].id);
		var extensionData = this.getExtensionData(rdf, extensionRDFURL, extensionURN);
		if (extensionData) {
			// We check if we have to disable some extension that _is installed_
			// If so, let's do it right away
			if (extensionItem.name.length > 0 && extensionData.version == "disabled") {
				uninstallExtensions.push(extensions[i].id);
			} 
			else if ((!extensionItem.name || extensionData.version != extensionItem.version) && extensionData.version != "disabled") {
				extensionsURL.push({name: extensions[i].name,
							url: extensionData.url});
			}
			else {
				var configured = false;
				try {
					configured = preferences.GetBoolPref("inverse-sogo-integrator.extensions." + extensions[i].id + ".isconfigured");
				}
				catch(e) {}
				if (!configured)
					unconfiguredExtensions.push(extensions[i].id);
			}
		}
		else
			logString("no data returned for " + extensionItem.name);
	}

	return {urls: extensionsURL, configuration: unconfiguredExtensions, uninstall: uninstallExtensions};
}

function downloadExtension(dlExtension) {
	logString ("extension: " + dlExtension.url + "\n");
	var destURL = this.extensionDestURL(dlExtension.url);

	var downloadMgr = iCc['@mozilla.org/download-manager;1']
		.getService(iCi.nsIDownloadManager);
	downloadMgr.cleanUp();
	var ioService = iCc["@mozilla.org/network/io-service;1"]
		.getService(iCi.nsIIOService);
	var extensionURI = ioService.newURI(dlExtension.url, null, null);
	var destURI = ioService.newURI(destURL, null, null);

	var persist = iCc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
		.createInstance(iCi.nsIWebBrowserPersist);
	persist.persistFlags
		= (iCi.nsIWebBrowserPersist.PERSIST_FLAGS_NO_CONVERSION
			 | iCi.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES
			 | iCi.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE);

	var ret = downloadMgr.addDownload(-1, extensionURI, destURI, dlExtension.name,
																		"chrome://mozapps/skin/xpinstall/xpinstallItemGeneric.png",
																		null, -1, null, persist);
	persist.progressListener = ret;
	persist.saveURI(extensionURI, null, null, null, null, destURI);

	return ret.targetFile;
}

function extensionDestURL(extensionURL) {
	var parts = extensionURL.split("/");

	var fileLocator = iCc["@mozilla.org/file/directory_service;1"].getService(iCi.nsIProperties);
	var destURL = ("file://" + fileLocator.get("TmpD", iCi.nsIFile).path
								 + "/" + parts[parts.length - 1]);

	return destURL;
}

function checkDownloadInterval() {
	logString("check");

	var downloadMgr = iCc['@mozilla.org/download-manager;1']
		.getService(iCi.nsIDownloadManager);

	if (!downloadMgr.activeDownloadCount) {
		clearInterval(window.downloadInterval);
		downloadMgr.cleanUp();
		//     if (window.downloadDialog)
		//       window.downloadDialog.close();

		this.installDownloadedExtensions();
		logString("loop ended");
	}

	return true;
}

function installDownloadedExtensions() {
	var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"].getService().QueryInterface(iCi.nsIExtensionManager);

	gExtensionManager.addUpdateListener(new inverseUpdateListener());
	logString("downloads:  " + window.extensionDownloads.length);
	if (window.extensionDownloads.length) {
		for (var i = 0; i < window.extensionDownloads.length; i++) {
			logString("installing: " + window.extensionDownloads[i].leafName);
			try {
				gExtensionManager.installItemFromFile(window.extensionDownloads[i],
																							"app-profile");
			}
			catch(e) {
				errorsHappened = true;
				logString("installation failure");
			}
		}
		shouldRestart = true;
	}

	this.downloadsDone = true;
	this.restartIfPossible();
}

function restartIfPossible() {
	if (this.downloadsDone && this.configurationDone && this.uninstallDone) {
		if (errorsHappened) {
			window.opener.checkSystemFolders();
			window.close();
		}
		else {
			if (shouldRestart) {
				var dialog = document.getElementById("inverseMessengerUpdateDlg");
				var button = dialog.getButton("accept");
				button.disabled = false;
				var image = document.getElementById("spinner");
				image.collapsed = true;
				var restartMessage = document.getElementById("restartMessage");
				var message = document.getElementById("message");
				var maxChild = message.childNodes.length;
				for (var i = maxChild - 1; i > -1; i--)
					message.removeChild(message.childNodes[i]);
				message.appendChild(document.createTextNode(restartMessage.value));
				logString("timeout.....\n");
				if (window.setTimeout)
					logString("has timeout.....\n");
				window.setTimeout(updateDialogOnReload, 3000);
				logString("timeout set");
			}
		}
	}
}

function getExtensionData(rdf, extensionRDFURL, extensionURN) {
	var extensionData = null;

	var updates = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#updates");

	try {
		dump("url: " + extensionRDFURL + "\n");
		var ds = rdf.GetDataSourceBlocking(extensionRDFURL);
		var urlNode = ds.GetTarget(extensionURN, updates, true);
		if (urlNode instanceof iCi.nsIRDFResource) {
			var targets = ds.ArcLabelsOut(urlNode);
			while (targets.hasMoreElements()) {
				var node = targets.getNext();
				if (node instanceof iCi.nsIRDFResource) {
					var nodeValue = ds.GetTarget(urlNode, node, true);
					if (nodeValue instanceof iCi.nsIRDFResource)
						extensionData = this.GetRDFUpdateData(rdf, ds, nodeValue);
				}
			}
		}
	}
	catch (e) {
		logString("getExtensionData: " + e);
	}

	return extensionData;
}

function GetRDFUpdateData(rdf, ds, node) {
// 	logString("getrdfupdatedata...\n");
	var updateData = { url: null, version: null };

	var extensionVersion = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#version");
	var targetApplication = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#targetApplication");
	var applicationId = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#id");
	var updateLink = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#updateLink");

	var version = ds.GetTarget(node, extensionVersion, true);
	if (version instanceof iCi.nsIRDFLiteral) {
		updateData.version = version.Value;
		var appNode = ds.GetTarget(node, targetApplication, true);
		if (appNode) {
			var appId = ds.GetTarget(appNode, applicationId, true);
			if (appId instanceof iCi.nsIRDFLiteral
					&& appId.Value == thunderbirdUID) {
				var updateLink = ds.GetTarget(appNode, updateLink, true);
				if (updateLink instanceof iCi.nsIRDFLiteral)
					updateData.url = updateLink.Value;
			}
		}
	}

	if (!(updateData.url && updateData.version))
		updateData = null;

	return updateData;
}

function onAcceptClick() {
	logString("onAcceptClick...\n");
	var appStartup = iCc["@mozilla.org/toolkit/app-startup;1"]
		.getService(iCi.nsIAppStartup);
	appStartup.quit(iCi.nsIAppStartup.eRestart
									| iCi.nsIAppStartup.eAttemptQuit);

	return false;
}

function onCancelClick() {
	logString("onCancelClick...\n");
	return false;
}

function updateDialogOnReload() {
	logString("Restarting...\n");
	var appStartup = iCc["@mozilla.org/toolkit/app-startup;1"]
		.getService(iCi.nsIAppStartup);
	appStartup.quit(iCi.nsIAppStartup.eRestart
									| iCi.nsIAppStartup.eForceQuit);
}

function updateDialogOnLoadReal () {
// 	logString("onRealLoad...\n");
	var dialog = document.getElementById("inverseMessengerUpdateDlg");
	var button = dialog.getButton("accept");
	button.disabled = true;
	shouldRestart = false;

	try {
// 		logString ("starting...");

		var extensions = this.getHandledExtensions();
		logString("extensions: " + extensions.length);
		var results = this.prepareRequiredExtensions(extensions);
		if ((results["urls"].length + results["uninstall"].length) > 0) {
			this.configurationDone = false;
			this.downloadsDone = false;
			this.uninstallDone = false;
			this.downloadMissingExtensions(results["urls"]);
			this.configureCurrentExtensions(results["configuration"]);
			this.uninstallCurrentExtensions(results["uninstall"]);
		}
		else {
			window.opener.checkSystemFolders();
			window.close();
		}
	}
	catch(e) {
		logString("updateDialogOnLoad: " + e);
		window.opener.checkSystemFolders();
		window.close();
	}
}

function updateDialogOnLoad () {
// 	logString("onLoad...\n");
	window.setTimeout(updateDialogOnLoadReal, 200);
}

// logString("we will load..\n");
window.addEventListener("load", updateDialogOnLoad, false);
