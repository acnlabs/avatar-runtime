# Web Embedding Reference

Detailed reference for embedding `avatar-runtime` in browser applications.

## AvatarWidget options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `modelUrl` | string | `''` | Live2D model URL. Empty → vector renderer (no vendor scripts needed). |
| `stateUrl` | string | — | Runtime `/v1/status` URL for live faceControl polling. |
| `pollMs` | number | `500` | Polling interval in ms. |
| `vendorBase` | string | `/demo/vendor-dist` | Directory for auto-loaded Live2D vendor scripts. Dev default only — set for production. |
| `width` | number | `360` | Canvas width in px. |
| `height` | number | `360` | Canvas height in px. |
| `widgetBase` | string | auto | Override `web/` script path when auto-detection fails. |

## AvatarWidget API

| Method | Description |
|--------|-------------|
| `ready()` | Promise — resolves when mounted. Always add `.catch()`. |
| `update(mediaState)` | Push mediaState. Buffered if called before `ready()`. |
| `destroy()` | Stop polling, unmount renderer. Irreversible. |
| `getState()` | Returns renderer internal state (debug). |

## npm / bundler usage

```js
const AvatarWidget = require('@acnlabs/avatar-runtime/widget');
const widget = new AvatarWidget(container, {
  modelUrl:   '/assets/live2d/slot/default.model.json',
  widgetBase: '/packages/avatar-runtime/web/',  // must be served statically
});
await widget.ready();
```

## Renderer Registry (advanced)

For programmatic control or custom renderer integration.

Load order matters — vector renderer has `canHandle: () => true` and must be last.

```html
<!-- custom renderer BEFORE index.js to take priority over vector fallback -->
<script src="/packages/avatar-runtime/web/renderer-registry.js"></script>
<script src="/your/custom-renderer.js"></script>
<script src="/packages/avatar-runtime/web/renderers/live2d-pixi-adapter.js"></script>
<script src="/packages/avatar-runtime/web/renderers/vector-renderer.js"></script>
<script src="/packages/avatar-runtime/web/index.js"></script>
```

```js
// use registry directly
var reg = window.OpenPersonaRendererRegistry;
reg.create(
  { avatarModel3Url: '/path/to/model.json', render: { rendererMode: 'pixi' } },
  container,
  { width: 360, height: 360 }
).then(function(instance) {
  instance.update({ faceControl: { yaw: 0.1 } });
  // instance.unmount() when done
});
```

## Custom renderer skeleton

```js
window.OpenPersonaRendererRegistry.register({
  canHandle: function(mediaState) {
    return mediaState.render && mediaState.render.rendererMode === 'my-renderer';
  },
  createInstance: function() {
    return {
      mount:   function(container, opts) { return Promise.resolve(); },
      update:  function(mediaState) { /* read mediaState.faceControl */ },
      unmount: function() { /* cleanup */ },
    };
  }
});
```

See `web/IRenderer.js` for full interface JSDoc.

## Package exports

```
@acnlabs/avatar-runtime          → src/runtime.js   (Node.js server)
@acnlabs/avatar-runtime/web      → web/index.js     (registry bootstrap)
@acnlabs/avatar-runtime/widget   → web/avatar-widget.js
```
