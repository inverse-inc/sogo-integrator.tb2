/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("subscription-dialog.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/general/subscription-utils.js"]);

var gSearchTimer = null;
var resourceType;

window.addEventListener("load", onSubscriptionDialog, false);

function onSubscriptionDialog() {
	resourceType = window.opener.subscriptionDialogType();
	var button = document.getElementById("addButton");
	button.addEventListener("click", onAddButtonClick, false);

	var tree = document.getElementById("subscriptionTree");
	tree.addEventListener("dblclick", onAddButtonClick, false);

	var searchInput = document.getElementById("searchInput");
	searchInput.addEventListener("focus", onSearchInputFocus, false);
	searchInput.inputField.addEventListener("blur", onSearchInputBlur, false);
	searchInput.addEventListener("click", onSearchInputFocus, false);
	searchInput.addEventListener("input", onSearchInputInput, false);
	searchInput.addEventListener("keypress", onSearchInputKeyPress, false);

	searchInput.showingSearchCriteria = false;
	searchInput.value = "";
	searchInput.select();
}

function onAddButtonClick(event) {
	var tree = document.getElementById("subscriptionTree");
	var node = tree.treeView.getSelectedNode();
	if (node) {
		if (resourceType == "users") {
			if (window.opener.subscriptionAddUser(node))
				window.setTimeout(close, 1);
		}
		else {
			var index = tree.treeView.getParentIndex(tree.treeView.selection.currentIndex);
			var name = node["displayName"] + " (" + tree.treeView.getCellText(index, 0) + ")";
			var folder = {url: node["href"],
										owner: node["owner"],
										displayName: name};
			if (window.opener.subscribeToFolder(folder))
				window.setTimeout(close, 30);
		}
	}
}

function onSearchInputBlur(event) {
	var searchInput = document.getElementById("searchInput");
	if (!("" + this.value).length)
		searchInput.showingSearchCriteria = true;
	if (searchInput.showingSearchCriteria)
		searchInput.setSearchCriteriaText();
}

function onSearchInputFocus(event) {
	if (this.showingSearchCriteria) {
		this.value = "";
		this.showingSearchCriteria = false;
	}

	this.select();
}

function onSearchInputInput(event) {
	// 	dump("this.showingSearchCriteria: " + this.showingSearchCriteria + "\n");
	if (!this.clean) {
		var tree = document.getElementById("subscriptionTree");
		tree.view = null;
		tree.setAttribute("searching", "none");
		this.clean = true;
	}

	if (gSearchTimer) {
		clearTimeout(gSearchTimer);
		gSearchTimer = null;
	}

	if (!(this.showingSearchCriteria || ("" + this.value) == ""))
		gSearchTimer = setTimeout(onStartSearch, 800);
}

function onSearchInputKeyPress(event) {
	if (event.keyCode == 13) {
		onStartSearch();
		event.preventDefault();
	}
}

function onClearSearch() {
	var searchInput = document.getElementById("searchInput");
	searchInput.value = "";
	searchInput.showingSearchCriteria = true;
	searchInput.clean = true;
	var tree = document.getElementById("subscriptionTree");
	tree.view = null;
	tree.setAttribute("searching", "none");
	if (gSearchTimer) {
		clearTimeout(gSearchTimer);
		gSearchTimer = null;
	}
}

var userReportTarget = {
 onDAVQueryComplete: function(status, result) {
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
		.createInstance(Components.interfaces.nsIDOMParser);
		var xmlResult = parser.parseFromString(result, "text/xml");
		var treeView;
		
		if (resourceType == "users")
			treeView = new UsersTreeView(xmlResult);
		else
			treeView = new SubscriptionTreeView(xmlResult, resourceType);
		var tree = document.getElementById("subscriptionTree");
		tree.view = treeView;
		tree.treeView = treeView;
		tree.setAttribute("searching", "done");

		var searchInput = document.getElementById("searchInput");
		searchInput.clean = false;
	}
};

var collectionReportTarget = {
 onDAVQueryComplete: function(status, result, headers, data) {
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
		.createInstance(Components.interfaces.nsIDOMParser);
		data.treeView.parseFolders(data.user, parser.parseFromString(result, "text/xml"));
		var tree = document.getElementById("subscriptionTree");
		tree.view = data.treeView;
		tree.treeView = data.treeView;
	}
};

function onStartSearch() {
	var searchInput = document.getElementById("searchInput");

	var query = ("<user-query"
						 + " xmlns=\"urn:inverse:params:xml:ns:inverse-dav\">"
						 + "<users match-name=\""
						 + xmlEscape(searchInput.value)
						 + "\"/>"
						 + "</user-query>");
	var report = new sogoWebDAV(sogoBaseURL(), userReportTarget);
	report.report("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
								+ query, false);
}

function SubscriptionTreeView(queryResult, type) {
	this.data = [];
	this.type = type;
	if (queryResult)
		this.parseUsers(queryResult.getElementsByTagName("users"));
// 	if (queryResult)
// 		this.parseTree(queryResult.getElementsByTagName("response"));
}

SubscriptionTreeView.prototype = {
 rowCount: 0,
 selection: 0,
 tree: null,

 images: {"calendar": "chrome://sogo-integrator/skin/calendar-folder.png",
					"contact": "chrome://sogo-integrator/skin/addressbook-folder.png"},
 parseTree: function(queryResults) {
		for (var i = 0; i < queryResults.length; i++) {
			var node = queryResults[i];
			this._parseTreeNodes(node.childNodes);
		}

		this._recount();
	},
 _parseTreeNodes: function(nodes) {
		var treeNode = {};
		var owner;

		for (var i = 0; i < nodes.length; i++) {
			var currentNode = nodes[i];
			var value = "";
			for (var j = 0; j < currentNode.childNodes.length; j++)
				value += currentNode.childNodes[j].nodeValue;
			// 				dump(currentNode.localName + ": " + value + "\n");
			if (currentNode.localName == "owner")
				owner = value;
			else
				treeNode[currentNode.localName] = value;
		}
		// 			dump("owner:  " + owner + "\n");
		var ownerNodes = this.data[owner];
		if (ownerNodes)
			ownerNodes.push(treeNode);
		else {
			this.data[owner] = [treeNode];
			this.data[owner].open = false;
		}
	},

 parseUsers: function(queryResults) {
		if (queryResults.length)
			this._parseUsersNodes(queryResults[0].childNodes);
	},
 _parseUsersNodes: function(nodes) {
		for (var i = 0; i < nodes.length; i++) {
			var currentNode = nodes[i];
			var nodeDict = {};
			for (var j = 0; j < currentNode.childNodes.length; j++) {
				var subnode = currentNode.childNodes[j];
				var key = subnode.nodeName;
				var value = subnode.firstChild.nodeValue;
				nodeDict[key] = value;
			}
			dump("pushing: " + nodeDict["id"] + "\n");
			this.data.push(nodeDict);
		}
		this.rowCount = this.data.length;
	},

 parseFolders: function(user, queryResult) {
		var userData = null;
		for (var i = 0; userData == null && i < this.data.length; i++) {
			if (this.data[i].id == user)
				userData = this.data[i];
		}

		var responses = queryResult.getElementsByTagName("response")
		if (responses.length) {
			userData.hasFolders = true;
			userData.folders = [];
			for (var i = 0; i < responses.length; i++) {
				var response = responses[i];
				var href = response.getElementsByTagName("href")[0].childNodes[0].nodeValue;
				var displayName = response.getElementsByTagName("displayname")[0].childNodes[0].nodeValue;
				var parenIndex = displayName.indexOf(" (");
				if (parenIndex > -1) {
					displayName = displayName.substr(0, parenIndex);
				}
				var folder = { href: href,
											 owner: user,
											 displayName: displayName };
				userData.folders.push(folder);
			}
			this._recount();
		}
		else {
			userData.hasNoFolders = true;
		}
	},

 _recount: function() {
		var count = 0;
		for (var userCount = 0; userCount < this.data.length; userCount++) {
			var userData = this.data[userCount];
			count++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					count += userData.folders.length;
				}
				else {
					count++;
				}
			}
		}

		this.rowCount = count;
	},

 canDrop: function(rowIndex, orientation) {
		dump("canDrop\n");
		return false;
	},
 cycleCell: function(rowIndex, col) {
		dump("cycleCell\n");
	},
 cycleHeader: function(col) {
		dump("cycleHeader\n");
	},
 drop: function(rowIndex, orientation) {
		dump("drop\n");
	},
 getCellProperties: function(rowIndex, col, properties) {
		var rows = [];
		var i = 0;
		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			rows[i] = ["userNode"];
			i++;
			if (userData.nodeOpen) {
				rows[i-1].push("open");
// 				dump("user node " + (i - 1) + " marked open\n");
				if (userData.hasFolders) {
					for (var folderCount = 0;
							 folderCount < userData.folders.length;
							 folderCount++) {
						rows[i] = ["folderNode"];
						i++;
					}
				}
				else {
 					rows[i] = ["messageNode"];
					i++;
				}
			}
		}

		var svc = Components.classes["@mozilla.org/atom-service;1"]
		.getService(Components.interfaces.nsIAtomService);
		var props = rows[rowIndex];
		for (var i = 0; i < props.length; i++)
			properties.AppendElement(svc.getAtom(props[i]));
	},
 getCellText: function(rowIndex, col) {
		var strings = document.getElementById("subscription-dialog-strings");

		var rows = [];
		var i = 0;
		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			var userRow = (userData["displayName"] + " <"
										 + userData["email"] + ">");
			if (userData["info"] && userData["info"].length) {
				userRow += ", " + userData["info"];
			}
			rows[i] = userRow;
			i++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					for (var folderCount = 0;
							 folderCount < userData.folders.length;
							 folderCount++) {
						rows[i] = userData.folders[folderCount]["displayName"];
						i++;
					}
				}
				else if (userData.hasNoFolders) {
					rows[i] = strings.getString("No possible subscription");
					i++;
					}
				else {
					rows[i] = strings.getString("Please wait...");
					i++;
				}
			}
		}

		return rows[rowIndex];
	},
 getCellValue: function(rowIndex, col) {
		// 		dump("getCellValue\n");
		return 0;
	},
 getColumnProperties: function(col, properties) {
		// 		dump("getColumProperties\n");
	},
 getImageSrc: function(rowIndex, col) {
		var rows = [];

		var i = 0;
		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			rows[i] = "chrome://messenger/skin/addressbook/icons/abcard.png";
			i++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					for (var folderCount = 0;
							 folderCount < userData.folders.length;
							 folderCount++) {
							rows[i] = this.images[this.type];
							i++;
					}
				}
				else if (userData.hasNoFolders) {
					rows[i] = "null";
				}
				else {
					rows[i] = "chrome://global/skin/throbber/Throbber-small.gif";
					i++;
				}
			}
		}

		return rows[rowIndex];
	},
 getLevel: function(rowIndex) {
		var rows = [];

		var i = 0;
		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			rows[i] = 0;
			i++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					for (var folderCount = 0;
							 folderCount < userData.folders.length;
							 folderCount++) {
						rows[i] = 1;
						i++;
					}
				}
				else {
					rows[i] = 1;
					i++;
				}
			}
		}

		return rows[rowIndex];
	},
 getParentIndex: function(rowIndex) {
		var rows = [];

		var i = 0;
 		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			rows[i] = -1;
			var parentIndex = i;
			i++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					for (var j = 0; j < userData.folders.length; j++) {
						rows[i] = parentIndex;
						i++;
					}
				}
				else {
					rows[i] = parentIndex;
					i++;
				}
			}
		}

		// 		dump("getParentIndex: " + rows[index] + "\n");
		return rows[rowIndex];
	},
 getProgressMode: function(rowIndex, col) {
		dump("getPRogressMode\n");
	},
 getRowProperties: function(rowIndex, properties) {
		// 		dump("getRowProperties: " + properties.Count() + "\n");
		// 		dump("  index: " + index + "\n");
		// 		properties[0] = "selected";
	},
 hasNextSibling: function(rowIndex, afterIndex) {
		var rows = new Array();
		var i = 0;
 		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			rows[i] = true;
			i++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					for (var folderCount = 1;
							 folderCount < userData.folders.length;
							 folderCount++) {
						rows[i] = true;
						i++;
					}
					rows[i] = false;
				}
				else {
					rows[i] = false;
				}
				i++;
			}
		}

		return rows[rowIndex];
	},
 isContainer: function(rowIndex) {
		var rows = new Array();
		var i = 0;
 		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			rows[i] = true;
			i++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					for (var folderCount = 0;
							 folderCount < userData.folders.length;
							 folderCount++) {
						rows[i] = false;
						i++;
					}
				}
				else {
					rows[i] = false;
					i++;
				}
			}
		}

		return rows[rowIndex];
	},
 isContainerEmpty: function(rowIndex) {
		return false;
	},
 isContainerOpen: function(rowIndex) {
		var rows = [];

		var i = 0;
 		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			rows[i] = userData.nodeOpen;
			i++;
			if (userData.nodeOpen) {
				if (userData.hasFolders) {
					for (var folderCount = 0;
							 folderCount < userData.folders.length;
							 folderCount++) {
						rows[i] = false;
						i++;
					}
				}
				else {
					rows[i] = false;
					i++;
				}
			}
		}

		return rows[rowIndex];
	},
 isEditable: function(rowIndex, col) {
		return false;
	},
 isSeparator: function(rowIndex) {
		return false;
	},
 isSorted: function() {
		// 		dump("isSorted\n");
		return true;
	},
 performAction: function(action) {
		dump("performAction\n");
	},
 performActionOnCell: function(action, row, col) {
		dump("performActionOnCell\n");
	},
 performActionOnRow: function(action, row) {
		dump("performActionOnRow\n");
	},
 selectionChanged: function() {
		dump("selectionChanged: " + this.selection + "\n");
	},
 setCellText: function(rowIndex, col, value) {
		dump("setCellText\n");
	},
 setCellValue: function(rowIndex, col, value) {
		dump("setCellValue\n");
	},
 setTree: function(tree) {
		this.tree = tree;
	},
 toggleOpenState: function(rowIndex) {
 		this.tree.beginUpdateBatch();

		dump("toggle: " + rowIndex + "\n");
		var i = 0;
 		for (var userCount = 0;
				 i <= rowIndex && userCount < this.data.length;
				 userCount++) {
			var userData = this.data[userCount];
			var toggled = false;
			// FIXME: add code to load folder list...
			if (rowIndex == i) {
				userData.nodeOpen = !userData.nodeOpen;
				toggled = true;
				dump("toggled: " + userCount + " -> " + userData.nodeOpen + "\n");

				if (!(userData.hasFolders || userData.hasNoFolders)) {
					var principalArray = sogoBaseURL().split("/");
					principalArray[principalArray.length - 2] = userData["id"];
					var principal = principalArray.join("/");
					var query = ("<collection-query"
											 + " xmlns=\"urn:inverse:params:xml:ns:inverse-dav\""
											 +" xmlns:D=\"DAV:\">"
											 + "<D:prop><D:href/><D:owner/><ownerdisplayname/>"
											 + "<D:displayname/></D:prop><filter><collection-filter>"
											 + "<prop-match name=\"resource-type\">" + resourceType
											 + "</prop-match></filter>"
											 + "</collection-query>");
					var report = new sogoWebDAV(principal, collectionReportTarget,
																			{ treeView: this, user: userData["id"] });
					report.report("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
												+ query, false);
				}
			}
			i++;
			if (userData.nodeOpen && !toggled) {
				if (userData.hasFolders) {
					i += userData.folders.length;
				}
				else {
					i++;
				}
			}
		}

 		this._recount();
 		this.tree.endUpdateBatch();
	},
 getSelectedNode: function() {
 		if (this.selection) {
			var rows = [];

			var i = 0;
			for (var userCount = 0;
					 i <= this.selection.currentIndex
						 && userCount < this.data.length;
					 userCount++) {
				var userData = this.data[userCount];
				rows[i] = {};
				i++;
				if (userData.nodeOpen) {
					if (userData.hasFolders) {
						for (var folderCount = 0;
								 folderCount < userData.folders.length;
								 folderCount++) {
							rows[i] = userData.folders[folderCount];
							i++;
						}
					}
					else {
						rows[i] = {};
						i++;
					}
				}
			}
			
			node = rows[this.selection.currentIndex];
		}
		else {
			node = {};
		}
		
		return node;
	}
};

function UsersTreeView(queryResult) {
	this.data = [];
	if (queryResult)
		this.parseTree(queryResult.getElementsByTagName("users"));
}

UsersTreeView.prototype = {
 data: null,
 rowCount: 0,
 selection: 0,
 tree: null,

 parseTree: function(queryResults) {
		if (queryResults.length)
			this._parseTreeNodes(queryResults[0].childNodes);
	},
 _parseTreeNodes: function(nodes) {
		for (var i = 0; i < nodes.length; i++) {
			var currentNode = nodes[i];
			var nodeDict = {};
			for (var j = 0; j < currentNode.childNodes.length; j++) {
				var subnode = currentNode.childNodes[j];
				var key = subnode.nodeName;
				var value = subnode.firstChild.nodeValue;
				nodeDict[key] = value;
			}
			dump("pushing: " + nodeDict["id"] + "\n");
			this.data.push(nodeDict);
		}
		this.rowCount = this.data.length;
	},

 canDrop: function(rowIndex, orientation) {
		return false;
	},
 cycleCell: function(rowIndex, col) {
	},
 cycleHeader: function(col) {
	},
 drop: function(rowIndex, orientation) {
	},
 getCellProperties: function(rowIndex, col, properties) {
	},
 getCellText: function(rowIndex, col) {
		var infoText = "";
		if (this.data[rowIndex]["info"]
				&& this.data[rowIndex]["info"].length) {
			infoText = ", " + this.data[rowIndex]["info"];
		}
		return (this.data[rowIndex]["displayName"]
						+ " <" + this.data[rowIndex]["email"] + ">"
						+ infoText);
	},
 getCellValue: function(rowIndex, col) {
		return this.data[rowIndex]["id"];
	},
 getColumnProperties: function(col, properties) {
	},
 getImageSrc: function(rowIndex, col) {
		return "chrome://messenger/skin/addressbook/icons/abcard.png";
	},
 getLevel: function(rowIndex) {
		return 0;
	},
 getParentIndex: function(rowIndex) {
		return -1;
	},
 getProgressMode: function(rowIndex, col) {
	},
 getRowProperties: function(rowIndex, properties) {
	},
 hasNextSibling: function(rowIndex, afterIndex) {
		return false;
	},
 isContainer: function(rowIndex) {
		return false;
	},
 isContainerEmpty: function(rowIndex) {
		return true;
	},
 isContainerOpen: function(rowIndex) {
		return false;
	},
 isEditable: function(rowIndex, col) {
		return false;
	},
 isSeparator: function(rowIndex) {
		return false;
	},
 isSorted: function() {
		// 		dump("isSorted\n");
		return true;
	},
 performAction: function(action) {
		dump("performAction\n");
	},
 performActionOnCell: function(action, row, col) {
		dump("performActionOnCell\n");
	},
 performActionOnRow: function(action, row) {
		dump("performActionOnRow\n");
	},
 selectionChanged: function() {
		dump("selectionChanged: " + this.selection + "\n");
	},
 setCellText: function(rowIndex, col, value) {
		dump("setCellText\n");
	},
 setCellValue: function(rowIndex, col, value) {
		dump("setCellValue\n");
	},
 setTree: function(tree) {
		this.tree = tree;
	},
 toggleOpenState: function(rowIndex) {
		dump("toggle open state " + index + "\n");
	},
 getSelectedNode: function() {
		var node = null;
		if (this.selection) {
			var index = this.selection.currentIndex;
			node = this.data[index];
		}

		return node;
	}
};
