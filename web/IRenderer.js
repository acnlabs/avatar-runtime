'use strict';

/**
 * IRenderer.js — Interface definitions for the OpenPersona Renderer Registry.
 *
 * Two-layer object model:
 *   IRendererFactory  — static object registered with the registry
 *   IRendererInstance — live object created per-mount lifecycle
 *
 * This file is documentation-only (JSDoc + assertRendererFactory).
 * It does NOT need to be loaded in HTML — `renderer-registry.js` embeds
 * the validator directly.
 */

/**
 * Renderer factory registered with OpenPersonaRendererRegistry.
 *
 * @typedef {Object} IRendererFactory
 * @property {function(mediaState: MediaState): boolean} canHandle
 *   Return true if this renderer can handle the given mediaState.
 *   Factories are checked in registration order; first match wins.
 * @property {function(): IRendererInstance} createInstance
 *   Create a fresh, uninitialized renderer instance.
 *   Called once per `registry.create()` invocation.
 */

/**
 * Renderer instance produced by IRendererFactory.createInstance().
 *
 * @typedef {Object} IRendererInstance
 * @property {function(container: HTMLElement, opts?: object): Promise<void>} mount
 *   Attach the renderer to the given DOM container.
 *   When called via `OpenPersonaRendererRegistry.create(mediaState, container, opts)`,
 *   `opts` will contain a shallow merge of `mediaState` and any explicit opts:
 *   - `opts.avatarModel3Url` — Live2D model URL (from mediaState)
 *   - `opts.modelJsonUrl`    — same URL, normalized key (prefer this)
 *   - `opts.faceControl`     — initial face parameters (from mediaState)
 *   - `opts.width` / `opts.height` — explicit size override (from explicit opts)
 * @property {function(mediaState: MediaState): void} update
 *   Apply a new mediaState (faceControl, etc.) to a mounted renderer.
 * @property {function(): void} unmount
 *   Detach and clean up the renderer; after this call the instance is spent.
 * @property {function(): object} [getState]
 *   Optional — return current internal state for debugging.
 */

/**
 * Shape of the mediaState object passed to canHandle / update.
 *
 * @typedef {Object} MediaState
 * @property {string}  [avatarModel3Url]     — Live2D model URL (.model.json / .model3.json)
 * @property {object}  [faceControl]         — face parameter object from state.json
 * @property {object}  [render]
 * @property {string}  [render.rendererMode] — 'pixi' | 'l2dwidget' | 'vector'
 */

/**
 * Validate that `f` conforms to IRendererFactory.
 * Throws TypeError if required members are missing.
 *
 * @param {*} f
 * @returns {void}
 */
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { assertRendererFactory };
}
