# Live2D Cubism Web Bridge (dev)

This bridge is a local execution adapter for `provider-live2d`.
It keeps OpenPersona semantics (`faceControl`) and maps them to Cubism-style parameters.

## Start

```bash
cd packages/avatar-runtime
npm run dev:live2d-cubism-bridge
```

Default URL: `http://127.0.0.1:3755`

- Viewer page: `http://127.0.0.1:3755/viewer`
- Health: `http://127.0.0.1:3755/health`

Default model auto-slot:

- If `LIVE2D_MODEL3_URL` is not provided, bridge will auto-detect:
  - `assets/live2d/slot/default.model3.json`
- The bridge exposes this folder over HTTP under:
  - `/assets/live2d/slot/*`
- This enables zero-config startup once default assets are placed in the template slot.

## What it provides

- HTTP bridge contract required by `provider-live2d`
- Session-scoped state
- `faceControl` updates from text/audio input
- Mapping preview in status payload (`debug.cubismParams`)

## Current parameter mapping

- `pose.yaw` -> `ParamAngleX`
- `pose.pitch` -> `ParamAngleY`
- `pose.roll` -> `ParamAngleZ`
- `eyes.gazeX` -> `ParamEyeBallX`
- `eyes.gazeY` -> `ParamEyeBallY`
- `eyes.blinkL` -> `ParamEyeLOpen` (inverted)
- `eyes.blinkR` -> `ParamEyeROpen` (inverted)
- `mouth.jawOpen` -> `ParamMouthOpenY`
- `mouth.smile - mouth.mouthPucker` -> `ParamMouthForm`

## Notes

- This is a dev bridge and visualizer. Replace the viewer rendering section with real Cubism Web SDK model binding for production quality.
- Protocol remains unchanged when swapping from dev viewer to real Cubism runtime.
