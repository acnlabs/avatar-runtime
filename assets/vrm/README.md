# VRM Avatar Slot

Place `.vrm` model files in `slot/` to use them with the `vrm` provider.

## Quick Start — Free Models

[VRoid Hub](https://hub.vroid.com) hosts thousands of CC-licensed VRM models
free for use in applications. Download any model marked **"Available for use"**
and place it here:

```
assets/vrm/slot/
  your-avatar.vrm
```

Then start the asset server and runtime:

```bash
# Terminal A — serve VRM files
VRM_BRIDGE_PORT=3756 node bridges/vrm-asset-server.js

# Terminal B — avatar runtime with VRM provider
AVATAR_PROVIDER=vrm node bin/avatar-runtime.js
```

The provider automatically serves `default.vrm` if present, or the first `.vrm`
file found. Override via env var:

```bash
VRM_MODEL_URL=http://127.0.0.1:3756/assets/vrm/slot/your-avatar.vrm
```

## Embedding in Browser

```html
<script src="/packages/avatar-runtime/web/vrm-renderer.js"></script>
<script src="/packages/avatar-runtime/web/avatar-widget.js"></script>
<div id="avatar" style="width:360px;height:480px"></div>
<script>
  new AvatarWidget(document.getElementById('avatar'), {
    stateUrl: 'http://127.0.0.1:3721/v1/status',
  });
</script>
```

VRMRenderer auto-detects VRM mode from `avatarModelVrmUrl` in the runtime status.
Three.js and @pixiv/three-vrm are loaded on demand from CDN (no install needed).

## Licensing

Each model has its own license terms from the creator on VRoid Hub.
Common license options:

| License | Commercial | Redistribution |
|---------|-----------|----------------|
| CC BY   | ✅        | ✅ with attribution |
| CC BY-NC | ❌       | ✅ non-commercial  |
| Author's own license | varies | check terms |

Always read the model's individual license before deploying.

## Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| VRM 0.x | `.vrm` | Most VRoid Hub models |
| VRM 1.0 | `.vrm` | Newer standard, fully supported |
