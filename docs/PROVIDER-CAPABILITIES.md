# Provider Capabilities Matrix (v0.1)

This matrix defines execution-layer features exposed by each avatar provider.

## Capability Keys

- `faceRig`: provider can consume face rig controls (`control.avatar.face` payload)
- `lipSync`: provider can drive mouth/viseme from text/audio
- `gaze`: provider can control eye target / look-at
- `blink`: provider supports blink control
- `bodyMotion`: provider supports upper-body/gesture motion (cloud-driven)
- `streaming`: provider supports realtime session streaming
- `bodyRig`: provider exposes direct skeleton joint control (`control.avatar.body.skeleton`)
- `sceneControl`: provider supports camera and world/lighting scene control (`/v1/control/scene/set`)

## Current Providers

| Provider | faceRig | lipSync | gaze | blink | bodyMotion | streaming | bodyRig | sceneControl |
|----------|:-------:|:-------:|:----:|:-----:|:----------:|:---------:|:-------:|:------------:|
| `mock`     | yes | no  | yes | yes | no  | no  | no  | no  |
| `heygen`   | yes | yes | no  | no  | yes | yes | no  | no  |
| `live2d`   | yes | yes | yes | yes | no  | no  | no  | no  |
| `vrm`      | yes | no  | yes | yes | no  | no  | yes | yes |
| `kusapics` | no  | no  | no  | no  | no  | no  | no  | no  |

## Notes

- Runtime status always returns a normalized `providerCapabilities` object, even if a provider omits fields.
- `bodyRig` and `sceneControl` are currently VRM-only; they map to client-side Three.js transforms via `vrm-asset-server`.
- `live2d` face/expression control is fully implemented via `live2d-cubism-web-bridge`; `bodyMotion` plays automatically from the model's built-in motion data.
- HeyGen `bodyMotion` is server-driven (avatar video stream); direct skeleton control is not exposed.
