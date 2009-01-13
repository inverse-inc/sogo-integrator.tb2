/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

function CalendarHandler() {
	this.doubles = [];
  this.mgr = (Components.classes["@mozilla.org/calendar/manager;1"]
							.getService(Components.interfaces.calICalendarManager));
}

CalendarHandler.prototype = {
	getExistingDirectories: function getExistingDirectories() {
    var existing = {};

    var count = {};
    var cals = this.mgr.getCalendars(count);
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

		if (this.mgr.setCalendarPref) {
			this.mgr.setCalendarPref(directory, "NAME", displayName);
			this.mgr.setCalendarPref(directory, "SUPPRESSALARMS", true);
			if (color)
				this.mgr.setCalendarPref(directory, "COLOR", color);
		}
		else if (this.mgr.setCalendarPref_) { /* Lightning 0.8, 0.9 */
			directory.name = displayName;
			if (isNew)
				directory.setProperty("suppressAlarms", true);
			directory.setProperty("cache.enabled", true);
			if (color)
				directory.setProperty("color", color);
		}
		else
			throw("folder-handler.js: unsupported method for updating properties");
	},
	addDirectories: function addDirectories(newDirs) {
    var ioSvc = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);
 		var aclMgr = Components.classes["@inverse.ca/calendar/caldav-acl-manager;1"]
		.getService(Components.interfaces.nsISupports)
		.wrappedJSObject;

 		dump("addDirectories\n");
    for (var i = 0; i < newDirs.length; i++) {
      var newURI = ioSvc.newURI(newDirs[i]['url'], null, null);
      var newCalendar = this.mgr.createCalendar("caldav", newURI, true);
			this.mgr.registerCalendar(newCalendar);
			this._setDirectoryProperties(newCalendar, newDirs[i], true);
			aclMgr.calendarEntry(newURI);
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
