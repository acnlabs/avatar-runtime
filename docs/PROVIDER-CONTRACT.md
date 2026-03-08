# Provider Contract (v0.2)

Each provider adapter must implement the same method set so that runtime logic stays provider-agnostic.

## Required Methods

```js
startSession(payload) => Promise<object>
sendText({ session, text }) => Promise<object>
sendAudio({ session, audioUrl, audioBase64 }) => Promise<object>
switchForm({ session, form }) => Promise<object>
status({ session }) => Promise<object>
```

## Optional Methods

```js
closeSession({ session }) => Promise<object>
```

## status() Return Shape (Provider-side)

Providers return **face-driving data** via the legacy `faceControl` field (still accepted by the runtime for backwards compatibility in the merging layer). The runtime maps `faceControl → control.avatar.face` and `faceControl.emotion → control.avatar.emotion` before exposing the unified `control` namespace in the status response.

```json
{
  "capabilities": {
    "image": true,
    "model3d": false,
    "motion": true,
    "voice": true,
    "hearing": false,
    "worldSense": false
  },
  "providerCapabilities": {
    "faceRig": true,
    "lipSync": true,
    "gaze": false,
    "blink": false,
    "bodyMotion": true,
    "streaming": true,
    "bodyRig": false,
    "sceneControl": false
  },
  "degrade": null,
  "visualManifest": {
    "version": "0.1"
  },
  "appearanceIntent": {
    "version": "0.1",
    "form": "auto",
    "style": "default",
    "transition": "smooth",
    "priority": "agent",
    "lockSeconds": 0,
    "reason": "",
    "source": "agent",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "faceControl": {
    "pose": { "yaw": 0, "pitch": 0, "roll": 0 },
    "eyes": { "blinkL": 1, "blinkR": 1, "gazeX": 0, "gazeY": 0 },
    "brows": { "browInner": 0, "browOuterL": 0, "browOuterR": 0 },
    "mouth": { "jawOpen": 0, "smile": 0, "mouthPucker": 0 },
    "source": "provider",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "media": {
    "avatarImage": null,
    "avatarVideo": null
  },
  "providerSessionId": null
}
```

## providerCapabilities Field Reference

| Capability | Type | Description |
|------------|------|-------------|
| `faceRig` | bool | Provider can drive face expressions (via `faceControl`) |
| `lipSync` | bool | Provider performs lip-sync from audio |
| `gaze` | bool | Provider drives eye gaze direction |
| `blink` | bool | Provider drives eye blink |
| `bodyMotion` | bool | Provider generates body motion (e.g. streaming avatar video) |
| `streaming` | bool | Provider uses WebRTC / LiveKit streaming |
| `bodyRig` | bool | **Renderer capability**: renderer can apply `control.avatar.body` skeleton data. Set by the provider whose renderer supports body rigging (e.g. VRM renderer). |
| `sceneControl` | bool | **Renderer capability**: renderer can apply `control.scene` (camera, lighting). Set by the provider whose renderer supports scene manipulation (e.g. VRM renderer). |

**Important distinction:** `bodyRig` and `sceneControl` are **renderer capabilities**, not upstream provider capabilities. They are declared by the provider whose associated renderer supports these control domains (e.g. `VrmProvider` sets both to `true`). Providers backed by video streaming (HeyGen, D-ID) do not set these since their rendering is server-side and not accessible to the local renderer.

## Error Handling

- Throw `Error` with `statusCode` when transport/configuration fails.
- Prefer explicit `degrade` in `status()` over throwing for temporary unavailability.
- Keep provider-specific payloads nested, never break canonical top-level keys.
- `appearanceIntent.form` should stay in `auto|face` for current Canvas renderer compatibility.
- `faceControl` values should be normalized into stable numeric ranges before return.
  - `eyes.blinkL/R`: `1` = open, `0` = closed.
- Provider/bridge layers must treat `faceControl` as face-driving data only; emotion semantics are injected via `faceControl.emotion` (legacy) or the future `emotion` top-level field.
- Do not auto-generate expression policy in renderer code — expression intent MUST come from the agent via `/v1/control/set`.
- `providerCapabilities` should be returned when possible; runtime will normalize missing fields to stable booleans.
