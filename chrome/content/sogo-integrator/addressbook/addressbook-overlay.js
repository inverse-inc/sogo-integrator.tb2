/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("addressbook-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://sogo-integrator/content/addressbook/folder-handler.js",
					 "chrome://sogo-integrator/content/general/creation-utils.js",
					 "chrome://sogo-integrator/content/general/subscription-utils.js",
					 "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
					 "chrome://sogo-connector/content/addressbook/folder-handling.js"]);

function openAbCreationDialog() {
	openDialog("chrome://sogo-integrator/content/addressbook/creation-dialog.xul",
						 "addressbookCreate",
						 "dialog,titlebar,modal",
						 this);
}

function openAbSubscriptionDialog() {
	openDialog("chrome://sogo-integrator/content/general/subscription-dialog.xul",
						 "addressbookSubscribe",
						 "dialog,titlebar,modal",
						 this);
}

function openABACLDialog() {
	var dir = GetSelectedDirectory();
	var abDir = (Components.classes["@mozilla.org/rdf/rdf-service;1"]
							 .getService(Components.interfaces.nsIRDFService)
							 .GetResource(dir)
							 .QueryInterface(Components.interfaces.nsIAbDirectory));

	var groupdavPrefService = new GroupdavPreferenceService(abDir.dirPrefId);
	var url = groupdavPrefService.getURL();

	openDialog("chrome://sogo-integrator/content/general/acl-dialog.xul",
						 "addressbookACL",
						 "dialog,titlebar,modal",
						 {url: url,
								 rolesDialogURL: "chrome://sogo-integrator/content/addressbook/roles-dialog.xul"});
}

function openDeletePersonalDirectoryForbiddenDialog() {
	var strings = document.getElementById("bundle_integrator_addressbook");
	alert(strings.getString("deletePersonalABError"));
}

function openDeletePublicDirectoryForbiddenDialog() {
	var strings = document.getElementById("bundle_integrator_addressbook");
	alert(strings.getString("deletePublicABError"));
}

function onDeleteAbDirectory() {
	var dir = GetSelectedDirectory();
	if (isGroupdavDirectory(dir)) {
		var ab = SCGetDirectoryFromURI(dir);
		var prefs = new GroupdavPreferenceService(ab.dirPrefId);
		var url = prefs.getURL();
		var urlParts = url.split("/");
		if (url.indexOf(sogoBaseURL()) == 0
				&& urlParts[urlParts.length - 2] == "personal")
			openDeletePersonalDirectoryForbiddenDialog();
		else {
			if (SCAbConfirmDeleteDirectory(dir)) {
				var selectedDirectory = SCGetDirectoryFromURI(dir);
				var groupdavPrefService
					= new GroupdavPreferenceService(selectedDirectory.dirPrefId);
				var url = groupdavPrefService.getURL();
				if (url.indexOf(sogoBaseURL()) == 0) {
					var elements = url.split("/");
					var dirBase = elements[elements.length-2];
					var handler = new AddressbookHandler();
					if (dirBase.indexOf("_") == -1) {
						if (dirBase != 'personal') {
// 							dump("should delete folder: " + url+ "\n");
							deleteFolder(url, handler);
						}
					}
					else
						unsubscribeFromFolder(url, handler);
				}
				else
					SCDeleteDAVDirectory(dir);
			}
		}
	}
	else if (isCardDavDirectory(dir)) {
		var selectedDirectory = SCGetDirectoryFromURI(dir);
		var cardDavPrefix = "carddav://";
		var url = selectedDirectory.directoryProperties.URI.substr(cardDavPrefix.length);
		if (url.indexOf(sogoBaseURL()) == 0)
			openDeletePublicDirectoryForbiddenDialog();
		else
			SCAbDeleteDirectory();
	}
	else
		SCAbDeleteDirectory();
}

function SIDirPaneController() {
}

SIDirPaneController.prototype = {
 supportsCommand: function(command) {
		return (command == "cmd_SOGoACLS"
						|| command == "addressbook_delete_addressbook_command");
	},

 isCommandEnabled: function(command) {
		var result = false;
		
		if (command == "cmd_SOGoACLS") {
			var uri = GetSelectedDirectory();
			if (uri && isGroupdavDirectory(uri)) {
				var ab = SCGetDirectoryFromURI(uri);
				var prefs = new GroupdavPreferenceService(ab.dirPrefId);
				var dirURL = prefs.getURL();
				if (dirURL.indexOf(sogoBaseURL()) == 0) {
					var elements = dirURL.split("/");
					var dirBase = elements[elements.length-2];
					/* FIXME: we don't support usernames with underscores */
					result = (dirBase.indexOf("_") == -1);
				}
			}
		} else if (command == "addressbook_delete_addressbook_command") {
			var uri = GetSelectedDirectory();
			if (uri) {
				var cd;
				var url;
				var deleteMenuIsUnsubscribe = false;
				var ab = SCGetDirectoryFromURI(uri);
				if (isGroupdavDirectory(uri)) {
					var prefs = new GroupdavPreferenceService(ab.dirPrefId);
					url = prefs.getURL();
					cd = false;
				}
				else if (isCardDavDirectory(uri)) {
					var cardDavPrefix = "carddav://";
					url = ab.directoryProperties.URI.substr(cardDavPrefix.length);
					cd = true;
				}
				else
					result = true;

				if (!result) {
					if (url.indexOf(sogoBaseURL()) == 0) {
						if (!cd) {
							var urlParts = url.split("/");
							var dirBase = urlParts[urlParts.length - 2];
							if (dirBase != "personal") {
								result = true;
								deleteMenuIsUnsubscribe = (dirBase.indexOf("_") >= -1);
							}
						}
					}
					else
						result = true;
				}

				var deleteMenuItem
					= document.getElementById("dirTreeContext-delete");
				if (deleteMenuIsUnsubscribe) {
					deleteMenuItem.label
						= deleteMenuItem.getAttribute("unsubscribelabel");
				} else {
					deleteMenuItem.label = deleteMenuItem.getAttribute("deletelabel");
				}
			}
		}

		return result;
	},

 doCommand: function(command){},

 onEvent: function(event) {}
};

function subscriptionDialogType() {
	return "contact";
}

function subscriptionGetHandler() {
	return new AddressbookHandler();
}

window.creationGetHandler = subscriptionGetHandler;

function SISetupAbCommandUpdateHandlers(){
	var controller = new SIDirPaneController();

	dirTree = document.getElementById("dirTree");
	if (dirTree)
		dirTree.controllers.appendController(controller);
}

function SICommandUpdate_AddressBook() {
	this.SICommandUpdate_AddressBookOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateGlobalEditMenuItems() {
	this.SIGoUpdateGlobalEditMenuItemsOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateSelectEditMenuItems() {
	this.SIGoUpdateSelectEditMenuItemsOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIOnLoadHandler() {
	this.SICommandUpdate_AddressBookOld = this.CommandUpdate_AddressBook;
	this.CommandUpdate_AddressBook = this.SICommandUpdate_AddressBook;
	this.SIGoUpdateGlobalEditMenuItemsOld = this.goUpdateGlobalEditMenuItems;
	this.goUpdateGlobalEditMenuItems = 	this.SIGoUpdateGlobalEditMenuItems;
	this.SIGoUpdateSelectEditMenuItemsOld = this.goUpdateSelectEditMenuItems;
	this.goUpdateSelectEditMenuItems = this.SIGoUpdateSelectEditMenuItems;

	this.AbDeleteDirectory = this.onDeleteAbDirectory;

	SISetupAbCommandUpdateHandlers();
}

window.addEventListener("load", SIOnLoadHandler, false);
