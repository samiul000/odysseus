/* cssLoader.js — lazy-loads CSS modules on demand to reduce initial memory.
   Each feature CSS file is loaded once when its modal/panel first opens,
   and optionally unloaded on close to reclaim CSSOM memory. */
(function () {
  'use strict';
  const _loaded = new Map(); // path → <link> element
  const BASE = '/static/css/';

  /**
   * Load a CSS module. Returns a Promise that resolves when the stylesheet
   * has been applied. No-ops if already loaded.
   */
  function loadCss(file) {
    const path = BASE + file;
    if (_loaded.has(path)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = path;
      link.onload = resolve;
      link.onerror = () => {
        console.warn('[cssLoader] failed to load', path);
        resolve(); // don't block the UI
      };
      document.head.appendChild(link);
      _loaded.set(path, link);
    });
  }

  /** Unload a CSS module to free CSSOM memory. */
  function unloadCss(file) {
    const path = BASE + file;
    const link = _loaded.get(path);
    if (link) {
      link.remove();
      _loaded.delete(path);
    }
  }

  /** Check if a CSS module is loaded. */
  function isCssLoaded(file) {
    return _loaded.has(BASE + file);
  }

  // ── Feature module map ──
  // Each entry maps a feature name to its CSS file.
  const FEATURE_CSS = {
    calendar:  'calendar.css',
    notes:     'notes.css',
    email:     'email.css',
    gallery:   'gallery.css',
    cookbook:   'cookbook.css',
    tasks:     'tasks.css',
    editor:    'editor.css',
    admin:     'admin.css',
    memory:    'memory.css',
    research:  'research.css',
    misc:      'misc.css',
  };

  /** Load CSS for a named feature. */
  function loadFeatureCss(name) {
    const file = FEATURE_CSS[name];
    if (file) return loadCss(file);
    return Promise.resolve();
  }

  /** Unload CSS for a named feature. */
  function unloadFeatureCss(name) {
    const file = FEATURE_CSS[name];
    if (file) unloadCss(file);
  }

  window.cssLoader = {
    loadCss,
    unloadCss,
    isCssLoaded,
    loadFeatureCss,
    unloadFeatureCss,
    FEATURE_CSS,
  };
})();
