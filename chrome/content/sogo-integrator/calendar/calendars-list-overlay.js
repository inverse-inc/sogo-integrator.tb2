/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (var i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("calendars-list-overlay.js: failed to include '" + files[i] + "'\n"
					 + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://sogo-integrator/content/messenger/folders-update.js"]);

window.addEventListener("load", onInverseCalendarsListOverlayLoad, false);

function onInverseCalendarsListOverlayLoad() {
  var popup = document.getElementById("list-calendars-context-menu");
  var properties = document.getElementById("list-calendars-context-edit");
	var showonly = document.getElementById("list-calendars-context-sogo-showonly");
	var showall = document.getElementById("list-calendars-context-sogo-showall");
  var separator = document.createElement("menuseparator");
  popup.removeChild(properties);
  popup.insertBefore(separator, popup.firstChild);
  popup.insertBefore(properties, popup.firstChild);
	
	separator = document.createElement("menuseparator");
	popup.insertBefore(separator, popup.firstChild)
	popup.insertBefore(showall, popup.firstChild);
	popup.insertBefore(showonly, popup.firstChild);

	var controller = new SICalendarListTreeController();
	var calendarTree = document.getElementById("calendar-list-tree-widget");
	calendarTree.controllers.appendController(controller);

	popup.addEventListener("popupshowing", onCalendarTreePopup, false);
}

function onCalendarTreePopup(event) {
	goUpdateCommand("calendar_manage_sogo_acls_command");
}

function SICalendarListTreeController() {
}

SICalendarListTreeController.prototype = {
 supportsCommand: function(command) {
    return (command == "calendar_manage_sogo_acls_command");
  },

 isCommandEnabled: function(command) {
    var isEnabled;

    if (command == "calendar_manage_sogo_acls_command") {
      var acl_menuitem = document.getElementById("list-calendars-context-sogo-acls");
      var delete_menuitem = document.getElementById("list-calendars-context-delete");

			var calendar = getSelectedCalendar();
			if (calendar.type == "caldav") {
        var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
                               .getService(Components.interfaces.nsISupports)
                               .wrappedJSObject;
        var entry = aclMgr.calendarEntry(calendar.uri);
        if (entry.userIsOwner()) {
          acl_menuitem.label = acl_menuitem.getAttribute("managelabel");
          delete_menuitem.label = delete_menuitem.getAttribute("deletelabel");
        } else {
          acl_menuitem.label = acl_menuitem.getAttribute("reloadlabel");
          delete_menuitem.label = delete_menuitem.getAttribute("unsubscribelabel");
				}

				var length = sogoBaseURL().length;
				if (calendar.uri.spec.substr(0, length) == sogoBaseURL()) {
          var CalendarChecker = new directoryChecker("Calendar");
          isEnabled = CalendarChecker.checkAvailability();
        }
        else
          isEnabled = true;
			}
			else {
				// For local/webdav calendars, we show the manage label and the delete one
				acl_menuitem.label = acl_menuitem.getAttribute("managelabel");
				delete_menuitem.label = delete_menuitem.getAttribute("deletelabel");
				return isEnabled = false;
			}
		} else {
      isEnabled = true;
    }

		return isEnabled;
  },

 doCommand: function(command) { dump("doCommand\n"); },

 onEvent: function(event) { dump("onEvent\n"); }
};
