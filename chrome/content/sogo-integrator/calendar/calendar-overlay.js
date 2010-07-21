/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("calendar-overlay.js: failed to include '" + files[i] + "'\n"
					 + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/calendar/folder-handler.js",
					 "chrome://sogo-integrator/content/general/creation-utils.js",
					 "chrome://sogo-integrator/content/general/subscription-utils.js"]);

function openCalendarCreationDialog() {
	openDialog("chrome://sogo-integrator/content/calendar/creation-dialog.xul",
						 "calendarSubscribe",
						 "dialog,titlebar,modal",
						 this);
}

function openCalendarSubcriptionDialog() {
	openDialog("chrome://sogo-integrator/content/general/subscription-dialog.xul",
						 "calendarSubscribe",
						 "dialog,titlebar,modal",
						 this);
}

function manageCalendarACL() {
	var calendar = getSelectedCalendar();
	var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
		.getService(Components.interfaces.nsISupports)
		.wrappedJSObject;
	var entry = aclMgr.calendarEntry(calendar.uri);
	
	if (entry.userIsOwner()) {
		var url = calendar.uri.spec;
		openDialog("chrome://sogo-integrator/content/general/acl-dialog.xul",
							 "calendarACL",
							 "dialog,titlebar,modal",
							 {url: url,
									 rolesDialogURL: "chrome://sogo-integrator/content/calendar/roles-dialog.xul"});
	} else {
		aclMgr.refresh(calendar.uri);
	}
}

function _confirmDelete(name) {
	var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);

	var bundle = document.getElementById("bundle_integrator_calendar");
 
	return promptService.confirm(window,
															 bundle.getString("deleteCalendarTitle"),
															 bundle.getString("deleteCalendarMessage"),
															 {});
}

function openDeletePersonalDirectoryForbiddenDialog() {
	var bundle = document.getElementById("bundle_integrator_calendar");
	alert(bundle.getString("deletePersonalCalendarError"));
}

function openCalendarUnsubcriptionDialog() {
	var calendar = getSelectedCalendar();

	var url = calendar.uri.spec;
	var baseURL = sogoBaseURL();
	if (url.indexOf(baseURL) == 0) {
		var parts = url.split("/");
		var offset = 1;
		if (url[url.length-1] == '/')
			offset++;
		var part = parts[parts.length-offset];
		var handler = new CalendarHandler();
		var mgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
			.getService(Components.interfaces.nsISupports)
			.wrappedJSObject;
		var entry = mgr.calendarEntry(calendar.uri);
		if (entry.userIsOwner()) {
			dump("url = " + url + " baseURL = " + baseURL + "\n");
			var urlParts = url.split("/");
			
			// We prevent the removal the "personal" calendar
			if (urlParts[urlParts.length-2] == "personal") {
				openDeletePersonalDirectoryForbiddenDialog();
			}
			else if (_confirmDelete(calendar.name)) {
				deleteFolder(url, handler);
			}
		}
		else
			unsubscribeFromFolder(url, handler);
	}
	else if (_confirmDelete(calendar.name)) {
		var calMgr = getCalendarManager();
		calMgr.unregisterCalendar(calendar);
		calMgr.deleteCalendar(calendar);

		var url = calendar.uri.spec;
		if (url[url.length - 1] != '/')
			url = url.concat('/');
	}
}

function subscriptionDialogType() {
	return "calendar";
}

function subscriptionGetHandler() {
	return new CalendarHandler();
}

function toggleShowAllCalendars() {
	var tree = document.getElementById("calendar-list-tree-widget");
			
	if (tree) {
		var composite = getCompositeCalendar();

		for (var i = 0; i < calendarListTreeView.rowCount; i++) {
			var calendar = calendarListTreeView.getCalendar(i);
			composite.addCalendar(calendar);
			calendarListTreeView.treebox.invalidateRow(i);
		}
	}
}

function toggleShowOnlyCalendar() {
	var tree = document.getElementById("calendar-list-tree-widget");
	if (tree) {
		var index = tree.currentIndex;

		var composite = getCompositeCalendar();
		for (var i = 0; i < calendarListTreeView.rowCount; i++) {
			if (i != index) {
				var calendar = calendarListTreeView.getCalendar(i);
				composite.removeCalendar(calendar.uri);
			}

			calendarListTreeView.treebox.invalidateRow(i);
		}

		var calendar = calendarListTreeView.getCalendar(index);
		composite.addCalendar(calendar);
		calendarListTreeView.treebox.invalidateRow(index);
	}
}

function toggleShowOnlyCalendarByCal(cal) {
	var composite = getCompositeCalendar();
	for (var i = 0; i < calendarListTreeView.rowCount; i++) {
		var calendar = calendarListTreeView.getCalendar(i);
		if (calendar.uri != cal.uri) {
			composite.removeCalendar(calendar.uri);
		}
	}

	composite.addCalendar(cal);
	for (var i = 0; i < calendarListTreeView.rowCount; i++) {
		calendarListTreeView.treebox.invalidateRow(i);
	}
}

var methods = [ "setCellValue", "cycleCell", "onMouseDown" ];
for (var i = 0; i < methods.length; i++) {
	var methodName = methods[i];
	var oldMethodName = "_old" + methodName;
	(function (o, n) {
		calendarListTreeView[o] = calendarListTreeView[n];
		calendarListTreeView[n] = function() {
			// dump("invoking " + n + "\n" + STACK(50));
			var rc = calendarListTreeView[o].apply(calendarListTreeView, arguments);
			// dump("  invoked " + n + "\n");
			return rc;
		}
	})(oldMethodName, methodName);
}

window.creationGetHandler = subscriptionGetHandler;

window.addEventListener("load", SIOnCalendarOverlayLoad, false);

function SIOnCalendarOverlayLoad() {
	var widget = document.getElementById("calendar-list-tree-widget");
	widget.addEventListener("mousedown", SIOnListMouseDown, true);
}

function SIOnListMouseDown(event) {
	if (event.type == "mousedown" && event.button == 0 && event.shiftKey) {
		var col = {};
		var calendar = calendarListTreeView.getCalendarFromEvent(event, col);
		if (calendar && col.value && col.value.id == "calendar-list-tree-checkbox") {
			toggleShowOnlyCalendarByCal(calendar);
			event.stopPropagation();
		}
	}
}
