# avatar-runtime Contract (v0.2)

This document defines the runtime-level API contract consumed by OpenPersona bridge scripts and UI clients.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/session/start` | Create a new avatar session |
| `POST` | `/v1/input/text` | Send text for the avatar to speak |
| `POST` | `/v1/input/audio` | Send audio for the avatar to speak |
| `POST` | `/v1/form/switch` | Switch avatar display form (image / model3d / …) |
| `GET`  | `/v1/status` | Poll current runtime & control state |
| `POST` | `/v1/control/set` | **Agent writes full control patch** |
| `POST` | `/v1/control/avatar/set` | Agent writes avatar sub-domain patch |
| `POST` | `/v1/control/scene/set` | Agent writes scene sub-domain patch |

### `POST /v1/control/set`

Allows the agent to set any part of the unified control state. Accepts a partial patch — only the supplied sub-objects/fields are merged; omitted fields retain their current values. Each sub-domain (`avatar.face`, `avatar.body`, `avatar.emotion`, `scene`) is merged independently.

**Request body** (all fields optional, partial patch supported):

```json
{
  "avatar": {
    "face": {
      "pose":  { "yaw": 0.3, "pitch": 0.0, "roll": 0.0 },
      "eyes":  { "blinkL": 0.8, "blinkR": 0.8, "gazeX": 0.1, "gazeY": 0.0 },
      "brows": { "browInner": 0.0, "browOuterL": 0.0, "browOuterR": 0.0 },
      "mouth": { "jawOpen": 0.2, "smile": 0.5, "mouthPucker": 0.0 }
    },
    "emotion": {
      "valence": 0.4, "arousal": 0.2, "label": "content", "intensity": 0.6
    },
    "body": {
      "preset": "idle",
      "skeleton": {
        "leftUpperArm": { "x": 0, "y": 0, "z": -20 },
        "rightUpperArm": { "x": 0, "y": 0, "z": 20 }
      }
    }
  },
  "scene": {
    "camera": { "fov": 35, "position": { "x": 0, "y": 1.4, "z": 2.0 } },
    "world":  { "ambientLight": 0.5, "keyLight": { "intensity": 1.2 } }
  }
}
```

**Response** `200 OK`:

```json
{
  "ok": true,
  "control": { "avatar": { ... }, "scene": { ... } }
}
```

### `POST /v1/control/avatar/set`

Convenience shorthand — body is treated as the `avatar` sub-domain patch only.

```json
{
  "face": { "mouth": { "smile": 0.8 } },
  "emotion": { "label": "happy", "valence": 0.9 }
}
```

### `POST /v1/control/scene/set`

Convenience shorthand — body is treated as the `scene` sub-domain patch only.

```json
{
  "camera": { "fov": 45 },
  "world": { "background": "#001133" }
}
```

**Priority:** Agent-written values serve as the baseline for each sub-domain. If the provider returns live data with `source !== "agent"` (e.g. face capture, streaming), the provider values overlay the agent baseline for that sub-domain.

## control Schema

### control.avatar.face

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `pose.yaw` | number | −1..1 | Head turn left/right |
| `pose.pitch` | number | −1..1 | Head tilt up/down |
| `pose.roll` | number | −1..1 | Head side tilt |
| `eyes.blinkL` | number | 0..1 | Left eye openness (1=open, 0=closed) |
| `eyes.blinkR` | number | 0..1 | Right eye openness (1=open, 0=closed) |
| `eyes.gazeX` | number | −1..1 | Eye horizontal gaze |
| `eyes.gazeY` | number | −1..1 | Eye vertical gaze |
| `brows.browInner` | number | 0..1 | Inner brow raise |
| `brows.browOuterL/R` | number | 0..1 | Outer brow raise |
| `mouth.jawOpen` | number | 0..1 | Jaw open amount |
| `mouth.smile` | number | 0..1 | Smile amount |
| `mouth.mouthPucker` | number | 0..1 | Pucker amount |
| `source` | string | — | `"agent"` \| `"provider"` \| `"capture"` |

**Note:** Vector renderer supports `face` sub-domain only. `body` and `scene` are dead signals for vector — stored but silently ignored.

### control.avatar.emotion

Uses the Russell Circumplex Model for semantic emotion.

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `valence` | number | −1..1 | Negative ↔ positive affect |
| `arousal` | number | −1..1 | Calm ↔ excited |
| `label` | string | — | Optional label: `neutral`, `happy`, `sad`, `angry`, `surprised`, … |
| `intensity` | number | 0..1 | Overall emotion strength |
| `source` | string | — | `"agent"` \| `"provider"` \| `"capture"` |

Renderers that support `faceRig` use `emotion.label` to set a VRM expression preset (happy/sad/angry/surprised/relaxed). Emotion is applied **after** face mechanical parameters, so it wins for expression presets. Agents should use `face.mouth.smile` OR `emotion.label` for smile/expression — not both simultaneously, as emotion overrides the same VRM blend shape.

### control.avatar.body

| Field | Type | Description |
|-------|------|-------------|
| `preset` | string | Named body pose: `idle`, `wave`, `thinking`, `bow`, … |
| `skeleton` | object | Per-bone Euler angles (degrees): `{x,y,z}` for each VRM humanoid bone |
| `ik.leftHand / rightHand` | object | IK target `{position, weight}` |
| `source` | string | `"agent"` \| `"provider"` \| `"capture"` |

Supported skeleton keys: `hips`, `spine`, `chest`, `neck`, `leftUpperArm`, `leftLowerArm`, `rightUpperArm`, `rightLowerArm`, `leftUpperLeg`, `rightUpperLeg`.

### control.scene

| Field | Type | Description |
|-------|------|-------------|
| `camera.position` | `{x,y,z}` | Camera world position |
| `camera.target` | `{x,y,z}` | Camera look-at target |
| `camera.fov` | number | Vertical field of view (degrees) |
| `world.background` | string | CSS color string |
| `world.ambientLight` | number | Ambient light intensity (0..2) |
| `world.keyLight.intensity` | number | Key (directional) light intensity |
| `world.keyLight.direction` | `{x,y,z}` | Key light direction vector |
| `props` | array | Scene prop descriptors (reserved, not yet consumed) |

## Status Response (Canonical Shape)

```json
{
  "runtime": "avatar-runtime",
  "contractVersion": "0.2",
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
    "streaming": true,
    "bodyRig": false,
    "sceneControl": false
  },
  "visualManifest": { "version": "0.1" },
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
  "control": {
    "avatar": {
      "face": {
        "pose":  { "yaw": 0, "pitch": 0, "roll": 0 },
        "eyes":  { "blinkL": 1, "blinkR": 1, "gazeX": 0, "gazeY": 0 },
        "brows": { "browInner": 0, "browOuterL": 0, "browOuterR": 0 },
        "mouth": { "jawOpen": 0, "smile": 0, "mouthPucker": 0 },
        "source": "agent",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      },
      "body": {
        "preset": "idle",
        "skeleton": { "hips": { "x": 0, "y": 0, "z": 0 }, "..." : "..." },
        "ik": { "leftHand": { "position": { "x": 0, "y": 0, "z": 0 }, "weight": 0 }, "..." : "..." },
        "source": "agent",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      },
      "emotion": {
        "valence": 0, "arousal": 0, "label": "neutral", "intensity": 0.5,
        "source": "agent",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      }
    },
    "scene": {
      "camera": { "position": { "x": 0, "y": 1.5, "z": 3 }, "target": { "x": 0, "y": 1, "z": 0 }, "fov": 45 },
      "world": {
        "background": "#111111",
        "ambientLight": 0.4,
        "keyLight": { "intensity": 1.0, "direction": { "x": 1, "y": 2, "z": 1 } }
      },
      "props": [],
      "source": "agent",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
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

- `contractVersion` MUST be `"0.2"`.
- `capabilities` MUST always include all six keys.
- `providerCapabilities` MUST include: `faceRig`, `lipSync`, `gaze`, `blink`, `bodyMotion`, `streaming`, `bodyRig`, `sceneControl`.
- `visualManifest` MAY be partial but MUST include `version` when present.
- `appearanceIntent` SHOULD be present.
- `control` MUST be present in status responses; it replaces the legacy `faceControl` field removed in v0.2.
- `control.avatar.face.eyes.blinkL/R` default is `1` (open eyes); `0` means fully closed.
- `source` indicates who last wrote the data: `"agent"` (via `/v1/control/set`), `"provider"` (streaming / face capture), or `"capture"` (real-time input). Provider or capture source overrides agent baseline in the merged status response.
- Partial patches are supported at sub-domain level. Each sub-domain merges independently — patching `avatar.face.mouth.smile` does not clobber `avatar.face.eyes`.
- Renderers that do not support `bodyRig` or `sceneControl` treat those sub-domains as dead signals: they are stored in state but silently ignored by the renderer.
- Sensitive fields (such as access tokens) SHOULD be redacted before persistence.
- Runtime SHOULD return stable types even when provider is unavailable (use `degrade`).
