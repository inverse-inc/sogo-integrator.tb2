function SIOnLoadHandler(event) {
  window.SIOldUpdateAttendees = window.updateAttendees;
  window.updateAttendees = window.SIUpdateAttendees;
  window.SIOldOnAccept = window.onAccept;
  window.onAccept = window.SIOnAccept;

  
  SIOldOnLoad();
}

function SIOnAccept() {
  var title = getElementValue("item-title");
  
  if (title.length > 0)
    title = title.replace(/(^\s+|\s+$)/g, "");
  
  if (title.length == 0) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService);
    var bundle = document.getElementById("bundle_integrator_calendar");

    var flags = promptService.BUTTON_TITLE_OK *
      promptService.BUTTON_POS_0;

    promptService.confirmEx(null,
			    bundle.getString("saveComponentTitle"),
			    bundle.getString("saveComponentMessage"),
			    flags,
			    null,
			    null,
			    null,
			    null,
			    {});
    
    return false;
  }
  return SIOldOnAccept();
}

function SIUpdateAttendees() {
  SIOldUpdateAttendees();

  var prefService = (Components.classes["@mozilla.org/preferences-service;1"]
  		     .getService(Components.interfaces.nsIPrefBranch));
  
  var b = false;

  try {
    b = prefService.getBoolPref("sogo-integrator.disable-send-invitations-checkbox");
  } catch (e) {}

  if (b == true) {
    var sendInvitesCheckbox = document.getElementById("send-invitations-checkbox");
    sendInvitesCheckbox.setAttribute('collapsed', 'true');
  }
}

window.SIOldOnLoad = onLoad;
window.onLoad = SIOnLoadHandler;
