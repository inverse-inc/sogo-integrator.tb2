/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

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

var iCc = Components.classes;
var iCi = Components.interfaces;
var thunderbirdUID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";

function checkExtensionsUpdate() {
    var extensions = getHandledExtensions();
    dump("number of handled extensions: " + extensions.length + "\n");
    var results = prepareRequiredExtensions(extensions);
    if (results["urls"].length + results["uninstall"].length > 0) {
        window.openDialog("chrome://sogo-integrator/content/messenger/update-dialog.xul",
                          "Extensions", "status=yes", results);
    } else {
        dump("  no available update for handled extensions\n");
        checkSystemFolders();
    }
}

function getHandledExtensions() {
    var handledExtensions = [];

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
                        // 						dump("name: " + extension.name + "\n");
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

    var gExtensionManager = iCc["@mozilla.org/extensions/manager;1"]
                            .getService(iCi.nsIExtensionManager);
    var preferences = Components.classes["@mozilla.org/preferences;1"]
                      .getService(Components.interfaces.nsIPref);
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                  .getService(Components.interfaces.nsIXULRuntime);

    var rdf = iCc["@mozilla.org/rdf/rdf-service;1"]
              .getService(iCi.nsIRDFService);

    for (var i = 0; i < extensions.length; i++) {
        var extensionItem = gExtensionManager.getItemForID(extensions[i].id);
        var extensionRDFURL = extensions.updateRDF
                              .replace("%ITEM_ID%", escape(extensions[i].id), "g")
                              .replace("%ITEM_VERSION%", "0.00", "g")
                              .replace("%PLATFORM%", escape(appInfo.OS + "_" + appInfo.XPCOMABI), "g");
        var extensionURN = rdf.GetResource("urn:mozilla:extension:"
                                           + extensions[i].id);
        var extensionData = getExtensionData(rdf,
                                             extensionRDFURL, extensionURN);
        if (extensionData) {
            // We check if we have to disable some extension that _is installed_
            // If so, let's do it right away
            if (extensionItem.name.length > 0
                && extensionData.version == "disabled") {
                uninstallExtensions.push(extensions[i].id);
            }
            else if ((!extensionItem.name
                      || extensionData.version != extensionItem.version)
                     && extensionData.version != "disabled") {
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
            dump("no data returned for '" + extensions[i].id + "'\n");
    }

    return {urls: extensionsURL,
            configuration: unconfiguredExtensions,
            uninstall: uninstallExtensions};
}

function getExtensionData(rdf, extensionRDFURL, extensionURN) {
    var extensionData = null;

    var updates = rdf.GetResource("http://www.mozilla.org/2004/em-rdf#updates");

    try {
        // dump("url: " + extensionRDFURL + "\n");
        var ds = rdf.GetDataSourceBlocking(extensionRDFURL);
        var urlNode = ds.GetTarget(extensionURN, updates, true);
        if (urlNode instanceof iCi.nsIRDFResource) {
            var targets = ds.ArcLabelsOut(urlNode);
            while (targets.hasMoreElements()) {
                var node = targets.getNext();
                if (node instanceof iCi.nsIRDFResource) {
                    var nodeValue = ds.GetTarget(urlNode, node, true);
                    if (nodeValue instanceof iCi.nsIRDFResource)
                        extensionData = GetRDFUpdateData(rdf, ds, nodeValue);
                }
            }
        }
    }
    catch (e) {
        dump("getExtensionData: " + e + "\n");
    }

    return extensionData;
}

function GetRDFUpdateData(rdf, ds, node) {
    // 	dump("getrdfupdatedata...\n");
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
        dump("no calendar available: checking extensions update right now.\n");
        checkExtensionsUpdate();
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
	for each (var calendar in calendars) {
      if (calendar.type == "caldav"
          && !calendar.getProperty("disabled")) {
          calDavCount++;
      }
  }

	dump("extensions/folder update starts after: " + calDavCount + " cals\n");

	if (calDavCount > 0) {
// composite observer
      var SICalStartupObserver = {
      counter: 0,
      maxCount: calDavCount,
      onLoad: function(calendar) {
              this.counter++;
              dump("counter: " + this.counter + "\n");
              if (this.counter >= this.maxCount) {
                  compCalendar.removeObserver(this);
                  dump("calendars loaded, now checking extensions\n");
                  checkExtensionsUpdate();
              }
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
    var i = 0;

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

    checkFolders();
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

// startup
window.addEventListener("load", sogoIntegratorStartupOverlayOnLoad, false);
