# avatar-runtime (MVP)

Provider-agnostic avatar runtime for OpenPersona.

This MVP intentionally separates:

- **OpenPersona** -> protocol/bridge (`layers/faculties/avatar`)
- **avatar-runtime** -> execution (provider integration, media/session handling)

## Quick Start

```bash
cd packages/avatar-runtime
npm run start
```

Default endpoint: `http://127.0.0.1:3721`

## API (P0 Contract)

- `POST /v1/session/start`
- `POST /v1/input/text`
- `POST /v1/input/audio`
- `POST /v1/form/switch`
- `GET /v1/status?sessionId=...`

## cURL Smoke Test

```bash
# 1) start session
curl -s -X POST http://127.0.0.1:3721/v1/session/start \
  -H 'content-type: application/json' \
  -d '{"personaId":"samantha","form":"image"}'

# 2) send text
curl -s -X POST http://127.0.0.1:3721/v1/input/text \
  -H 'content-type: application/json' \
  -d '{"sessionId":"<from step 1>","text":"hello"}'

# 3) status
curl -s "http://127.0.0.1:3721/v1/status?sessionId=<from step 1>"
```

## Providers

- `heygen` (default): real REST integration for `streaming.new/start/task/stop`.
- `mock`: fully local response simulation for development.

Set provider:

```bash
AVATAR_PROVIDER=mock npm run start
```

## HeyGen Setup

1. Set `AVATAR_PROVIDER=heygen`
2. Set `HEYGEN_API_KEY=<your key>`
3. (Optional) set `HEYGEN_AVATAR_ID`, `HEYGEN_QUALITY`, `HEYGEN_TASK_TYPE`

Notes:

- Auth header uses `x-api-key`.
- `sendAudio` currently returns `unsupported` in REST mode because v1 task endpoint is text-based.
- If `HEYGEN_API_KEY` is missing:
  - `HEYGEN_STRICT=false` -> runtime falls back to mock provider behavior
  - `HEYGEN_STRICT=true` -> requests fail with explicit configuration error

## Skill Entry (for external distribution)

See `skill/avatar/SKILL.md`.
