---
name: avatar
description: >
  External avatar runtime skill for OpenPersona-compatible agents.
  Provides visual embodiment and interaction via provider backends.
allowed-tools: Bash(node:*) Bash(curl:*)
---

# Avatar Skill (Runtime Bridge)

Use this skill when the user asks for avatar form, visual embodiment, or voice/avatar interaction.

## Runtime Endpoint

Default local runtime:

`http://127.0.0.1:3721`

Override with env var:

`AVATAR_RUNTIME_URL`

If unset, default to:

`http://127.0.0.1:3721`

## Core Actions

1. Start session
2. Send text
3. Send audio
4. Switch form (`image`, `3d`, `motion`, `voice`)
5. Query status/capabilities

## Example Calls

```bash
# Optional default
export AVATAR_RUNTIME_URL="${AVATAR_RUNTIME_URL:-http://127.0.0.1:3721}"

# start
curl -s -X POST "$AVATAR_RUNTIME_URL/v1/session/start" \
  -H "content-type: application/json" \
  -d '{"personaId":"{{slug}}","form":"image"}'

# text
curl -s -X POST "$AVATAR_RUNTIME_URL/v1/input/text" \
  -H "content-type: application/json" \
  -d '{"sessionId":"<session>","text":"hello"}'

# status
curl -s "$AVATAR_RUNTIME_URL/v1/status?sessionId=<session>"
```

## Provider Notes (HeyGen)

- Requires `HEYGEN_API_KEY` on runtime side.
- Uses HeyGen REST endpoints:
  - `POST /v1/streaming.new`
  - `POST /v1/streaming.start`
  - `POST /v1/streaming.task`
  - `POST /v1/streaming.stop`
- `sendAudio` via REST is limited; prefer transcript -> `sendText`, or use realtime endpoint flow.

## Fallback Policy

If runtime is unavailable:

- Continue with text interaction.
- Inform the user avatar mode is currently unavailable.
- Do not claim avatar rendering or voice playback succeeded.
