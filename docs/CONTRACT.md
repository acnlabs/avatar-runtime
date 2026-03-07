# avatar-runtime Contract (v0.1)

This document defines the runtime-level API contract consumed by OpenPersona bridge scripts and UI clients.

## Endpoints

- `POST /v1/session/start`
- `POST /v1/input/text`
- `POST /v1/input/audio`
- `POST /v1/form/switch`
- `GET /v1/status?sessionId=<optional>`

## Status Response (Canonical Shape)

```json
{
  "runtime": "avatar-runtime",
  "contractVersion": "0.1",
  "provider": "heygen",
  "available": true,
  "degrade": null,
  "capabilities": {
    "image": true,
    "model3d": false,
    "motion": true,
    "voice": true,
    "hearing": true,
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
    "avatarVideo": null,
    "livekitUrl": null,
    "livekitAccessToken": null,
    "realtimeEndpoint": null
  },
  "session": {
    "sessionId": "local-session-id",
    "personaId": "samantha",
    "form": "image",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## Rules

- `contractVersion` MUST be present.
- `capabilities` MUST always include all six keys.
- `providerCapabilities` MUST include: `faceRig|lipSync|gaze|blink|bodyMotion|streaming`.
- `visualManifest` MAY be partial but MUST include `version` when present.
- `appearanceIntent` SHOULD be present; current Canvas renderer consumes `face` / `auto`.
- `faceControl` SHOULD be present when agent-driven facial control is enabled.
- `faceControl` semantic intent MUST be produced by the agent/runtime decision layer.
- Bridge/UI layers MAY clamp/validate numeric ranges but MUST NOT invent expression policy.
- Sensitive fields (such as access tokens) SHOULD be redacted before persistence.
- Runtime SHOULD return stable types even when provider is unavailable (use `degrade`).
