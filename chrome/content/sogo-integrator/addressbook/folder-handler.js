/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("folder-handler.js: failed to include '" + files[i] + "'\n" + e +
					 "\nFile: " + e.fileName + 
					 "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
					 "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
					 "chrome://sogo-connector/content/general/vcards.utils.js",
					 "chrome://sogo-connector/content/common/common-dav.js"]);

function AddressbookHandler() {
	this.doubles = [];
}

AddressbookHandler.prototype = {
 doubles: null,
 getExistingDirectories: function() {
    var existing = {};

    var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
    .getService(Components.interfaces.nsIRDFService);
    var parentDir = rdfService.GetResource("moz-abdirectory://")
    .QueryInterface(Components.interfaces.nsIAbDirectory);
    var children = parentDir.childNodes;
    //   var done = false;
// 		dump("----------------- getexisting...\n");
    while (children.hasMoreElements()) {
      var ab = children.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
			var realAB = ab.QueryInterface(Components.interfaces.nsIAbDirectory);
			var abURL = null;
			if (isGroupdavDirectory(ab.Value)) {
				var service = new GroupdavPreferenceService(realAB.dirPrefId);
				abURL = service.getURL();
// 				dump("url: " + ab.Value + "\n");
// 				dump("existing: " + realAB.dirPrefId + " - " + abURL + "\n");
			}
			else if (isCardDavDirectory(ab.Value)) {
				var carddavPrefix = "carddav://";
				abURL = realAB.directoryProperties.URI.substr(carddavPrefix.length);
// 				dump("CARDDAV existing: " + realAB.dirPrefId + " - " + url + "\n");
			}
			if (abURL) {
				if (existing[abURL])
					this.doubles.push(ab);
				else
					existing[abURL] = realAB;
			}
    }

    return existing;
  },
 removeDoubles: function() {
// 		dump("doubles:  " + this.doubles.length + "\n");
		SCDeleteDirectories(this.doubles);
	},
 addDirectories: function(newDirs) {
    for (var i = 0; i < newDirs.length; i++) {
			var description = "" + newDirs[i]['displayName'];
			var url = newDirs[i]['url'];
      var readOnly = (newDirs[i]['owner'] == "nobody");
			if (readOnly)
				SCCreateCardDAVDirectory(description, url);
			else {
				var directory = SCCreateGroupDAVDirectory(description, url);
				var URI = directory.directoryProperties.URI;
				var synchronizer = new GroupDavSynchronizer(URI);
				synchronizer.start();
			}
    }
  },
 renameDirectories: function(dirs) {
    var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
		.getService(Components.interfaces.nsIRDFService);	
    var parentDir = rdfService.GetResource("moz-abdirectory://")
		.QueryInterface(Components.interfaces.nsIAbDirectory);

    for (var i = 0; i < dirs.length; i++) {
      var properties = dirs[i]['folder'].directoryProperties;
      var oldName = properties.description;
      var displayName = dirs[i]['displayName'];
      if (oldName != displayName) {
				properties.description = displayName;
				parentDir.modifyDirectory(dirs[i]['folder'], properties);
      }
    }
  },
 removeDirectories: function(oldDirs) {
//  		dump("removeDirectories: backtrace: " +  backtrace() + "\n\n\n");
    for (var i = 0; i < oldDirs.length; i++) {
			var oldDir =
      oldDirs[i].QueryInterface(Components.interfaces.nsIRDFResource);
			SCDeleteDAVDirectory(oldDir.Value);
		}
  },
 urlForParentDirectory: function() {
		return sogoBaseURL() + "Contacts";
	},
 ensurePersonalIsRemote: function() {
		this._ensureFolderIsRemote("abook.mab");
		var prefService = (Components.classes["@mozilla.org/preferences-service;1"]
											 .getService(Components.interfaces.nsIPrefBranch));
		if (this._autoCollectIsHistory(prefService))
			this._ensureHistoryIsPersonal(prefService);
		this._ensureFolderIsRemote("history.mab");
	},
 _ensureFolderIsRemote: function(filename) {
		var localURI = "moz-abmdbdirectory://" + filename;
		var localAB = SCGetDirectoryFromURI(localURI);
		if (localAB) {
			var personalURL = sogoBaseURL() + "Contacts/personal/";

			// 		dump("personalURL: " + personalURL + "\n");
			var existing = this.getExistingDirectories();
			var personalAB = existing[personalURL];

			if (!personalAB)
				personalAB = existing[personalURL.substr(0, personalURL.length - 1)];
			if (!personalAB) {
				var newDir = {url: personalURL,
											displayName: "personal",
											owner: sogoUserName()};
				this.addDirectories([newDir]);
				existing = this.getExistingDirectories();
				personalAB = existing[personalURL];
			}
			if (personalAB) {
				/* ugly hack, we empty the addressbook after its cards were
					 transfered, so that we can be sure the ab no longer "exists" */
				var cards = SCGetChildCards(localAB);
				if (cards.length > 0) {
					SCCopyAddressBook(localAB, personalAB);
					var cardsArray = Components.classes["@mozilla.org/supports-array;1"]
						.createInstance(Components.interfaces.nsISupportsArray);
					for (var i = 0; i < cards.length; i++)
						cardsArray.AppendElement(cards[i]);
					localAB.deleteCards(cardsArray);
				}
				SCDeleteDirectory(localAB);
			}
			else
				throw "Personal Addressbook cannot be replaced!";
		}
	},
 _autoCollectIsHistory: function(prefService) {
		var isHistory = false;
		try {
			var abURI = prefService.getCharPref("mail.collect_addressbook");
			isHistory = (abURI == "moz-abmdbdirectory://history.mab"
									 || abURI == "moz-abmdbdirectory://abook.mab");
		}
		catch(e) {
		}

		return isHistory;
	},
 _ensureHistoryIsPersonal: function(prefService) {
		var personalURL = sogoBaseURL() + "Contacts/personal/"
		var existing = this.getExistingDirectories();
		var personalAB = existing[personalURL]
		.QueryInterface(Components.interfaces.nsIRDFResource);
		var personalURI = personalAB.Value;
		prefService.setCharPref("mail.collect_addressbook", personalURI);
	},
 ensureAutoComplete: function() {
		var prefService = (Components.classes["@mozilla.org/preferences-service;1"]
											 .getService(Components.interfaces.nsIPrefBranch));
		var prefACURL;
		try {
			var prefACURLID = prefService.getCharPref("sogo-integrator.autocomplete.server.urlid");
			prefACURL = sogoBaseURL() + "Contacts/" + prefACURLID + "/";
		}
		catch(e) {
			prefACURL = null;
		}
		if (prefACURL) {
			dump("ac url: " + prefACURL + "\n");
			var existing = this.getExistingDirectories();
			var acAB = existing[prefACURL];
			if (!acAB) {
				var newDir = {url: prefACURL,
											displayName: "public",
											owner: "nobody"};
				this.addDirectories([newDir]);
				existing = this.getExistingDirectories();
				acAB = existing[prefACURL];
			}
			if (acAB) {
				var abPrefID = acAB.dirPrefId;
				prefService.setCharPref("ldap_2.autoComplete.directoryServer", abPrefID);
			}
			else
				dump("Could not set public directory as preferred autocomplete server\n");
		}
	}
};
