# Changelog

All notable changes to `@acnlabs/avatar-runtime` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.2.0] — 2026-03-08

### Breaking changes

- **`/v1/face/set` removed.** Use `/v1/control/avatar/set` with a `face` sub-object instead.
- **`faceControl` field in status response removed.** Control state is now at `control.avatar.face` (and `control.avatar.emotion`, `control.avatar.body`, `control.scene`).  
  Legacy `faceControl` keys in state JSON are still read by the living canvas for backward compatibility, but new integrations should use `control.avatar.face`.

### Added

#### Control namespace (`control`)
- New unified `control` namespace replaces the legacy `faceControl` top-level field.
- Three new HTTP endpoints:
  - `POST /v1/control/set` — full patch (avatar + scene in one call)
  - `POST /v1/control/avatar/set` — avatar sub-namespace (face / emotion / body)
  - `POST /v1/control/scene/set` — scene sub-namespace (camera / world lighting)
- All patches are deep-merged per sub-domain; updating `mouth.smile` does not clobber `eyes`.
- `contractVersion` in status response bumped to `"0.2"`.

#### VRM 3D avatar provider
- New `vrm` provider (`AVATAR_PROVIDER=vrm`).
- `bridges/vrm-asset-server.js` — Express server that serves `.vrm` model files over HTTP (default port 3756).
- `scripts/ensure-default-vrm-sample.sh` — one-time download of a free CC BY 4.0 sample VRM from `@pixiv/three-vrm`.
- Provider capabilities: `faceRig`, `gaze`, `blink`, `bodyRig`, `sceneControl`.
- `applyBodyControl` — maps `control.avatar.body.skeleton` joint rotations to Three.js VRM humanoid bones.
- `applySceneControl` — maps `control.scene.camera` and `control.scene.world` to Three.js camera and light properties.
- `applyEmotionControl` — maps `emotion.label` to VRM expression presets (`happy`, `angry`, `sad`, `relaxed`, `surprised`, `neutral`).

#### Browser rendering layer
- **Renderer Registry** (`web/renderer-registry.js`) — plug-in `IRendererFactory` pattern; `register` / `resolve` / `create` / `list`.
- **`AvatarWidget`** (`web/avatar-widget.js`) — drop-in script-tag embed; auto-loads vendor scripts; `ready()` / `update()` / `destroy()` / `getState()` API; pre-ready `update()` buffering.
- **`live2d-pixi-adapter`** — `IRendererFactory` wrapper for the existing pixi-based Live2D renderer; `canHandle` / `factory.createInstance()` interface; backward-compatible `create()` entry point preserved.
- **Vector renderer** (`web/renderers/vector-renderer.js`) — geometric face fallback; always-true `canHandle`; zero dependencies.
- **`web/index.js`** — bootstraps registry with pixi adapter + vector fallback on `DOMContentLoaded`.
- **`web/demo.html`** — interactive multi-renderer demo with emotion, body pose, and scene controls.

#### Live2D rendering
- `bridges/live2d-cubism-web-bridge.js` — production Cubism 2/4 bridge (replaces the `examples/` skeleton).
- `applyEmotionControl` on the pixi adapter — maps `emotion.label` to model expression candidates.

#### Docs & tooling
- `docs/CONTRACT.md` — full HTTP API contract with schema examples.
- `docs/PROVIDER-CONTRACT.md`, `docs/PROVIDER-CAPABILITIES.md` — provider integration guide and capability matrix.
- `docs/LIVE2D-BRIDGE-CONTRACT.md`, `docs/LIVE2D-CUBISM-WEB-BRIDGE.md`, `docs/LIVE2D-ASSET-SPEC.md` — Live2D bridge protocol specs.
- `skill/avatar-runtime/SKILL.md` — agent-facing skill pack with VRM, HeyGen, and Live2D quick-start guides.
- `skill/avatar-runtime/references/WEB-EMBEDDING.md` — browser embedding reference (Renderer Registry, npm usage).
- `AGENTS.md` — contributor guide for providers, renderers, and code style.
- `.github/workflows/live2d-acceptance.yml` — CI acceptance check for Live2D bridge.
- `dev-scripts/accept-live2d.sh` — local acceptance runner (not published to npm).

#### Package
- `package.json` exports: added `./web` → `web/index.js` and `./widget` → `web/avatar-widget.js`.
- `repository`, `author`, `keywords` fields added.
- `assets/live2d/licenses/` — attribution and license templates for Live2D model slot.

### Changed

- HeyGen provider: replaced placeholder stubs with real `streaming.new` / `streaming.start` / `streaming.task` / `streaming.stop` REST calls; strict API key mode (`HEYGEN_STRICT=true`); graceful mock fallback when `HEYGEN_STRICT=false` (default).
- Live2D pixi adapter: now implements full `IRendererFactory` interface (`canHandle` + `factory.createInstance()`); backward-compatible `create()` still present.
- `runtime._mergeControl`: maps legacy provider `faceControl` field to `control.avatar.face` for zero-migration compatibility.

---

## [0.1.0] — 2026-03-04

Initial release — MVP scaffold.

### Added

- Node.js HTTP server (`src/server.js`) — session lifecycle (`/v1/session/start`, `/v1/session/stop`), text input (`/v1/input/text`), status (`/v1/status`).
- Provider abstraction (`src/providers/index.js`) — selects provider from `AVATAR_PROVIDER` env var.
- `mock` provider — development default; returns deterministic face control and session state; no API key required.
- `heygen` provider — initial HeyGen API integration (placeholder streaming stubs, replaced in 0.2.0).
- `kusapics` provider — anime-oriented image provider skeleton.
- CLI entry (`bin/avatar-runtime.js`) — `npx avatar-runtime [--port N]`.
- `skill/avatar/SKILL.md` — initial agent skill pack.
- `.env.example` — environment variable reference.

[0.2.0]: https://github.com/acnlabs/avatar-runtime/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/acnlabs/avatar-runtime/releases/tag/v0.1.0
