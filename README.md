# @acnlabs/avatar-runtime

Provider-agnostic avatar runtime for [OpenPersona](https://github.com/acnlabs/OpenPersona) and any compatible agent.

Handles **virtual avatar rendering only** — Live2D, vector fallback, and future 3D providers.  
Full persona web interaction (chat UI, voice, persona state display) is the responsibility of the consuming application (e.g. OpenPersona Living Canvas).

---

## Scope

```
avatar-runtime
  ├── Node.js runtime server  — provider bridge, session management, faceControl state
  ├── web/                    — browser-side rendering layer
  │     ├── Renderer Registry — plug-in renderer selection (canHandle / createInstance)
  │     ├── AvatarWidget      — embeddable avatar component (<script> or npm)
  │     └── Renderers
  │           ├── live2d-pixi-adapter  — Live2D Cubism 2/4 via pixi-live2d-display
  │           └── vector-renderer      — geometric face fallback, zero dependencies
  └── assets/live2d/          — model slot (default.model.json, default.model3.json)
```

---

## Install

```bash
npm install @acnlabs/avatar-runtime
```

Requires Node.js ≥ 18.

---

## Quick Start — Node.js Server

```bash
# start with mock provider (no API key needed)
AVATAR_PROVIDER=mock npx avatar-runtime

# or from source
cd packages/avatar-runtime
npm start
```

Default endpoint: `http://127.0.0.1:3721`

```bash
# start session
curl -s -X POST http://127.0.0.1:3721/v1/session/start \
  -H 'content-type: application/json' \
  -d '{"personaId":"samantha","form":"image"}'

# send text
curl -s -X POST http://127.0.0.1:3721/v1/input/text \
  -H 'content-type: application/json' \
  -d '{"sessionId":"<from above>","text":"hello"}'

# query status (includes faceControl for the renderer)
curl -s "http://127.0.0.1:3721/v1/status"
```

---

## Browser — AvatarWidget (Recommended)

The simplest way to embed an avatar in any web page.

### Script tag

```html
<!-- load the widget — self-loads registry + renderers automatically -->
<script src="/packages/avatar-runtime/web/avatar-widget.js"></script>

<div id="avatar" style="width:360px;height:360px"></div>

<script>
  var widget = new AvatarWidget(document.getElementById('avatar'), {
    modelUrl:   '/packages/avatar-runtime/assets/live2d/slot/default.model.json',
    stateUrl:   'http://127.0.0.1:3721/v1/status',  // optional — live faceControl polling
    pollMs:     500,
    // vendorBase: '/your/vendor-dist',  // see "Live2D vendor scripts" note below
    width:      360,
    height:     360,
  });

  widget.ready()
    .then(function () { console.log('avatar mounted'); })
    .catch(function (err) { console.error('mount failed', err); });

  // manual faceControl push
  widget.update({ faceControl: { yaw: 0.2, blinkL: 0.8 } });

  // cleanup
  widget.destroy();
</script>
```

> **Live2D vendor scripts** — The Live2D adapter auto-loads `live2d.min.js`, `pixi.min.js`, and
> `cubism2.min.js` from the `vendorBase` directory when a model URL is provided.
> In development the default path `/demo/vendor-dist` works out of the box.
> For production, host these files yourself (or serve them from a CDN) and set `vendorBase`
> accordingly. If no `modelUrl` is set, the vector renderer is used and no vendor scripts are
> needed at all.

### npm / bundler

```js
const AvatarWidget = require('@acnlabs/avatar-runtime/widget');

const widget = new AvatarWidget(container, {
  modelUrl:   '/assets/live2d/slot/default.model.json',
  widgetBase: '/packages/avatar-runtime/web/',  // must point to served web/ directory
});
await widget.ready();
```

### AvatarWidget options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `modelUrl` | string | `''` | Live2D model URL (`.model.json` or `.model3.json`). If empty, falls back to vector renderer. |
| `stateUrl` | string | — | Runtime state endpoint to poll for `faceControl` updates. |
| `pollMs` | number | `500` | Polling interval in ms. |
| `vendorBase` | string | `/demo/vendor-dist` | Directory from which Live2D vendor scripts are auto-loaded. Default works in development; set to your own path in production. |
| `width` | number | `360` | Canvas width in px. |
| `height` | number | `360` | Canvas height in px. |
| `widgetBase` | string | auto | Override the auto-detected `web/` script path. |

### AvatarWidget API

| Method | Description |
|--------|-------------|
| `ready()` | Returns a Promise that resolves when the renderer is mounted. Always add `.catch()`. |
| `update(mediaState)` | Push a new mediaState. Safe to call before `ready()` — buffered and applied on mount. |
| `destroy()` | Stop polling, unmount renderer, clear all state. Widget cannot be reused. |
| `getState()` | Returns current renderer state for debugging. |

---

## Browser — Renderer Registry (Advanced)

For custom renderer integration or programmatic control without `AvatarWidget`.

Load order in HTML:

```html
<script src="/packages/avatar-runtime/web/renderers/live2d-pixi-adapter.js"></script>
<script src="/packages/avatar-runtime/web/renderer-registry.js"></script>
<script src="/packages/avatar-runtime/web/renderers/vector-renderer.js"></script>
<script src="/packages/avatar-runtime/web/index.js"></script>
```

Usage:

```js
var reg = window.OpenPersonaRendererRegistry;

var mediaState = {
  avatarModel3Url: '/packages/avatar-runtime/assets/live2d/slot/default.model.json',
  faceControl: { yaw: 0, pitch: 0, blinkL: 1, blinkR: 1, jawOpen: 0, smile: 0 },
  render: { rendererMode: 'pixi' }
};

// create + mount — auto-selects renderer based on mediaState
reg.create(mediaState, container, { width: 360, height: 360 })
  .then(function (instance) {
    instance.update({ faceControl: { yaw: 0.1 } });
    // instance.unmount() when done
  });

// inspect registered factories
reg.list();   // [Live2DPixiFactory, VectorFactory]
```

### Implementing a custom renderer

Custom renderers must be **registered before `web/index.js` runs** — `web/index.js` registers
the vector fallback last, and because `vector.canHandle()` always returns `true`, any factory
registered after it will never be reached by `resolve()`.

```html
<!-- load registry first -->
<script src="/packages/avatar-runtime/web/renderer-registry.js"></script>

<!-- register your renderer before index.js -->
<script src="/your/my-renderer.js"></script>

<!-- index.js registers pixi + vector after; your renderer stays at the front -->
<script src="/packages/avatar-runtime/web/renderers/live2d-pixi-adapter.js"></script>
<script src="/packages/avatar-runtime/web/renderers/vector-renderer.js"></script>
<script src="/packages/avatar-runtime/web/index.js"></script>
```

```js
// my-renderer.js — define and register before index.js
var MyRendererFactory = {
  canHandle: function (mediaState) {
    return mediaState.render && mediaState.render.rendererMode === 'my-renderer';
  },
  createInstance: function () {
    return {
      mount:   function (container, opts) { /* ... */ return Promise.resolve(); },
      update:  function (mediaState) { /* apply faceControl */ },
      unmount: function () { /* cleanup */ },
    };
  }
};

window.OpenPersonaRendererRegistry.register(MyRendererFactory);
```

Registration order determines priority: first `canHandle()` match wins.

See `web/IRenderer.js` for full JSDoc interface definitions.

---

## Renderer Fallback Chain

```
Live2D pixi renderer  (needs .model.json / .model3.json URL in mediaState)
  → vector renderer   (always available — geometric face, zero external dependencies)
```

The vector renderer is registered as the final fallback and always returns `true` from `canHandle`.  
No model file is ever required to start the system.

---

## Providers (Node.js)

| Provider | Key env var | Notes |
|----------|-------------|-------|
| `mock` | — | Fully local, no API key. Default for development. |
| `heygen` | `HEYGEN_API_KEY` | Real streaming. Set `HEYGEN_STRICT=false` to degrade to mock if key missing. |
| `live2d` | `LIVE2D_ENDPOINT` | Local bridge. Set `LIVE2D_STRICT=false` to degrade to mock. |
| `kusapics` | `KUSAPICS_API_KEY` | Anime-oriented provider. Set `KUSAPICS_STRICT=false` to degrade. |

```bash
AVATAR_PROVIDER=heygen HEYGEN_API_KEY=<key> npm start
```

### Live2D local bridge

```bash
# terminal A — start cubism web bridge (serves live2d model + face rig)
npm run dev:live2d-cubism-bridge
# open http://127.0.0.1:3755/viewer to confirm

# terminal B — start runtime with live2d provider
AVATAR_PROVIDER=live2d LIVE2D_ENDPOINT=http://127.0.0.1:3755 npm start
```

Set a custom model:

```bash
LIVE2D_MODEL3_URL=http://127.0.0.1:8080/models/haru/haru.model3.json \
  npm run dev:live2d-cubism-bridge
```

---

## Assets — Live2D Model Slot

```
assets/live2d/
  slot/
    default.model.json    — Cubism 2 slot pointer (points into chitose/ after setup)
    default.model3.json   — Cubism 4 slot placeholder (replace with real .moc3)
    expressions/          — expression files
    motions/              — motion files
    textures/             — texture files
  licenses/
    LICENSE.txt           — Live2D Free Material License
    ATTRIBUTION.md        — attribution for bundled sample assets
```

**Note:** The `chitose` Cubism 2 sample model ships separately and is not included in the npm package (Free Material License restricts redistribution). To install it locally:

```bash
npm run dev:live2d-cubism-bridge   # auto-fetches chitose on first run
# or
bash scripts/ensure-default-live2d-sample.sh
```

Model source priority (highest to lowest):

1. `LIVING_CANVAS_MODEL3_URL` / `PERSONA_MODEL3_URL` env var
2. `appearance.defaultModel3Url` in `soul/persona.json`
3. `LIVE2D_MODEL3_URL` env var
4. `AVATAR_RUNTIME_DEFAULT_MODEL3_URL` env var
5. `assets/live2d/slot/default.model3.json` (bridge auto-slot)
6. Vector fallback renderer

---

## Package Exports

```json
{
  ".":        "src/runtime.js",       // Node.js runtime entry
  "./web":    "web/index.js",         // browser registry bootstrap
  "./widget": "web/avatar-widget.js"  // embeddable AvatarWidget
}
```

---

## Acceptance Test

```bash
npm run accept:live2d
```

Output: timestamped report in `reports/live2d-acceptance/`.

---

## Contracts & Docs

| Document | Description |
|----------|-------------|
| `docs/CONTRACT.md` | Runtime API contract (endpoint shapes, faceControl schema) |
| `docs/PROVIDER-CONTRACT.md` | Interface every provider must implement |
| `docs/PROVIDER-CAPABILITIES.md` | Provider capability matrix |
| `docs/LIVE2D-BRIDGE-CONTRACT.md` | Live2D bridge protocol |
| `docs/LIVE2D-CUBISM-WEB-BRIDGE.md` | Cubism web bridge setup guide |
| `docs/LIVE2D-ASSET-SPEC.md` | Model asset spec and compliance checklist |

---

## Skill Entry (for agent distribution)

See `skill/avatar-runtime/SKILL.md`.  
Agents using this skill can start a session, send input, and read faceControl state via `curl` without knowing the provider implementation.

---

## License

MIT — see [LICENSE](../../LICENSE) in the root repository.  
Live2D model assets have separate licensing — see `assets/live2d/licenses/`.
