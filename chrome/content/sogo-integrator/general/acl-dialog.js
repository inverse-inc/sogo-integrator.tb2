/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("acl-dialog.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://inverse-library/content/sogoWebDAV.js"]);

var folderData = {
 url: null,
 defaultUserID: null,
 rolesDialogURL: null
};

function openRolesWindowForUser(userID) {
	var userName = "";
	var isDefault = (userID == folderData.defaultUserID);
	if (!isDefault) {
		var listItem = document.getElementById("item-" + userID);
		userName = listItem.label;
	}
	openDialog(folderData.rolesDialogURL, "roles", "dialog,titlebar,modal",
						 {user: userID, userName: userName,
								 isDefault: isDefault,
								 folderURL: folderData.url});
}

function openRolesWindowForUserNode(node) {
	var prefix = "item-";
	var fullID = node.getAttribute("id");
	if (fullID.indexOf(prefix) == 0)
		openRolesWindowForUser(fullID.substr(prefix.length));
}

function editSelectedEntry() {
	var userList = document.getElementById("userList");
	if (userList.selectedItem)
		openRolesWindowForUserNode(userList.selectedItem);
}

function editDefaultEntry() {
	if (folderData.defaultUserID)
		openRolesWindowForUser(folderData.defaultUserID);
}

function addEntry() {
	openDialog("chrome://sogo-integrator/content/general/subscription-dialog.xul",
						 "aclUserAdd",
						 "dialog,titlebar,modal");
}

function subscriptionDialogType() {
	return "users";
}

var aclQueryHandler = {
 onDAVQueryComplete: function(status, response, headers, data) {
// 		dump("request: " + data.rqType + "\n");
// 		dump("response: " + response + "\n");
		if (status > 199 && status < 300) {
			if (data.rqType == "user-list") {
				var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
					.createInstance(Components.interfaces.nsIDOMParser);
				var xmlResult = parser.parseFromString(response, "text/xml");
				var result = xmlResult.firstChild;
				for (var i = 0; i < result.childNodes.length; i++)
					_parseResultNode(result.childNodes[i]);
			
				if (folderData.defaultUserID) {
					var defaultRolesBtn = document.getElementById("defaultRolesBtn");
					defaultRolesBtn.collapsed = false;
				}
			}
			else if (data.rqType == "add-user") {
				_appendUserInList(data.node);
			}
			else if (data.rqType == "remove-user") {
				var node = document.getElementById(data.node);
				node.parentNode.removeChild(node);
			}
		}
		showThrobber(false);
	}
};

function deleteEntry() {
	var userList = document.getElementById("userList");
	if (userList.selectedItem) {
		var prefix = "item-";
		var fullID = userList.selectedItem.getAttribute("id");
		showThrobber(true);
		var postQuery = ('<acl-query'
										 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
										 + '<remove-user user="'
										 + fullID.substr(prefix.length) + '"/>'
										 + '</acl-query>');
		var post = new sogoWebDAV(folderData.url, aclQueryHandler,
															{rqType: "remove-user",
															 node: fullID});
		post.post(postQuery);
	}
}

function showThrobber(display) {
	var throbber = document.getElementById("throbber");
	var newClass = (display ? "visible" : "");
	throbber.setAttribute("class", newClass);
}

function onLoad() {
	var data = window.arguments[0];
	folderData.url = data.url;
	folderData.rolesDialogURL = data.rolesDialogURL;

	showThrobber(true);
	var reportQuery = ('<acl-query'
										 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
										 + '<user-list/>'
										 + '</acl-query>');
	var report = new sogoWebDAV(folderData.url, aclQueryHandler,
															{ rqType: "user-list" });
	report.report(reportQuery, false);
}

function _parseResultNode(node) {
	if (node.tagName == "default-user") {
		var idNode = node.firstChild.firstChild;
		folderData.defaultUserID = idNode.nodeValue;
	}
	else if (node.tagName == "user") {
		var user = {};
		for (var i = 0; i < node.childNodes.length; i++) {
			var key = node.childNodes[i].tagName;
// 			dump("key: " + key + "\n");
			var value = node.childNodes[i].firstChild.nodeValue;
// 			dump("value: " + value + "\n");
			user[key] = value;
		}
		_appendUserInList(user);
	}
	else
		dump("unknown tag '" + node.tagName + "\n");
}

function _appendUserInList(user) {
	var display = user.displayName;
	if (display) {
		var email = user.email;
		if (email)
			display += " <" + email + ">";
	}
	else
		display = user.email;

	var listItem = document.createElement("listitem");
	listItem.setAttribute("label", display);
	listItem.setAttribute("id", "item-" + user.id);
	listItem.setAttribute("class", "listitem-iconic");
	listItem.setAttribute("image",
												"chrome://messenger/skin/addressbook/icons/abcard.png");
	listItem.addEventListener("dblclick", onItemDblClick, false);

	var list = document.getElementById("userList");
	list.appendChild(listItem);

	return true;
}

function onItemDblClick(event) {
	openRolesWindowForUserNode(this);
}

function subscriptionAddUser(node) {
	var result;

	var existingNode = document.getElementById("item-" + node.id);
	if (!existingNode) {
		window.setTimeout(_deferredAddition, 20, node);
		result = true;
	}
	else
		result = false;

	return result;
}

function _deferredAddition(node) {
	showThrobber(true);
	var postQuery = ('<acl-query'
									 + ' xmlns="urn:inverse:params:xml:ns:inverse-dav">'
									 + '<add-user user="' + node.id + '"/>'
									 + '</acl-query>');
	var post = new sogoWebDAV(folderData.url, aclQueryHandler,
														{rqType: "add-user",
														 node: node});
	post.post(postQuery);
}

window.addEventListener("load", onLoad, false);
