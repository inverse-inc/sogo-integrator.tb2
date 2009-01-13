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

function _creationTarget(handler, folderURL, displayName, target) {
	this.handler = handler;
	this.folderURL = folderURL;
	this.displayName = displayName;
	this.onDAVQueryComplete = this.onMkColQueryComplete;
	this.target = target;
}

_creationTarget.prototype = {
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
 onPropPatchQueryComplete: function(status, result) {
		if (status == 207) {
			for (var k in result) {
				if (this.folderURL.indexOf(k) > -1
						&& result[k][200]
						&& result[k][200]["displayname"])
					this.handler.addDirectories([{url: this.folderURL,
																				owner: sogoUserName(),
																				displayName: this.displayName}]);
			}
			if (this.target) {
				this.target.onCreationDone();
			}
		}
	}
};

function createFolder(displayName, handler, target) {
	var newURL = handler.urlForParentDirectory() + "/" + new UUID() + "/";
	var mkcol = new sogoWebDAV(newURL, new _creationTarget(handler,
																												 newURL,
																												 displayName,
																												 target));
	mkcol.mkcol();
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
