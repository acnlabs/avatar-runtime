# Live2D Bridge Contract (MVP)

This document defines the minimal HTTP bridge expected by `provider-live2d`.

## Base URL

- `LIVE2D_ENDPOINT` points to your Live2D bridge service, e.g. `http://127.0.0.1:3755`.

## Endpoints

- `POST /v1/session/start`
- `POST /v1/input/text`
- `POST /v1/input/audio`
- `POST /v1/form/switch`
- `GET /v1/status?providerSessionId=<optional>`

## Request / Response (minimal)

### `POST /v1/session/start`

Request:

```json
{
  "personaId": "samantha",
  "form": "face",
  "modelId": "default"
}
```

Response:

```json
{
  "providerSessionId": "l2d-uuid",
  "mode": "face",
  "modelId": "default"
}
```

### `POST /v1/input/text`

Request:

```json
{
  "providerSessionId": "l2d-uuid",
  "text": "hello"
}
```

Response:

```json
{
  "outputText": "hello",
  "visual": { "speaking": true, "form": "face" }
}
```

### `POST /v1/input/audio`

Request:

```json
{
  "providerSessionId": "l2d-uuid",
  "audioUrl": "",
  "audioBase64": ""
}
```

Response:

```json
{
  "transcript": "optional",
  "outputText": "optional",
  "visual": { "speaking": true, "form": "face" }
}
```

### `POST /v1/form/switch`

Request:

```json
{
  "providerSessionId": "l2d-uuid",
  "form": "face"
}
```

Response:

```json
{
  "providerSessionId": "l2d-uuid",
  "switchedTo": "face"
}
```

### `GET /v1/status`

Response should align with provider-side `status()` shape in `docs/PROVIDER-CONTRACT.md`, especially:

- `capabilities`
- `providerCapabilities`
- `visualManifest`
- `appearanceIntent` (optional but recommended)
- `faceControl` (optional but recommended)
- `media`
- `providerSessionId`
