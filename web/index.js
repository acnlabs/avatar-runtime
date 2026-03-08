/**
 * packages/avatar-runtime/web/index.js
 *
 * Browser entry point for the OpenPersona Renderer Registry.
 *
 * Load order in HTML:
 *   1. renderers/live2d-pixi-adapter.js (optional) → window.OpenPersonaPixiLive2DAdapter
 *   2. renderers/vrm-renderer.js        (optional) → window.OpenPersonaVRMRenderer
 *   3. renderer-registry.js                        → window.OpenPersonaRendererRegistry
 *   4. renderers/vector-renderer.js                → window.OpenPersonaVectorRenderer
 *   5. this file                                   — registers factories in priority order
 *
 * Registration order determines priority: first canHandle() match wins.
 * Specific renderers (Live2D, VRM) are registered first; vector renderer last (fallback).
 */
(function () {
  'use strict';

  var reg = window.OpenPersonaRendererRegistry;
  if (!reg) {
    console.warn('[OpenPersona] renderer-registry.js must be loaded before web/index.js');
    return;
  }

  // Register Live2D pixi adapter (specific — handles model.json / model3.json URLs).
  var pixiAdapter = window.OpenPersonaPixiLive2DAdapter;
  if (pixiAdapter && pixiAdapter.factory) {
    reg.register(pixiAdapter.factory);
  }

  // Register VRM renderer (specific — handles avatarModelVrmUrl).
  var vrmRenderer = window.OpenPersonaVRMRenderer;
  if (vrmRenderer) {
    reg.register(vrmRenderer);
  }

  // Register vector renderer as final fallback (canHandle always returns true).
  var vectorRenderer = window.OpenPersonaVectorRenderer;
  if (vectorRenderer) {
    reg.register(vectorRenderer);
  }
})();
