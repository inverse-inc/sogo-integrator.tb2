/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

function CalendarHandler() {
	this.doubles = [];
  this.mgr = (Components.classes["@mozilla.org/calendar/manager;1"]
              .getService(Components.interfaces.calICalendarManager)
              .wrappedJSObject);
}

var _topmostWindow = null;

function topmostWindow() {
    if (!_topmostWindow) {
        var currentTop = window;
        while (currentTop.opener)
            currentTop = currentTop.opener;

        _topmostWindow = currentTop;
    }

    return _topmostWindow;
}

CalendarHandler.prototype = {
  getExistingDirectories: function getExistingDirectories() {
    var existing = {};

    var cals = this.mgr.getCalendars({});
    for (var i = 0; i < cals.length; i++) {
      if (cals[i].type == "caldav") {
				if (existing[cals[i].uri.spec])
					this.doubles.push(cals[i]);
				else
					existing[cals[i].uri.spec] = cals[i];
			}
    }

    return existing;
  },
	removeHomeCalendar: function removeHomeCalendar() {
		var cals = this.mgr.getCalendars({});
		
		for each (var cal in cals) {
				if (cal.type == "storage" && cal.uri.spec == "moz-profile-calendar://") {
					var dbService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
					var mDB = dbService.openSpecialDatabase("profile");
					var stmt = mDB.createStatement("select (select count(*) from cal_events where cal_id = 0) + (select count(*) from cal_todos where cal_id = 0)");
					var count = 0;
					
					if (stmt.executeStep()) {
						count += stmt.getInt32(0);
					}
					stmt.reset();

					if (count == 0) {
						this.mgr.unregisterCalendar(cal);
						this.mgr.deleteCalendar(cal);
					}
				}
			}
	},
	removeDoubles: function removeDoubles() {
		this.removeDirectories(this.doubles);
	},
	_setDirectoryProperties: function _setDirectoryProperties(directory,
																														properties,
																														isNew) {
		var displayName = properties['displayName'];
		var props = properties.additional;
		var color;
		if (props && props[0])
			color = props[0].substr(0, 7).toUpperCase(); /* calendar-color */
		else
			color = null;

    directory.name = displayName;
    if (isNew) {
        var urlArray = directory.uri.spec.split("/");
        var urlFolder = urlArray[7];

        // We enable alarms, today pane and invitations ONLY for "folder"
        // owners.
        // All subscribtions's alarms are ignored by default.
        if (directory.uri.spec.indexOf('_') > -1) {
            directory.setProperty("showInTodayPane", false);
            directory.setProperty("showInvitations", false);
            directory.setProperty("suppressAlarms", true);
        }
        else {
            directory.setProperty("showInTodayPane", true);
            directory.setProperty("showInvitations", true);
            directory.setProperty("suppressAlarms", false);
        }
    }
    directory.setProperty("cache.enabled", true);
    if (color)
				directory.setProperty("color", color);
	},
	addDirectories: function addDirectories(newDirs) {
    var ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);

 		dump("addDirectories\n");
    for (var i = 0; i < newDirs.length; i++) {
      var newURI = ioSvc.newURI(newDirs[i]['url'], null, null);
      var newCalendar = this.mgr.createCalendar("caldav", newURI, true);
//  			this.mgr.registerCalendar(newCalendar);
			this._setDirectoryProperties(newCalendar, newDirs[i], true);
    }
  },
	renameDirectories: function renameDirectories(dirs) {
    for (var i = 0; i < dirs.length; i++)
			// 			dump("renaming calendar: " + dirs[i]['url'] + "\n");
			this._setDirectoryProperties(dirs[i]['folder'], dirs[i]);
  },
	removeDirectories: function removeDirectories(oldDirs) {
    for (var i = 0; i < oldDirs.length; i++) {
			// 			dump("removing calendar: " + oldDirs[i] + "\n");
      this.mgr.unregisterCalendar(oldDirs[i]);
      this.mgr.deleteCalendar(oldDirs[i]);
    }
  },
	urlForParentDirectory: function urlForParentDirectory() {
		return sogoBaseURL() + "Calendar";
	},
	additionalDAVProperties: function additionalDAVProperties() {
		return ["http://apple.com/ns/ical/ calendar-color"];
	}
};
