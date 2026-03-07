# AGENTS.md — @acnlabs/avatar-runtime

Provider-agnostic virtual avatar runtime. Exposes a session HTTP API consumed by
OpenPersona and standalone frontends. Renderers live in `web/`; server logic in `src/`.

## Dev commands

```bash
# Start server (mock provider — no API key needed)
npm run dev                          # port 3721

# Start with Live2D local bridge
npm run dev:live2d-cubism-bridge     # terminal A — bridge on :3755
AVATAR_PROVIDER=live2d LIVE2D_ENDPOINT=http://127.0.0.1:3755 npm start   # terminal B

# Mock Live2D bridge (no Cubism SDK required)
npm run mock:live2d-bridge
```

## Testing

```bash
# Full acceptance suite (Live2D end-to-end, requires both bridge + runtime)
# Runs bridges/live2d-cubism-web-bridge.js automatically
npm run accept:live2d
```

No unit-test runner is configured yet. Add `node:test` specs under `tests/` when introducing logic branches.

## Project layout

```
bin/avatar-runtime.js      ← CLI entry (--port flag; PORT env var as fallback)
src/
  server.js                ← HTTP server (routes → AvatarRuntime)
  runtime.js               ← Core session state machine
  providers/
    index.js               ← createProvider() factory
    provider-mock.js       ← Zero-config provider (no API key needed)
    provider-heygen.js     ← HeyGen streaming
    provider-live2d.js     ← Local Live2D bridge adapter
    provider-kusapics.js   ← KusaPics anime API
web/
  renderer-registry.js     ← Browser renderer registry (window.OpenPersonaRendererRegistry)
  renderers/
    live2d-pixi-adapter.js ← Live2D Cubism 2 renderer
    vector-renderer.js     ← Geometric face fallback
  avatar-widget.js         ← Drop-in embeddable widget
  index.js                 ← Registers renderers on load
  IRenderer.js             ← JSDoc interfaces (IRendererFactory / IRendererInstance)
bridges/
  live2d-cubism-web-bridge.js  ← Full Cubism 4 web bridge (requires SDK)
  live2d-bridge-mock.js        ← Lightweight mock bridge
scripts/                             ← published to npm
  ensure-default-live2d-sample.sh  ← Download chitose sample for local dev only
dev-scripts/                        ← NOT published (CI/testing tools)
  accept-live2d.sh                 ← Live2D acceptance test runner
docs/
  CONTRACT.md                  ← HTTP API contract (canonical reference)
  PROVIDER-CONTRACT.md         ← Provider interface spec
  PROVIDER-CAPABILITIES.md     ← Capability flags reference
  LIVE2D-BRIDGE-CONTRACT.md    ← Bridge HTTP protocol
  LIVE2D-ASSET-SPEC.md         ← Live2D asset layout spec
  LIVE2D-CUBISM-WEB-BRIDGE.md  ← Cubism web bridge integration guide
skill/avatar-runtime/      ← Agent skill pack (SKILL.md + references/)
```

## API endpoints

All routes documented in `docs/CONTRACT.md`. Key ones:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/session/start` | Start a new avatar session |
| `POST` | `/v1/input/text` | Send text to active session |
| `POST` | `/v1/input/audio` | Send audio to active session |
| `POST` | `/v1/form/switch` | Switch avatar form (image / face / voice) |
| `GET`  | `/v1/status` | Current session state + faceControl |
| `GET`  | `/health` | Liveness check |

## Adding a provider

1. Create `src/providers/provider-<name>.js` — export `{ <Name>Provider }` class matching `docs/PROVIDER-CONTRACT.md`
2. `require` and register the class in `src/providers/index.js` `createProvider()` switch
3. Document env vars in `README.md` provider table and `skill/avatar-runtime/SKILL.md`

## Adding a renderer

1. Create `web/renderers/<name>-renderer.js` — implement `IRendererFactory` + `IRendererInstance` (see `web/IRenderer.js`)
2. Register in `web/index.js` before `vector-renderer` (catch-all, must be last)
3. `canHandle(mediaState)` must return `false` if mediaState doesn't match; `vector-renderer` always returns `true`

## Code style

- **CommonJS** (`require` / `module.exports`) — no ES modules, no transpilation
- **Node.js ≥ 18** — no polyfills needed
- Single quotes, semicolons at line endings
- `web/` files must be zero-dependency browser JS (no `require`, no bundler)

## Environment variables

See `.env.example` for full list. Key vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `AVATAR_PROVIDER` | `heygen` | Active provider (`npm run dev` overrides to `mock`) |
| `PORT` | `3721` | HTTP listen port |
| `LIVE2D_ENDPOINT` | — | Live2D bridge URL (required when provider=live2d) |
| `HEYGEN_API_KEY` | — | HeyGen API key |
