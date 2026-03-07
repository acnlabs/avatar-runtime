# Provider Capabilities Matrix (v0.1)

This matrix defines execution-layer features exposed by each avatar provider.

## Capability Keys

- `faceRig`: provider can consume face rig controls (e.g. `faceControl` payload)
- `lipSync`: provider can drive mouth/viseme from text/audio
- `gaze`: provider can control eye target / look-at
- `blink`: provider supports blink control
- `bodyMotion`: provider supports upper-body/gesture motion
- `streaming`: provider supports realtime session streaming

## Current Providers

| Provider | faceRig | lipSync | gaze | blink | bodyMotion | streaming |
|---|---:|---:|---:|---:|---:|---:|
| `mock` | yes | no | yes | yes | no | no |
| `heygen` | yes | yes | no | no | yes | yes |
| `kusapics` | no | no | no | no | no | no |
| `live2d` (skeleton) | yes | yes | yes | yes | no | no |

## Notes

- `live2d` is currently a skeleton adapter; marked capabilities represent target integration intent.
- Runtime status always returns a normalized `providerCapabilities` object, even if provider omits fields.
