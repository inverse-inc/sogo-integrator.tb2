/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

function jsInclude(files, target) {
    var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (var i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("folders-updates.js: failed to include '" + files[i] + "'\n" + e +
                 "\nFile: " + e.fileName + 
                 "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
        }
    }
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://sogo-connector/content/general/mozilla.utils.inverse.ca.js",
					 "chrome://inverse-library/content/sogoWebDAV.js",
					 "chrome://sogo-integrator/content/addressbook/folder-handler.js",
					 "chrome://sogo-integrator/content/calendar/folder-handler.js"]);

function GetDirectoryFromURI(uri) {
    var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                     .getService(Components.interfaces.nsIRDFService);

    return rdfService.GetResource(uri).QueryInterface(Components.interfaces.nsIAbDirectory);
}

function directoryChecker(type, handler) {
    this.type = type;
    this.handler = handler;
    this.additionalProperties = null;
}

directoryChecker.prototype = {
 additionalProperties: null,
 baseURL: sogoBaseURL(),
 _checkHTTPAvailability: function checkAvailability() {
        var available;

        try {
            var xmlRequest = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                                       .createInstance(Components.interfaces.nsIXMLHttpRequest);
            xmlRequest.open("OPTIONS", this.baseURL + this.type, false);
            xmlRequest.send("");
            available = (xmlRequest.status != 404);
        }
        catch(e) {
            available = true;
        }

        return available;
    },
 checkAvailability: function checkAvailability() {
        var manager = Components.classes['@inverse.ca/context-manager;1']
                                .getService(Components.interfaces.inverseIJSContextManager).wrappedJSObject;
        var context = manager.getContext("inverse.ca/folders-update");
        if (!context.availability)
            context.availability = {};
        var available = context.availability[this.type];
        if (typeof (available) == "undefined") {
            available = this._checkHTTPAvailability();
            context.availability[this.type] = available;
        }

        return available;
    },
 start: function start() {
        var propfind = new sogoWebDAV(this.baseURL + this.type, this);
        var baseProperties = ["DAV: owner", "DAV: displayname"];
        var properties;
        if (this.handler.additionalDAVProperties) {
            this.additionalProperties = this.handler.additionalDAVProperties();
            properties = baseProperties.concat(this.additionalProperties);
        }
        else
            properties = baseProperties;
        propfind.propfind(properties);
    },
 removeAllExisting: function removeAllExisting() {
        var existing = this.handler.getExistingDirectories();
        var remove = [];
        for (var k in existing)
            remove.push(existing[k]);
        this.handler.removeDirectories(remove);
    },
 fixedExisting: function fixedExisting(oldExisting) {
        var newExisting = {};

        var length = this.baseURL.length;
        for (var url in oldExisting) {
            if (url.substr(0, length) == this.baseURL) {
                var oldURL = url;
                if (url[url.length - 1] != '/')
                    url = url.concat('/');
                newExisting[url] = oldExisting[oldURL];
            }
        }

        return newExisting;
    },
 _fixedOwner: function _fixedOwner(firstOwner) {
        var ownerArray = firstOwner.split("/");
        var ownerIdx = (ownerArray.length
                        - ((firstOwner[firstOwner.length-1] == "/") ? 2 : 1));

        return ownerArray[ownerIdx];
    },
 _fixedURL: function _fixedURL(firstURL) {
        var fixedURL;

        if (firstURL[0] == "/") {
            var baseURLArray = sogoBaseURL().split("/");
            fixedURL = baseURLArray[0] + "//" + baseURLArray[2] + firstURL;
        }
        else
            fixedURL = firstURL;

        if (fixedURL[fixedURL.length - 1] != '/')
            fixedURL = fixedURL.concat('/');

        // 		if (firstURL != fixedURL)
        // 			dump("fixed url: " + fixedURL + "\n");

        return fixedURL;
    },
 foldersFromResponse: function foldersFromResponse(jsonResponse) {
        var folders = {};
        var username = sogoUserName();

        var responses = jsonResponse["multistatus"][0]["response"];
        for (var i = 0; i < responses.length; i++) {
            var url = this._fixedURL(responses[i]["href"][0]);
            var propstats = responses[i]["propstat"];
            for (var j = 0; j < propstats.length; j++) {
                if (propstats[j]["status"][0].indexOf("HTTP/1.1 200") == 0) {
                    var urlArray = url.split("/");
                    if (urlArray[urlArray.length-3] == this.type) {
                        var prop = propstats[j]["prop"][0];
                        var owner = this._fixedOwner("" + prop["owner"][0]["href"][0]);
                        var additionalProps = [];

                        if (this.additionalProperties) {
                            for (var k = 0; k < this.additionalProperties.length; k++) {
                                var pName = this.additionalProperties[k].split(" ")[1];

                                var newValue;
                                if (prop[pName])
                                    newValue = xmlUnescape(prop[pName][0]);
                                else
                                    newValue = null;

                                additionalProps.push(newValue);
                            }
                        }
                        var newEntry = {owner: owner,
                                        displayName: xmlUnescape(prop["displayname"][0]),
                                        url: url,
                                        additional: additionalProps};
                        folders[url] = newEntry;
                    }
                }
            }
        }

        return folders;
    },
 onDAVQueryComplete: function onDAVQueryComplete(status, response) {
        // dump("status: " + status + "\n");
        if (status > 199 && status < 400) {
            var existing
            = this.fixedExisting(this.handler.getExistingDirectories());
            this.handler.removeDoubles();
            var folders = this.foldersFromResponse(response);
            var comparison = this.compareDirectories(existing, folders);
            if (comparison['removed'].length)
                this.handler.removeDirectories(comparison['removed']);
            if (comparison['renamed'].length)
                this.handler.renameDirectories(comparison['renamed']);
            if (comparison['added'].length)
                this.handler.addDirectories(comparison['added']);
        }
        else
            dump("the status code (" + status + ") was not acceptable, we therefore do nothing\n");
    },
 compareDirectories: function compareDirectories(existing, result) {
        var comparison = { removed: [], renamed: [], added: [] };
        for (var url in result) {
            if (url[url.length - 1] != '/')
                url = url.concat('/');
            if (!existing.hasOwnProperty(url)) {
                dump(result[url] + "; " + url + " registered for addition\n");
                comparison['added'].push(result[url]);
            }
        }
        for (var url in existing) {
            if (url[url.length - 1] != '/')
                url = url.concat('/');
            if (result.hasOwnProperty(url)) {
                dump(result[url] + "; " + url + " registered for renaming\n");
                comparison['renamed'].push({folder: existing[url],
                            displayName: result[url]['displayName'],
                            additional: result[url].additional});
            }
            else {
                dump(result[url] + "; " + url + " registered for removal\n");
                comparison['removed'].push(existing[url]);
            }
        }

        return comparison;
    }
};

function checkFolders() {
    var proceed = true;

    var gExtensionManager =
        Components.classes["@mozilla.org/extensions/manager;1"]
        .getService(Components.interfaces.nsIExtensionManager);
    var connectorItem = gExtensionManager
        .getItemForID("sogo-connector@inverse.ca");
    var lightningItem = gExtensionManager
        .getItemForID("{e2fda1a4-762b-4020-b5ad-a41df1933103}");
    if (connectorItem && lightningItem
        && checkExtensionVersion(connectorItem.version, "0.9")
        && (checkExtensionVersion(lightningItem.version, "0.9"))) {
        var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                     .getService(Components.interfaces.mozIJSSubScriptLoader);
        try {
            loader.loadSubScript("chrome://sogo-connector/content/general/sync.addressbook.groupdav.js");
        }
        catch (e) {
            proceed = false;
        }

        if (proceed) {
            /* sogo-connector is recent enough for a clean synchronization,
               otherwise, missing messy symbols will cause exceptions to be
               thrown */

            cleanupAddressBooks();
            var handler = new AddressbookHandler();
            var ABChecker = new directoryChecker("Contacts", handler);
            if (ABChecker.checkAvailability()) {
                ABChecker.start();
                handler.ensurePersonalIsRemote();
                handler.ensureAutoComplete();
                startFolderSync();
            }

            try {
                handler = new CalendarHandler();
            }
            catch(e) {
                // if lightning is not installed, an exception will be thrown so we
                // need to catch it to keep the synchronization process alive
                handler = null;
            }
            if (handler) {
                var CalendarChecker = new directoryChecker("Calendar", handler);
                if (CalendarChecker.checkAvailability()) {
                    if (document) {
                        var toolbar = document.getElementById("subscriptionToolbar");
                        if (toolbar)
                            toolbar.collapsed = false;
                    }
                    var prefService = (Components.classes["@mozilla.org/preferences-service;1"]
                                       .getService(Components.interfaces.nsIPrefBranch));
                    var disableCalendaring;
                    try {
                        disableCalendaring
                            = prefService.getBoolPref("sogo-integrator.disable-calendaring");
                    }
                    catch(e) {
                        disableCalendaring = false;
                    }
                    if (disableCalendaring) {
                        CalendarChecker.removeAllExisting();
                        hideLightningWidgets("true");
                    }
                    else {
                        handler.removeHomeCalendar();
                        CalendarChecker.start();
                        hideLightningWidgets("false");
                    }
                }
            }
        }
    } else {
        var console = Components.classes["@mozilla.org/consoleservice;1"]
                      .getService(Components.interfaces.nsIConsoleService);
        console.logStringMessage("You must use at least SOGo Connector 0.9 and Mozilla Lightning 0.9 with this version of SOGo Connector.");
    }
}

function hideLightningWidgets(hide) {
    var widgets = [ "mode-toolbar", "today-splitter", "today-pane-panel",
                    "ltnNewEvent", "ltnNewTask", "ltnNewCalendar",
                    "ltnMenu_calendar", "ltnMenu_tasks", "invitations-pane" ];
    for each (var name in widgets) {
        var widget = document.getElementById(name);
        if (widget) {
            if (hide == "true") {
                widget.removeAttribute("persist");
                widget.removeAttribute("command");
                widget.removeAttribute("name");
            }
            widget.setAttribute("collapsed", hide);
        }
        else
            dump("widget not found '" + name + "'\n");
    }
}
