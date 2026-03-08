(function () {
  'use strict';

  // Inline validator — mirrors IRenderer.js assertRendererFactory (no extra script load needed).
  function assertRendererFactory(f) {
    if (!f || typeof f !== 'object') {
      throw new TypeError('[OpenPersona] IRendererFactory must be an object, got: ' + typeof f);
    }
    if (typeof f.canHandle !== 'function') {
      throw new TypeError('[OpenPersona] IRendererFactory must have a canHandle(mediaState) function');
    }
    if (typeof f.createInstance !== 'function') {
      throw new TypeError('[OpenPersona] IRendererFactory must have a createInstance() function');
    }
  }

  var _factories = [];

  /**
   * Register a renderer factory.
   * Factories are checked in registration order; first canHandle() match wins.
   *
   * @param {IRendererFactory} factory
   */
  function register(factory) {
    assertRendererFactory(factory);
    _factories.push(factory);
  }

  /**
   * Find the first factory that can handle the given mediaState.
   *
   * @param {object} mediaState
   * @returns {IRendererFactory|undefined}
   */
  function resolve(mediaState) {
    for (var i = 0; i < _factories.length; i++) {
      if (_factories[i].canHandle(mediaState)) return _factories[i];
    }
    return undefined;
  }

  /**
   * Resolve, instantiate, and mount a renderer for the given mediaState.
   * Returns a Promise that resolves to the mounted IRendererInstance,
   * or null if no factory matches.
   *
   * @param {object}      mediaState
   * @param {HTMLElement} container
   * @param {object}      [opts]       — passed through to instance.mount()
   * @returns {Promise<IRendererInstance|null>}
   */
  function create(mediaState, container, opts) {
    var factory = resolve(mediaState);
    if (!factory) return Promise.resolve(null);
    var instance = factory.createInstance();
    // Merge mediaState into opts so adapters can read model URL, control, etc.
    var mountOpts = Object.assign({}, mediaState || {}, opts || {});
    return instance.mount(container, mountOpts).then(function () {
      return instance;
    });
  }

  /**
   * Return a copy of the registered factories list (for inspection/testing).
   *
   * @returns {IRendererFactory[]}
   */
  function list() {
    return _factories.slice();
  }

  window.OpenPersonaRendererRegistry = { register: register, resolve: resolve, create: create, list: list };
})();
