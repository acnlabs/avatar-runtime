/**
 * avatar-widget.js — Self-contained, embeddable avatar widget.
 *
 * Usage (script tag):
 *   <script src="/packages/avatar-runtime/web/avatar-widget.js"></script>
 *   <script>
 *     var widget = new AvatarWidget(container, {
 *       modelUrl:   '/assets/live2d/slot/default.model.json',
 *       stateUrl:   'http://127.0.0.1:3721/v1/status',  // optional — enables polling
 *       pollMs:     500,                                 // optional, default 500
 *       vendorBase: '/demo/vendor-dist',                 // optional
 *       width:      360,
 *       height:     360,
 *     });
 *     widget.ready().then(function () { console.log('avatar mounted'); });
 *     widget.update(mediaState);   // manual push
 *     widget.destroy();            // cleanup
 *   </script>
 *
 * Usage (npm):
 *   const AvatarWidget = require('@acnlabs/avatar-runtime/widget');
 *   // Ensure renderer-registry.js + renderers are served statically and already
 *   // loaded, or pass widgetBase to let the widget self-load them.
 */
(function (global) {
  'use strict';

  // ── Script base detection ────────────────────────────────────────────────────
  // Captured at parse time (document.currentScript is only available synchronously).

  var _scriptBase = (function () {
    if (typeof document === 'undefined') return null;
    var s = document.currentScript;
    if (s && s.src) return s.src.replace(/\/[^/]+$/, '/');
    return '/packages/avatar-runtime/web/';
  })();

  // ── Script loader (idempotent) ───────────────────────────────────────────────

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined') return resolve();
      var existing = document.querySelector('script[data-openpersona-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.opsLoaded) return resolve();
        if (existing.dataset.opsError)  return reject(new Error('[AvatarWidget] script load failed: ' + src));
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', function () {
          reject(new Error('[AvatarWidget] script load failed: ' + src));
        });
        return;
      }
      var el = document.createElement('script');
      el.src = src;
      el.setAttribute('data-openpersona-src', src);
      el.onload = function () { el.dataset.opsLoaded = '1'; resolve(); };
      el.onerror = function () {
        el.dataset.opsError = '1';
        reject(new Error('[AvatarWidget] script load failed: ' + src));
      };
      document.head.appendChild(el);
    });
  }

  // ── Registry bootstrap (cached, runs once per page) ─────────────────────────

  var _registryReady = null;

  function ensureRegistry(base) {
    if (global.OpenPersonaRendererRegistry) return Promise.resolve();
    if (_registryReady) return _registryReady;
    _registryReady = loadScript(base + 'renderer-registry.js')
      .then(function () { return loadScript(base + 'renderers/live2d-pixi-adapter.js'); })
      .then(function () { return loadScript(base + 'renderers/vrm-renderer.js'); })
      .then(function () { return loadScript(base + 'renderers/vector-renderer.js'); })
      .then(function () { return loadScript(base + 'index.js'); });
    return _registryReady;
  }

  // ── AvatarWidget ─────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} container  - DOM element to render into
   * @param {object}      opts
   * @param {string}      [opts.modelUrl]      - Live2D model URL (.model.json / .model3.json)
   * @param {string}      [opts.vrmUrl]        - VRM model URL (.vrm); triggers VRM renderer
   * @param {object}      [opts.control]       - Initial control state { avatar: { face, body, emotion }, scene }
   * @param {string}      [opts.stateUrl]      - Polling endpoint for live mediaState updates
   * @param {number}      [opts.pollMs=500]    - Polling interval in ms
   * @param {string}      [opts.vendorBase]    - Base path for pixi/live2d vendor scripts
   * @param {number}      [opts.width=360]
   * @param {number}      [opts.height=360]
   * @param {string}      [opts.widgetBase]    - Override auto-detected script base path
   */
  function AvatarWidget(container, opts) {
    if (!container) throw new TypeError('[AvatarWidget] container element is required');
    opts = opts || {};

    this._container     = container;
    this._opts          = opts;
    this._instance      = null;
    this._pollTimer     = null;
    this._destroyed     = false;
    this._pendingUpdate = null;

    var base = opts.widgetBase || _scriptBase || '/packages/avatar-runtime/web/';
    var self = this;

    this._initPromise = ensureRegistry(base).then(function () {
      if (self._destroyed) return null;
      var reg = global.OpenPersonaRendererRegistry;
      if (!reg) throw new Error('[AvatarWidget] OpenPersonaRendererRegistry not available after bootstrap');

      var mediaState = self._buildMediaState();
      return reg.create(mediaState, container, {
        width:      opts.width      || 360,
        height:     opts.height     || 360,
        vendorBase: opts.vendorBase || undefined
      });
    }).then(function (instance) {
      if (self._destroyed) {
        if (instance) instance.unmount();
        return;
      }
      self._instance = instance;
      if (instance && self._pendingUpdate) {
        instance.update(self._pendingUpdate);
        self._pendingUpdate = null;
      }
      if (instance && opts.stateUrl) {
        self._startPolling(opts.stateUrl, opts.pollMs || 500);
      }
    });
  }

  /**
   * Returns a Promise that resolves when the renderer is mounted.
   * Rejects if registry bootstrap or renderer creation fails — always add .catch().
   * @returns {Promise<void>}
   */
  AvatarWidget.prototype.ready = function () {
    return this._initPromise;
  };

  /**
   * Push a new mediaState to the mounted renderer.
   * Safe to call before ready() resolves — the last update is buffered and
   * applied immediately once the renderer is mounted.
   * @param {object} mediaState
   */
  AvatarWidget.prototype.update = function (mediaState) {
    if (this._instance) {
      this._instance.update(mediaState);
    } else if (!this._destroyed) {
      this._pendingUpdate = mediaState;
    }
  };

  /**
   * Stop polling and unmount the renderer. The widget cannot be reused after destroy().
   */
  AvatarWidget.prototype.destroy = function () {
    this._destroyed     = true;
    this._pendingUpdate = null;
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    if (this._instance) { this._instance.unmount(); this._instance = null; }
  };

  /**
   * Return internal renderer state (for debugging).
   * @returns {object|null}
   */
  AvatarWidget.prototype.getState = function () {
    return this._instance ? this._instance.getState() : null;
  };

  // ── Internal helpers ─────────────────────────────────────────────────────────

  AvatarWidget.prototype._buildMediaState = function () {
    var opts = this._opts;
    return {
      avatarModel3Url:  opts.modelUrl        || '',
      avatarModelVrmUrl: opts.vrmUrl         || undefined,
      control:          opts.control         || undefined,
      render:           { rendererMode: opts.rendererMode || 'pixi' }
    };
  };

  AvatarWidget.prototype._startPolling = function (stateUrl, intervalMs) {
    var self = this;
    function poll() {
      if (self._destroyed) return;
      fetch(stateUrl)
        .then(function (r) {
          if (!r.ok) throw new Error('status ' + r.status);
          return r.json();
        })
        .then(function (state) {
          if (!self._destroyed && self._instance) self._instance.update(state);
        })
        .catch(function () {});
    }
    poll();
    self._pollTimer = setInterval(poll, intervalMs);
  };

  // ── Expose ───────────────────────────────────────────────────────────────────

  global.AvatarWidget = AvatarWidget;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AvatarWidget;
  }
})(typeof window !== 'undefined' ? window : this);
