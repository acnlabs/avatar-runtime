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
 *   - `opts.avatarModel3Url`   — Live2D model URL (from mediaState)
 *   - `opts.modelJsonUrl`      — same URL, normalized key (prefer this)
 *   - `opts.avatarModelVrmUrl` — VRM model URL (from mediaState)
 *   - `opts.control`           — initial control state (from mediaState)
 *   - `opts.width` / `opts.height` — explicit size override (from explicit opts)
 * @property {function(mediaState: MediaState): void} update
 *   Apply a new mediaState (control.avatar.face, control.scene, etc.) to a mounted renderer.
 * @property {function(): void} unmount
 *   Detach and clean up the renderer; after this call the instance is spent.
 * @property {function(): object} [getState]
 *   Optional — return current internal state for debugging.
 */

/**
 * Shape of the mediaState object passed to canHandle / update.
 *
 * Renderers read avatar/scene control from `control` (v0.2+).
 *
 * @typedef {Object} MediaState
 * @property {string}  [avatarModel3Url]       — Live2D model URL (.model.json / .model3.json)
 * @property {string}  [avatarModelVrmUrl]      — VRM model URL (.vrm); triggers VRM renderer when present
 * @property {object}  [control]                — unified control namespace (v0.2+)
 * @property {object}  [control.avatar]         — avatar control sub-domain
 * @property {object}  [control.avatar.face]    — face pose/expression parameters
 * @property {object}  [control.avatar.body]    — body skeleton/IK parameters
 * @property {object}  [control.avatar.emotion] — semantic emotion signal
 * @property {object}  [control.scene]          — scene camera/world parameters
 * @property {object}  [render]
 * @property {string}  [render.rendererMode]    — 'pixi' | 'l2dwidget' | 'vector'
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
