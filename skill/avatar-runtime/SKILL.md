---
name: avatar-runtime
description: >
  Embeds and controls a virtual avatar using @acnlabs/avatar-runtime.
  Provides Live2D rendering, vector fallback, and faceControl-driven expression animation
  via a provider-agnostic session bridge.
  Use when the user asks for a virtual avatar, face-control animation, Live2D character,
  avatar widget embedding, or when starting/stopping an avatar session.
allowed-tools: Bash(node:*) Bash(curl:*) Bash(npm:*)
---

# Avatar Runtime Skill

## Runtime endpoint

Default: `http://127.0.0.1:3721`  
Override: `AVATAR_RUNTIME_URL` env var (default applied automatically if unset).

```bash
export AVATAR_RUNTIME_URL="${AVATAR_RUNTIME_URL:-http://127.0.0.1:3721}"
```

## First-time setup

The Live2D slot (`assets/live2d/slot/`) requires a model file before the `live2d` provider can render.

**Option A — Use your own model** (recommended):  
Copy any Cubism 2 (`.model.json`) or Cubism 4 (`.model3.json`) model you hold a license for into `assets/live2d/slot/`, named `default.model.json` / `default.model3.json`.

**Option B — Local dev bootstrap only** (risk acknowledged):

```bash
# Run from the package root (where package.json lives)
bash scripts/ensure-default-live2d-sample.sh
```

Downloads `chitose` from the npm package `live2d-widget-model-chitose@1.0.5` for local testing.  
⚠️ The original model is subject to the [Live2D Free Material License](https://www.live2d.com/en/sdk/license/free-material/), which prohibits redistribution and commercial use. Do **not** deploy or distribute with this model.

## Starting the server

```bash
# zero-config (mock provider — no API key required)
AVATAR_PROVIDER=mock npx avatar-runtime

# with Live2D local bridge
npm run dev:live2d-cubism-bridge          # terminal A — bridge on :3755
AVATAR_PROVIDER=live2d LIVE2D_ENDPOINT=http://127.0.0.1:3755 npx avatar-runtime  # terminal B
```

## Session API

```bash
# start session
curl -s -X POST "$AVATAR_RUNTIME_URL/v1/session/start" \
  -H "content-type: application/json" \
  -d '{"personaId":"{{slug}}","form":"image"}'

# send text to active session
curl -s -X POST "$AVATAR_RUNTIME_URL/v1/input/text" \
  -H "content-type: application/json" \
  -d '{"sessionId":"<sessionId>","text":"hello"}'

# query current state (includes faceControl for renderer)
curl -s "$AVATAR_RUNTIME_URL/v1/status"
```

## Embedding an avatar widget (browser)

Minimal script-tag usage — vendor scripts are auto-loaded:

```html
<script src="/packages/avatar-runtime/web/avatar-widget.js"></script>
<div id="avatar" style="width:360px;height:360px"></div>
<script>
  var widget = new AvatarWidget(document.getElementById('avatar'), {
    modelUrl: '/packages/avatar-runtime/assets/live2d/slot/default.model.json',
    stateUrl: 'http://127.0.0.1:3721/v1/status',   // live faceControl polling
    pollMs:   500,
    // vendorBase: '/your/vendor-dist',              // required for Live2D in production
  });
  widget.ready().catch(function(e) { console.error(e); });
</script>
```

Without a model (vector fallback — no files needed):

```html
<script src="/packages/avatar-runtime/web/avatar-widget.js"></script>
<div id="avatar" style="width:360px;height:360px"></div>
<script>
  new AvatarWidget(document.getElementById('avatar'), {
    stateUrl: 'http://127.0.0.1:3721/v1/status'
  });
</script>
```

## Driving face expressions manually

`update()` accepts a mediaState with a `faceControl` object.  
Safe to call before `ready()` resolves — buffered and applied on mount.

```js
widget.update({
  faceControl: {
    yaw:     0.2,   // head turn left/right  (-1..1)
    pitch:   0.1,   // head tilt up/down     (-1..1)
    roll:    0,     // head rotation         (-1..1)
    blinkL:  0.9,   // left eye open         (0=closed, 1=open)
    blinkR:  0.9,
    gazeX:   0,     // eyeball direction     (-1..1)
    gazeY:   0,
    jawOpen: 0.3,   // mouth open            (0..1)
    smile:   0.5,   // mouth form            (0=neutral, 1=smile)
  }
});
```

## faceControl from runtime state

The `/v1/status` response includes a `faceControl` field produced by the active provider.  
`AvatarWidget` with `stateUrl` polls this automatically at `pollMs` interval.

For manual polling:

```bash
curl -s "$AVATAR_RUNTIME_URL/v1/status" | jq .faceControl
```

## Provider configuration

| Provider | Env vars | Notes |
|----------|----------|-------|
| `mock` | — | Development default, no key needed |
| `heygen` | `HEYGEN_API_KEY` | Real streaming. `HEYGEN_STRICT=false` degrades to mock |
| `live2d` | `LIVE2D_ENDPOINT` | Local bridge required. `LIVE2D_STRICT=false` degrades |
| `kusapics` | `KUSAPICS_API_KEY`, `KUSAPICS_BASE_URL` | Anime-oriented |

## Fallback policy

If the runtime is unavailable or returns an error:
- Continue interaction in text mode
- Inform the user avatar mode is currently unavailable
- Do not claim rendering or voice playback succeeded

## Additional reference

- [WEB-EMBEDDING.md](references/WEB-EMBEDDING.md) — Renderer Registry, custom renderer implementation, npm usage
