// Migration from localStorage settings to Chrome Storage sync.

// Helper: remove sync'd storage for testing
// chrome.storage.sync.remove(['migration','profiles', 'showHeader', 'groupApps', 'appsFirst', 'enabledFirst', 'searchBox', 'dismissals', 'toggled']);

// Get the right boolean value.
// Hack to override default string-only localStorage implementation
// http://stackoverflow.com/questions/3263161/cannot-set-boolean-values-in-localstorage
function boolean(value) {
  if (value === "true")
    return true;
  else if (value === "false")
    return false;
  else
    return Boolean(value);
};


// Boolean value from chrome.storage.local with a default (async)
function b(idx, def, cb) {
  chrome.storage.local.get(idx, function(obj) {
    if (typeof obj[idx] !== 'undefined') cb(boolean(obj[idx]));
    else cb(boolean(def));
  });
}


function migrate_to_chrome_storage() {
  chrome.storage.sync.get("migration", function(v) {
    if(v["migration"]) {
      console.log("Migration from localStorage already happened in another computer");
    } else {
      console.log("Migrate localStorage data to Chrome Storage Sync");
      // Read all keys from chrome.storage.local
      chrome.storage.local.get(['dismissals','profiles','toggled','showHeader','groupApps','appsFirst','enabledFirst','searchBox'], function(localData) {
        var data = {
          dismissals:   localData['dismissals'] ? JSON.parse(localData['dismissals']) : [],
          profiles:     localData['profiles'] ? JSON.parse(localData['profiles']) : {},
          // toggled:      toggled,
          showHeader:   boolean(localData['showHeader'] || true),
          groupApps:    boolean(localData['groupApps'] || true),
          appsFirst:    boolean(localData['appsFirst'] || false),
          enabledFirst: boolean(localData['enabledFirst'] || false),
          searchBox:    boolean(localData['searchBox'] || true),
          migration:    "1.4.0"
        };
        chrome.storage.sync.set(data, function() {
          // Remove migrated settings from chrome.storage.local
          chrome.storage.local.remove(['dismissals','profiles','toggled','showHeader','groupApps','appsFirst','enabledFirst','searchBox']);
        });
      });
    }
  });
}

// Listeners for the event page.
chrome.runtime.onInstalled.addListener(function(details) {
  if(details["reason"] == 'update' && details["previousVersion"] < "1.4.0") {
      migrate_to_chrome_storage();
  }
});