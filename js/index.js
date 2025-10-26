document.addEventListener("DOMContentLoaded", function() {

  var SearchViewModel = function() {
    var self = this;
    self.q = ko.observable("");

    // TODO: Add more search control here.
  };

  var SwitchViewModel = function(exts, profiles, opts) {
    var self = this;

    var init = [];

    self.exts = exts;
    self.profiles = profiles;
    self.opts = opts;
    self.toggled = ko.observableArray().extend({persistable: "toggled"});

    self.any = ko.computed(function() {
      return self.toggled().length > 0;
    });

    self.toggleStyle = ko.pureComputed(function() {
      return (self.any()) ? 'fa-toggle-off' : 'fa-toggle-on'
    });

    var disableFilterFn = function(item) {
      // Filter out Always On extensions when disabling, if option is set.
      if(!self.opts.keepAlwaysOn()) return true;
      return !_(self.profiles.always_on().items()).contains(item.id());
    };

    self.flip = function() {
      if(self.any()) {
        // Re-enable
        _(self.toggled()).each(function(id) {
          // Old disabled extensions may be removed
          try{ self.exts.find(id).enable();} catch(e) {};
        });
        self.toggled([]);
      } else {
        // Disable
        self.toggled(self.exts.enabled.pluck());
        self.exts.enabled.disable(disableFilterFn);
      };
    };

  };

  var ExtensityViewModel = function() {
    var self = this;

    self.profiles = new ProfileCollectionModel();
    self.exts = new ExtensionCollectionModel();
    self.opts = new OptionsCollection();
    self.dismissals = new DismissalsCollection();
    self.switch = new SwitchViewModel(self.exts, self.profiles, self.opts);
    self.search = new SearchViewModel();
    self.activeProfile = ko.observable().extend({persistable: "activeProfile"});

    var filterFn = function(i) {
      // Filtering function for search box
      if(!self.opts.searchBox()) return true;
      if(!self.search.q()) return true;
      return i.name().toUpperCase().indexOf(self.search.q().toUpperCase()) !== -1;
    };

    var filterProfileFn = function(i) {
      if(!i.reserved()) return true;
      return self.opts.showReserved() && i.hasItems();
    }

    var filterFavoriteFn = function(i) {
      return (self.profiles.favorites().contains(i));
    }

    var nameSortFn = function(i) {
      return i.name().toUpperCase();
    };

    var statusSortFn = function(i) {
      return self.opts.enabledFirst() && !i.status();
    };

    self.openChromeExtensions = function() {
      openTab("chrome://extensions");
    };

    self.launchApp = function(app) {
      chrome.management.launchApp(app.id());
    };

    self.launchOptions = function(ext) {
      chrome.tabs.create({url: ext.optionsUrl(), active: true});
    };

    self.listedExtensions = ko.computed(function() {
      // Sorted/Filtered list of extensions
      return _(self.exts.extensions()).chain()
        .filter(filterFn)
        .sortBy(nameSortFn)
        .sortBy(statusSortFn)
        .value()
    }).extend({countable: null});

    self.listedApps = ko.computed(function() {
      // Sorted/Filtered list of apps
      return _(self.exts.apps())
        .filter(filterFn);
    }).extend({countable: null});

    self.listedItems = ko.computed(function() {
      // Sorted/Filtered list of all items
      return _(self.exts.items())
        .filter(filterFn);
    }).extend({countable: null});

    self.listedProfiles = ko.computed(function() {
      return _(self.profiles.items())
        .filter(filterProfileFn);
    }).extend({countable: null});

    self.listedFavorites = ko.computed(function() {
      return _(self.exts.extensions()).chain()
        .filter(filterFavoriteFn)
        .filter(filterFn)
        .sortBy(nameSortFn)
        .sortBy(statusSortFn)
        .value();
    }).extend({countable: null});

    self.emptyItems = ko.pureComputed(function() {
      return self.listedApps.none() && self.listedExtensions.none();
    });

    self.setProfile = function(p) {
      self.activeProfile(p.name());
      // Profile items, plus always-on items
      var ids = _.union(p.items(), self.profiles.always_on().items());
      var to_enable = _.intersection(self.exts.disabled.pluck(),ids);
      var to_disable = _.difference(self.exts.enabled.pluck(), ids);
      _(to_enable).each(function(id) { self.exts.find(id).enable() });
      _(to_disable).each(function(id) { self.exts.find(id).disable() });
    };

    self.unsetProfile = function() {
      self.activeProfile(undefined);
    };

    self.toggleExtension = function(e) {
      e.toggle();
      self.unsetProfile();
    }

    // Private helper functions
    var openTab = function (url) {
      chrome.tabs.create({url: url});
      close();
    };

    var close = function() {
      window.close();
    };

    // View helpers
    var visitedProfiles = ko.computed(function() {
      return (self.dismissals.dismissed("profile_page_viewed") || self.profiles.any());
    });

  };

  _.defer(function() {
    // Force initial size before anything loads
    document.documentElement.style.height = '520px';
    document.documentElement.style.minHeight = '520px';
    document.body.style.height = '520px';
    document.body.style.minHeight = '520px';

    vm = new ExtensityViewModel();
    ko.bindingProvider.instance = new ko.secureBindingsProvider({});
    ko.applyBindings(vm, document.body);

    // Force a stable popup height after the initial list is rendered and
    // whenever the listed collections change. Vivaldi sometimes collapses the
    // popup when large dynamic lists are inserted; applying an explicit
    // computed/document height helps keep the popup usable.
    var forcePopupHeight = function() {
      try {
        var desiredHeight = 520; // px - tuned to fit typical lists
        var desiredWidth = 360;
        document.documentElement.style.height = desiredHeight + 'px';
        document.body.style.height = desiredHeight + 'px';
        document.documentElement.style.minHeight = desiredHeight + 'px';
        document.body.style.minHeight = desiredHeight + 'px';
        document.documentElement.style.maxHeight = desiredHeight + 'px';
        document.body.style.maxHeight = desiredHeight + 'px';
        // Try window.resizeTo (may be ignored by some Chromium builds)
        if (typeof window.resizeTo === 'function') {
          try { window.resizeTo(desiredWidth, desiredHeight); } catch(e) {}
        }
      } catch(e) { /* swallow errors */ }
    };

    // Apply shortly after render
    setTimeout(forcePopupHeight, 50);

    // Re-apply when lists change
    var safeSubscribe = function(observable) {
      try {
        if (observable && typeof observable.subscribe === 'function') {
          observable.subscribe(function() {
            setTimeout(forcePopupHeight, 20);
          });
        }
      } catch(e) {}
    };

    safeSubscribe(vm.listedExtensions);
    safeSubscribe(vm.listedApps);
    safeSubscribe(vm.listedItems);

    // Also react to window focus/visibility changes and briefly during initial
    // open to avoid transient reflow issues in Vivaldi.
    try {
      window.addEventListener('focus', forcePopupHeight);
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') forcePopupHeight();
      });
      // Run a short burst of fixes right after open to cover async image loads
      var burst = setInterval(forcePopupHeight, 200);
      setTimeout(function() { clearInterval(burst); }, 1200);

      // Add MutationObserver to catch any DOM changes that might affect size
      var observer = new MutationObserver(function(mutations) {
        forcePopupHeight();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });

    } catch(e) {}
  });

  // Workaround for Chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=307912
  window.setTimeout(function() { document.getElementById('workaround-307912').style.display = 'block'; }, 0);
});
