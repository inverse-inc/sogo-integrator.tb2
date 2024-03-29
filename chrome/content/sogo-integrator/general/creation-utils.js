/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("creation-utils.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://inverse-library/content/sogoWebDAV.js",
					 "chrome://inverse-library/content/uuid.js"]);

function createOperation(folderURL, displayName, handler) {
	this.folderURL = folderURL;
	this.displayName = displayName;
	this.handler = handler;
}

createOperation.prototype = {
 start: function cO_start() {
		this.onDAVQueryComplete = this.onMkColQueryComplete;
		var mkcol = new sogoWebDAV(this.folderURL, this);
		mkcol.mkcol();
	},

 onDAVQueryComplete: null,
 onMkColQueryComplete: function(status, result) {
		if (status == 201) {
			this.onDAVQueryComplete = this.onPropPatchQueryComplete;
			var proppatch = new sogoWebDAV(this.folderURL, this);
			proppatch.proppatch("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
													+ "<propertyupdate xmlns=\"DAV:\">"
													+ "<set>"
													+ "<prop><displayname>" + this.displayName + "</displayname>"
													+ "</prop></set></propertyupdate>");
		}
	},
 onPropPatchQueryComplete: function(status, jsonResult) {
		if (status == 207) {
			var responses = jsonResult["multistatus"][0]["response"];
			for each (var response in responses) {
				var url = response["href"][0];
				if (this.folderURL.indexOf(url) > -1) {
					for each (var propstat in response["propstat"]) {
						if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
							if (propstat["prop"][0]["displayname"]) {
								var newFolder = {url: this.folderURL,
																 owner: sogoUserName(),
																 displayName: this.displayName};
								this.handler.addDirectories([newFolder]);
							}
						}
					}
				}
			}
		}
	}
};

function createFolder(displayName, handler) {
	window.setTimeout(_realCreateFolder, 100, displayName, handler);
}

function _realCreateFolder(displayName, handler) {
	var newURL = handler.urlForParentDirectory() + "/" + new UUID() + "/";
	var creation = new createOperation(newURL, displayName, handler);
	creation.start();
}

function deleteFolder(nodeURL, handler) {
	dump("deleteFolder: " + nodeURL + "\n");
	var existingFolder = null;
  var existing = handler.getExistingDirectories();
	for (var url in existing) {
		var oldURL = url;
		if (url[url.length - 1] != '/')
			url = url.concat('/');
		if (url == nodeURL) {
			existingFolder = existing[oldURL];
			break;
		}
	}

	if (existingFolder) {
// 		dump("found existing\n");
		var target = {};
		target.onDAVQueryComplete = function(status, result) {
// 			dump("onDavQueryComplette...." + status + "\n");
			if ((status > 199 && status < 400)
					|| status == 404)
				handler.removeDirectories([existingFolder]);
		};

		var deleteOP = new sogoWebDAV(nodeURL, target);
		deleteOP.delete();
	}
	else
		dump("not existing?!\n");
}
