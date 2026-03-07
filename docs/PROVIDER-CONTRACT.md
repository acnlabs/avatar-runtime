# Provider Contract (v0.1)

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
    "streaming": true
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
    "eyes": { "blinkL": 0, "blinkR": 0, "gazeX": 0, "gazeY": 0 },
    "brows": { "browInner": 0, "browOuterL": 0, "browOuterR": 0 },
    "mouth": { "jawOpen": 0, "smile": 0, "mouthPucker": 0 },
    "emotion": { "calm": 0.6, "intensity": 0.5 },
    "source": "agent",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "media": {
    "avatarImage": null,
    "avatarVideo": null
  },
  "providerSessionId": null
}
```

## Error Handling

- Throw `Error` with `statusCode` when transport/configuration fails.
- Prefer explicit `degrade` in `status()` over throwing for temporary unavailability.
- Keep provider-specific payloads nested, never break canonical top-level keys.
- `appearanceIntent.form` should stay in `auto|face` for current Canvas renderer compatibility.
- `faceControl` values should be normalized into stable numeric ranges before return.
- Provider/bridge layers must treat `faceControl` as agent-owned semantics; do not auto-generate emotional policy in renderer code.
- `providerCapabilities` should be returned when possible; runtime will normalize missing fields to stable booleans.
