/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

var acceptedFromObserver = false;
var passwordObserver = null;

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("common-dialog-overlay.js: failed to include '" + files[i] + "'\n"
					 + e + "\nFile: " + e.fileName + 
					 "\nLine: " + e.lineNumber + "\n\n Stack:\n\n" + e.stack);
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js"]);

function SIPasswordObserver(dialog, field, checkbox) {
	this.dialog = dialog;
	this.field = field;
	this.checkbox = checkbox;
}

SIPasswordObserver.prototype = {
 dialog: null,
 field: null,
 checkbox: null,
 observe: function(subject, topic, data) {
		if (topic && topic == "sogo.password") {
			acceptedFromObserver = true;
			var password = data.substr(1);
			var checked = (data[0] == "1");
			this.field.password = password;
			this.checkbox.checked = checked;
			gCommonDialogParam.SetInt(1, checked);
			this.dialog.acceptDialog();
		}
	},
 QueryInterface: function(aIID) {
		if (!aIID.equals(Components.interfaces.nsIObserver)
				&& !aIID.equals(Components.interfaces.nsISupports))
			throw Components.results.NS_ERROR_NO_INTERFACE;

		return this;
	}
};

function _SIAuthenticationContext() {
	var contextMgr = Components.classes["@inverse.ca/context-manager;1"]
		.getService(Components.interfaces.nsISupports)
		.wrappedJSObject;
	return contextMgr.getContext("sogo-authentication");
}

function _SIGetDialogType() {
	var box = document.getElementById("info.box");
	var description = box.getElementsByTagName('description')[0];
	var text = description.textContent + "";

	var mailserver
		= Components.classes["@mozilla.org/messenger/account-manager;1"]
		.getService(Components.interfaces.nsIMsgAccountManager)
		.defaultAccount.incomingServer;
	var mailUserLogin = mailserver.realUsername + "@" + mailserver.realHostName;
	var serverBaseURLParts = sogoBaseURL().split("/");
	var serverBaseURL = serverBaseURLParts[0] + "//" + serverBaseURLParts[2];

	var dialogType;
	if (text.indexOf("SOGo") > -1 && text.indexOf(serverBaseURL) > -1)
		dialogType = "sogo";
	else if (text.indexOf(mailUserLogin) > -1)
		dialogType = "mail";
	else {
		dialogType = "none";
		/* pop3 dialogs */
		var indexUsername = text.indexOf(mailserver.realUsername);
		if (indexUsername > -1) {
			var indexServername = text.indexOf(mailserver.realHostName);
			if (indexServername > indexUsername)
				dialogType = "mail";
		}
	}

	return dialogType;
}

function _SISetTitles() {
	var label = document.getElementById("password1Label");
	label.setAttribute("collapsed", "true");
	var bundle = document.getElementById("SICDStrings");
	var box = document.getElementById("info.box");
	var description = box.getElementsByTagName('description')[0];

	document.title = bundle.getString("sogo.title");
	description.textContent = bundle.getString("sogo.description");
}

function SICommonDialogOnLoad() {
	window.SIOldCommonDialogOnLoad();

	/* This is pure evil and breaks the order of things! */
	var dialogType = _SIGetDialogType();
	if (dialogType != "none") {
		_SISetTitles();
		var context = _SIAuthenticationContext();
		var passwordField = document.getElementById("password1Textbox");
		var checkbox = document.getElementById("checkbox");

		var password;
		if (context.password) {
			password = context.password;
			checkbox.checked = context.checked;
			gCommonDialogParam.SetInt(1, context.checked);
		}
		else
			password = passwordField.value;

		if (dialogType == "sogo") {
			var loginContainer = document.getElementById("loginContainer");
			loginContainer.hidden = true;
			var username = document.getElementById("loginTextbox");
			username.value = sogoUserName();
		}

		if (!context.tries)
			context.tries = {};
		var tries = 1;
		if (context.tries[dialogType])
			tries += context.tries[dialogType];
		var dialog = document.getElementById("commonDialog");
		if (password == "" || tries > 1) {
			window.SIOldCommonDialogOnAccept = window.commonDialogOnAccept;
			window.commonDialogOnAccept = window.SICommonDialogOnAccept;
			passwordField.focus();
			passwordField.value = "";

			dialog.addEventListener("dialogcancel", SIOnDialogCancel, false);
			passwordObserver = new SIPasswordObserver(dialog, passwordField,
																								checkbox);
			var obsService = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
			obsService.addObserver(passwordObserver, "sogo.password", false);
		}
		else {
			context.tries[dialogType] = tries;
			passwordField.value = password;
			dialog.acceptDialog();
		}
	}
}

function SICommonDialogOnAccept() {
	var obsService = Components.classes["@mozilla.org/observer-service;1"]
		.getService(Components.interfaces.nsIObserverService);
	obsService.removeObserver(passwordObserver, "sogo.password");
	if (!acceptedFromObserver) {
		var passwordField = document.getElementById("password1Textbox");
		var password = passwordField.value + "";
		var context = _SIAuthenticationContext();
		context.password = password;
		var checkbox = document.getElementById("checkbox");
		var checked = checkbox.checked ? "1" : "0";
		context.checked = checked;

		var data = checked + password;
		obsService.notifyObservers(null, "sogo.password", data);
	}

	return window.SIOldCommonDialogOnAccept();
}

function SIOnDialogCancel(event) {
	var obsService = Components.classes["@mozilla.org/observer-service;1"]
		.getService(Components.interfaces.nsIObserverService);
	obsService.removeObserver(passwordObserver, "sogo.password");
}

window.SIOldCommonDialogOnLoad = window.commonDialogOnLoad;
window.commonDialogOnLoad = window.SICommonDialogOnLoad;
