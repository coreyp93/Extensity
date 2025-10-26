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

    // ------------------ UI helpers: resize & color controls ------------------
    try {
      var DEFAULT_SIZE = {w: 360, h: 520};

      var applySavedSettings = function(settings) {
        settings = settings || {};
        if (settings.popupSize && settings.popupSize.w && settings.popupSize.h) {
          document.documentElement.style.width = settings.popupSize.w + 'px';
          document.documentElement.style.height = settings.popupSize.h + 'px';
          document.body.style.width = settings.popupSize.w + 'px';
          document.body.style.height = settings.popupSize.h + 'px';
        }
        if (settings.bgColor) {
          document.body.style.backgroundColor = settings.bgColor;
          document.documentElement.style.backgroundColor = settings.bgColor;
        }
        if (settings.fontColor) {
          document.body.style.color = settings.fontColor;
        }
      };

      // Load persisted settings
      chrome.storage && chrome.storage.local && chrome.storage.local.get(['popupSize','bgColor','fontColor'], function(items) {
        var s = {};
        if (items && items.popupSize) s.popupSize = items.popupSize;
        if (items && items.bgColor) s.bgColor = items.bgColor;
        if (items && items.fontColor) s.fontColor = items.fontColor;
        applySavedSettings(s);
        // populate color inputs if present
        try {
          var bgInput = document.getElementById('bg-color');
          var fInput = document.getElementById('font-color');
          if (bgInput && items && items.bgColor) bgInput.value = items.bgColor;
          if (fInput && items && items.fontColor) fInput.value = items.fontColor;
        } catch(e) {}
      });

      // Resize handles
      var isResizing = false;
      var startX=0, startY=0, startW=0, startH=0;
      var resizeEdge = '';
      
      var onMouseMove = function(e) {
        if (!isResizing) return;
        var clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        var clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
        var dx = clientX - startX;
        var dy = clientY - startY;
        var newW = startW, newH = startH;

        // Handle different edges
        if (resizeEdge.includes('right')) {
          newW = Math.max(280, Math.round(startW + dx));
        } else if (resizeEdge.includes('left')) {
          newW = Math.max(280, Math.round(startW - dx));
        }

        if (resizeEdge.includes('bottom')) {
          newH = Math.max(160, Math.round(startH + dy));
        } else if (resizeEdge.includes('top')) {
          newH = Math.max(160, Math.round(startH - dy));
        }

        document.documentElement.style.width = newW + 'px';
        document.body.style.width = newW + 'px';
        document.documentElement.style.height = newH + 'px';
        document.body.style.height = newH + 'px';
      };

      var onMouseUp = function(e) {
        if (!isResizing) return;
        isResizing = false;
        resizeEdge = '';
        document.body.style.cursor = '';
        // save size
        try {
          var w = parseInt(document.documentElement.style.width,10) || DEFAULT_SIZE.w;
          var h = parseInt(document.documentElement.style.height,10) || DEFAULT_SIZE.h;
          chrome.storage && chrome.storage.local && chrome.storage.local.set({popupSize:{w:w,h:h}});
        } catch(e) {}
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('touchend', onMouseUp);
      };

      var setupResizeHandle = function(handle) {
        var startResize = function(e) {
          isResizing = true;
          startX = e.clientX || (e.touches && e.touches[0].clientX);
          startY = e.clientY || (e.touches && e.touches[0].clientY);
          startW = parseInt(document.documentElement.style.width,10) || document.documentElement.clientWidth || DEFAULT_SIZE.w;
          startH = parseInt(document.documentElement.style.height,10) || document.documentElement.clientHeight || DEFAULT_SIZE.h;
          
          // Determine resize edge
          if (handle.classList.contains('corner')) {
            resizeEdge = handle.className.match(/corner-(tl|tr|bl|br)/)[1];
          } else {
            resizeEdge = Array.from(handle.classList)
              .find(c => ['top', 'bottom', 'left', 'right'].includes(c));
          }
          
          document.body.style.cursor = window.getComputedStyle(handle).cursor;
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          e.preventDefault();
          e.stopPropagation();
        };

        handle.addEventListener('mousedown', startResize);
        handle.addEventListener('touchstart', function(e) {
          e.clientX = e.touches[0].clientX;
          e.clientY = e.touches[0].clientY;
          startResize(e);
          window.addEventListener('touchmove', onMouseMove);
          window.addEventListener('touchend', onMouseUp);
        });
      };

      // Setup all resize handles
      document.querySelectorAll('.resize-handle').forEach(setupResizeHandle);

      // Reset size button
      var resetBtn = document.getElementById('reset-size');
      if (resetBtn) {
        resetBtn.addEventListener('click', function(e) {
          e.preventDefault();
          document.documentElement.style.width = DEFAULT_SIZE.w + 'px';
          document.body.style.width = DEFAULT_SIZE.w + 'px';
          document.documentElement.style.height = DEFAULT_SIZE.h + 'px';
          document.body.style.height = DEFAULT_SIZE.h + 'px';
          try { chrome.storage && chrome.storage.local && chrome.storage.local.set({popupSize:DEFAULT_SIZE}); } catch(e) {}
        });
      }

      // Color panel functionality
      var colorToggle = document.getElementById('color-controls');
      var colorPanel = document.getElementById('color-panel');
      var closeColor = document.getElementById('close-color-panel');
      var bgInput = document.getElementById('bg-color');
      var fInput = document.getElementById('font-color');

      // Function to update colors
      var updateColors = function(bgColor, fontColor) {
        // Update background color
        if (bgColor) {
          document.body.style.backgroundColor = bgColor;
          document.documentElement.style.backgroundColor = bgColor;
          // Update input elements background
          document.querySelectorAll('input[type="text"]').forEach(function(input) {
            input.style.backgroundColor = bgColor;
          });
        }

        // Update font color
        if (fontColor) {
          // Update main font color
          document.body.style.color = fontColor;
          // Update links and icons
          document.querySelectorAll('a, .fa').forEach(function(el) {
            if (!el.classList.contains('fa-facebook-official') && 
                !el.classList.contains('fa-twitter') && 
                !el.classList.contains('fa-star')) {
              el.style.color = fontColor;
            }
          });
          // Update input text color
          document.querySelectorAll('input[type="text"]').forEach(function(input) {
            input.style.color = fontColor;
          });
        }

        // Save colors to storage
        try {
          var settings = {};
          if (bgColor) settings.bgColor = bgColor;
          if (fontColor) settings.fontColor = fontColor;
          chrome.storage.local.set(settings);
        } catch(e) {
          console.error('Failed to save color settings:', e);
        }
      };

      // Color panel toggle
      if (colorToggle && colorPanel) {
        colorToggle.addEventListener('click', function(e) {
          e.preventDefault();
          if (colorPanel.style.display === 'none' || !colorPanel.style.display) {
            colorPanel.style.display = 'block';
            // Update color inputs with current values
            bgInput.value = getComputedStyle(document.body).backgroundColor;
            fInput.value = getComputedStyle(document.body).color;
          } else {
            colorPanel.style.display = 'none';
          }
        });
      }

      if (closeColor && colorPanel) {
        closeColor.addEventListener('click', function() { 
          colorPanel.style.display = 'none'; 
        });
      }

      // Color input handlers
      if (bgInput) {
        bgInput.addEventListener('input', function() {
          updateColors(this.value, null);
        });
      }

      if (fInput) {
        fInput.addEventListener('input', function() {
          updateColors(null, this.value);
        });
      }

      // Initialize with saved colors
      chrome.storage.local.get(['bgColor', 'fontColor'], function(items) {
        if (items.bgColor) updateColors(items.bgColor, null);
        if (items.fontColor) updateColors(null, items.fontColor);
      });

    } catch(e) { /* non-fatal */ }
  });

  // Workaround for Chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=307912
  window.setTimeout(function() { document.getElementById('workaround-307912').style.display = 'block'; }, 0);
});
