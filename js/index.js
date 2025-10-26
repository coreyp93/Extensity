      // --- Profile stacking logic (modern UX) ---
      // Checkbox elements for stacking
      var stackingCheckboxes = document.querySelectorAll('.profile-stack-checkbox');
      var stackingLegend = document.getElementById('profile-stack-legend');
      var stackedProfiles = [];

      function updateStackingLegend() {
        if (!stackingLegend) return;
        if (stackedProfiles.length === 0) {
          stackingLegend.textContent = 'No profiles stacked.';
        } else {
          stackingLegend.textContent = 'Stacked: ' + stackedProfiles.join(', ');
        }
      }

      function handleStackingChange() {
        stackedProfiles = [];
        stackingCheckboxes.forEach(function(cb) {
          if (cb.checked) stackedProfiles.push(cb.value || cb.getAttribute('data-name') || '');
        });
        updateStackingLegend();
        // TODO: Implement actual stacking logic (union of extensions, etc.)
        // For now, just visual feedback
      }

      stackingCheckboxes.forEach(function(cb) {
        cb.addEventListener('change', handleStackingChange);
      });
      updateStackingLegend();

      // Hide theme panel when clicking outside (modern UX)
      document.addEventListener('mousedown', function(e) {
        if (themePanel && themePanel.style.display === 'block') {
          if (!themePanel.contains(e.target) && e.target !== themeToggle) {
            themePanel.style.display = 'none';
          }
        }
      });
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
  // selectedProfiles supports stacking multiple profiles if opts.stackProfiles==true
  self.selectedProfiles = ko.observableArray().extend({persistable: 'selectedProfiles'});
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
      // If stacking mode enabled, toggle membership in selectedProfiles
      try {
        if (self.opts && self.opts.stackProfiles && self.opts.stackProfiles()) {
          var name = p.name();
          var idx = self.selectedProfiles.indexOf(name);
          if (idx === -1) {
            self.selectedProfiles.push(name);
          } else {
            self.selectedProfiles.splice(idx, 1);
          }
          // apply union of all selected profiles (plus always on)
          var chosen = _.union.apply(_, [self.profiles.always_on().items()].concat(
            _(self.selectedProfiles()).map(function(n){ var pr = self.profiles.find(n); return pr ? pr.items() : []; })
          ));
          var to_enable = _.intersection(self.exts.disabled.pluck(), chosen);
          var to_disable = _.difference(self.exts.enabled.pluck(), chosen);
          _(to_enable).each(function(id) { try{ self.exts.find(id).enable() } catch(e){} });
          _(to_disable).each(function(id) { try{ self.exts.find(id).disable() } catch(e){} });
          return;
        }
      } catch(e) {}
      // Fallback: single-select profile (original behavior)
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
  document.documentElement.style.width = '540px';
  document.documentElement.style.height = '520px';
  document.documentElement.style.minHeight = '520px';
  document.body.style.width = '540px';
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
        var desiredWidth = 540; // tuned to new default width
        document.documentElement.style.height = desiredHeight + 'px';
        document.body.style.height = desiredHeight + 'px';
        document.documentElement.style.minHeight = desiredHeight + 'px';
        document.body.style.minHeight = desiredHeight + 'px';
        document.documentElement.style.maxHeight = desiredHeight + 'px';
        document.body.style.maxHeight = desiredHeight + 'px';
        document.documentElement.style.width = desiredWidth + 'px';
        document.body.style.width = desiredWidth + 'px';
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
  var DEFAULT_SIZE = {w: 540, h: 520}; // increased default width by 50%
  var MIN_WIDTH = 280, MIN_HEIGHT = 160;

      // Helpers: convert rgb() to hex for color input compatibility
      var rgbToHex = function(rgb) {
        if (!rgb) return '#000000';
        var m = (''+rgb).match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!m) return rgb; // maybe already hex
        var r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
        var hex = '#' + [r,g,b].map(function(x){
          var s = x.toString(16); return (s.length==1) ? '0'+s : s;
        }).join('');
        return hex;
      };

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
          if (bgInput && items && items.bgColor) bgInput.value = rgbToHex(items.bgColor);
          if (fInput && items && items.fontColor) fInput.value = rgbToHex(items.fontColor);
        } catch(e) {}
      });

      // Resize handles
      var isResizing = false;
      var startX=0, startY=0, startW=0, startH=0;
      var resizeEdge = '';

      var clampToScreen = function(w,h) {
        try {
          var margin = 20;
          var maxW = Math.max(MIN_WIDTH, Math.min(w, (window.screen && window.screen.availWidth) ? window.screen.availWidth - margin : 1200));
          var maxH = Math.max(MIN_HEIGHT, Math.min(h, (window.screen && window.screen.availHeight) ? window.screen.availHeight - margin : 900));
          return {w: maxW, h: maxH};
        } catch(e) { return {w:w,h:h}; }
      };

      var onMouseMove = function(e) {
        if (!isResizing) return;
        var clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        var clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
        var dx = clientX - startX;
        var dy = clientY - startY;
        var newW = startW, newH = startH;

        // Right/Left
        if (resizeEdge.indexOf('right') !== -1) {
          newW = Math.round(startW + dx);
        } else if (resizeEdge.indexOf('left') !== -1) {
          newW = Math.round(startW - dx);
        }

        // Bottom/Top
        if (resizeEdge.indexOf('bottom') !== -1) {
          newH = Math.round(startH + dy);
        } else if (resizeEdge.indexOf('top') !== -1) {
          newH = Math.round(startH - dy);
        }

        var clamped = clampToScreen(Math.max(MIN_WIDTH, newW), Math.max(MIN_HEIGHT, newH));
        document.documentElement.style.width = clamped.w + 'px';
        document.body.style.width = clamped.w + 'px';
        document.documentElement.style.height = clamped.h + 'px';
        document.body.style.height = clamped.h + 'px';
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

          // Determine resize edge: map corners to descriptive words
          if (handle.classList.contains('corner')) {
            var m = handle.className.match(/corner-(tl|tr|bl|br)/);
            var corner = (m && m[1]) ? m[1] : '';
            var map = {tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right'};
            resizeEdge = map[corner] || '';
          } else {
            var cls = Array.from(handle.classList).find(function(c) { return ['top','bottom','left','right'].indexOf(c) !== -1; });
            resizeEdge = cls || '';
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

      // Helpers: convert rgb() to hex for color input compatibility
      var rgbToHex = function(rgb) {
        if (!rgb) return '#000000';
        var m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!m) return rgb; // maybe already hex
        var r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
        var hex = '#' + [r,g,b].map(function(x){
          var s = x.toString(16); return (s.length==1) ? '0'+s : s;
        }).join('');
        return hex;
      };

  // Modern theme panel functionality
  var themeToggle = document.getElementById('color-controls');
  var themePanel = document.getElementById('theme-panel');
  var closeTheme = document.getElementById('close-theme-panel');
  var bgInput = document.getElementById('bg-color');
  var fInput = document.getElementById('font-color');
  var saveThemeBtn = document.getElementById('save-theme');
  var resetColorsBtn = document.getElementById('reset-colors');
  var themeListDiv = document.getElementById('theme-list');

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
          // Update title in header to match font color (keep social icons' brand colors)
          try {
            var titleEl = document.getElementById('title');
            if (titleEl) titleEl.style.color = fontColor;
          } catch(e) {}
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

      // Theme panel toggle
      if (themeToggle && themePanel) {
        themeToggle.addEventListener('click', function(e) {
          e.preventDefault();
          if (themePanel.style.display === 'none' || !themePanel.style.display) {
            themePanel.style.display = 'block';
            // Update color inputs with current values (convert rgb to hex)
            try {
              var bodyBg = getComputedStyle(document.body).backgroundColor;
              var bodyColor = getComputedStyle(document.body).color;
              if (bgInput) bgInput.value = rgbToHex(bodyBg);
              if (fInput) fInput.value = rgbToHex(bodyColor);
            } catch(e) {}
            renderThemeList();
          } else {
            themePanel.style.display = 'none';
          }
        });
      }
      if (closeTheme && themePanel) {
        closeTheme.addEventListener('click', function() { themePanel.style.display = 'none'; });
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


      // Reset colors button
      if (resetColorsBtn) {
        resetColorsBtn.addEventListener('click', function() {
          var defBg = '#000000', defFont = '#00ffff';
          if (bgInput) bgInput.value = defBg;
          if (fInput) fInput.value = defFont;
          updateColors(defBg, defFont);
        });
      }

      // Save theme button (modern panel)
      if (saveThemeBtn) {
        saveThemeBtn.addEventListener('click', function() {
          var name = prompt('Theme name:');
          if (!name) return;
          try {
            chrome.storage.local.get('themes', function(obj) {
              var themes = obj.themes || {};
              var storedBg = (bgInput && bgInput.value) ? bgInput.value : rgbToHex(getComputedStyle(document.body).backgroundColor);
              var storedFont = (fInput && fInput.value) ? fInput.value : rgbToHex(getComputedStyle(document.body).color);
              themes[name] = {bg: storedBg, font: storedFont};
              chrome.storage.local.set({themes: themes}, renderThemeList);
            });
          } catch(e) {}
        });
      }

      // Render theme list in the panel
      function renderThemeList() {
        if (!themeListDiv) return;
        themeListDiv.innerHTML = '';
        chrome.storage.local.get('themes', function(obj) {
          var themes = obj.themes || {};
          Object.keys(themes).forEach(function(name) {
            var t = themes[name];
            var btn = document.createElement('button');
            btn.className = 'theme-btn';
            btn.textContent = name;
            btn.title = 'Apply theme';
            btn.style.background = t.bg;
            btn.style.color = t.font;
            btn.addEventListener('click', function() {
              if (bgInput) bgInput.value = t.bg;
              if (fInput) fInput.value = t.font;
              updateColors(t.bg, t.font);
            });
            var del = document.createElement('button');
            del.className = 'theme-delete-btn';
            del.textContent = '×';
            del.title = 'Delete theme';
            del.addEventListener('click', function(ev) {
              ev.stopPropagation();
              chrome.storage.local.get('themes', function(obj2) {
                var t2 = obj2.themes || {};
                delete t2[name];
                chrome.storage.local.set({themes: t2}, renderThemeList);
              });
            });
            var wrap = document.createElement('span');
            wrap.appendChild(btn);
            wrap.appendChild(del);
            themeListDiv.appendChild(wrap);
          });
        });
      }

      // Initialize with saved colors
      chrome.storage.local.get(['bgColor', 'fontColor'], function(items) {
        if (items && items.bgColor) updateColors(items.bgColor, null);
        if (items && items.fontColor) updateColors(null, items.fontColor);
      });

      // Compact and grid toggles
      var compactToggle = document.getElementById('compact-toggle');
      var gridToggle = document.getElementById('grid-toggle');
      var applyCompact = function(enabled) {
        document.body.classList.toggle('compact', !!enabled);
        try { chrome.storage && chrome.storage.local && chrome.storage.local.set({compactMode: !!enabled}); } catch(e){}
      };
      var applyGrid = function(enabled) {
        document.documentElement.classList.toggle('grid', !!enabled);
        try { chrome.storage && chrome.storage.local && chrome.storage.local.set({gridView: !!enabled}); } catch(e){}
      };
      if (compactToggle) {
        compactToggle.addEventListener('click', function(e) { e.preventDefault(); applyCompact(!document.body.classList.contains('compact')); });
      }
      if (gridToggle) {
        gridToggle.addEventListener('click', function(e) { e.preventDefault(); applyGrid(!document.documentElement.classList.contains('grid')); });
      }

      // Read compact/grid saved state
      try {
        chrome.storage.local.get(['compactMode','gridView'], function(items) {
          if (items && items.compactMode) applyCompact(items.compactMode);
          if (items && items.gridView) applyGrid(items.gridView);
        });
      } catch(e) {}

      // Search history (simple recent terms)
      var searchEl = document.querySelector('#search input');
  var historyEl = document.createElement('div'); historyEl.id = 'search-history'; historyEl.style.padding = '4px 6px'; historyEl.style.fontSize = '11px'; historyEl.style.position = 'relative'; historyEl.style.zIndex = '210';
      var clearHistBtn = document.createElement('button'); clearHistBtn.textContent = 'Clear'; clearHistBtn.style.marginLeft='6px';
      historyEl.appendChild(clearHistBtn);
      var historyList = document.createElement('div'); historyList.id = 'search-history-list'; historyList.style.marginTop='6px'; historyEl.appendChild(historyList);
      if (searchEl && searchEl.parentNode) searchEl.parentNode.appendChild(historyEl);
      var updateHistoryDisplay = function() {
        historyList.innerHTML='';
        try {
          // Read history from local storage; read enable flag from sync (options) first, fall back to local
          chrome.storage.local.get('searchHistory', function(obj) {
            var h = (obj && obj.searchHistory) ? obj.searchHistory : [];
            var show = true;
            try {
              chrome.storage.sync.get('enableSearchHistory', function(o) {
                if (o && typeof o.enableSearchHistory !== 'undefined') show = o.enableSearchHistory;
                if (!show) { historyList.style.display='none'; return; }
                historyList.style.display = h.length ? 'block' : 'none';
                h.slice(0,10).forEach(function(term) {
                  var b = document.createElement('button'); b.textContent = term; b.style.margin='2px'; b.addEventListener('click', function(){ searchEl.value = term; searchEl.dispatchEvent(new Event('input')); }); historyList.appendChild(b);
                });
              });
            } catch(e) {
              // If sync not available, show by default
              historyList.style.display = h.length ? 'block' : 'none';
              h.slice(0,10).forEach(function(term) {
                var b = document.createElement('button'); b.textContent = term; b.style.margin='2px'; b.addEventListener('click', function(){ searchEl.value = term; searchEl.dispatchEvent(new Event('input')); }); historyList.appendChild(b);
              });
            }
          });
        } catch(e) {}
      };
      clearHistBtn.addEventListener('click', function(){ try { chrome.storage.local.set({searchHistory:[]}, updateHistoryDisplay); } catch(e){} });
      if (searchEl) {
        var lastPush = null;
        searchEl.addEventListener('keydown', function(ev){
          if (ev.key === 'Enter') {
            var v = (searchEl.value || '').trim();
            if (!v) return;
            try {
              chrome.storage.local.get('searchHistory', function(obj){
                var h = obj.searchHistory || [];
                h = [v].concat(h.filter(function(x){return x!==v})).slice(0,50);
                chrome.storage.local.set({searchHistory: h}, updateHistoryDisplay);
              });
            } catch(e){}
          }
        });
      }
      updateHistoryDisplay();

    } catch(e) { /* non-fatal */ }
  });

  // Workaround for Chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=307912
  window.setTimeout(function() { document.getElementById('workaround-307912').style.display = 'block'; }, 0);
});
