# Live2D Asset Spec (Executable)

This document defines how to source, package, verify, and release the official default Live2D model for OpenPersona.

## Goal

- Provide a zero-config default avatar model for users.
- Keep compatibility with `faceControl` and `avatar-runtime` provider orchestration.
- Ensure commercial/legal compliance for online service usage.

## Required Delivery

- `*.model3.json` entry file
- `*.moc3` model core file
- texture files (`*.png`)
- expression files (`exp3.json`) - at least: `neutral`, `curious`, `warm`
- motion files (`motion3.json`) - at least: `idle`, `talk`, `blink`

## Required Runtime Parameters

The model must support (or equivalent mapping must be documented):

- `ParamAngleX`
- `ParamAngleY`
- `ParamAngleZ`
- `ParamEyeBallX`
- `ParamEyeBallY`
- `ParamEyeLOpen`
- `ParamEyeROpen`
- `ParamMouthOpenY`

Recommended:

- `ParamMouthForm`
- brow-related params for nuance (`ParamBrow*`)

## Asset Packaging Layout

Recommended structure in persona pack:

```text
assets/live2d/<model-name>/
  <model>.model3.json
  <model>.moc3
  textures/
  expressions/
  motions/
  LICENSE.txt
  ATTRIBUTION.md
```

Default template slot in this repo:

- `assets/live2d/slot/` — place your model files here; bridge auto-serves them at `/assets/live2d/slot/*`

## Minimum Avatar Pack Fields

These fields form the canonical identity of an Avatar Pack used by `avatar-runtime`:

| Field | Type | Required | Description |
|---|---|---|---|
| `model3Url` | `string` | yes | URL or relative path to the `.model3.json` entry file (Cubism 4) or `.model.json` (Cubism 2). Resolved by the source priority chain below. |
| `version` | `string` | yes | Semantic version of this asset pack, e.g. `v1.0.0`. Used for cache-busting and lineage tracking. |
| `allowUserOverride` | `boolean` | yes | Whether a user may replace this model with their own. Default `true` for companion personas. Set `false` to lock a branded persona's appearance. |
| `licenseProof` | `string` | yes | Path or URL to the license document confirming redistribution + online service rights. Required before publishing to ClawHub. |
| `modelFormat` | `"cubism2" \| "cubism4"` | recommended | Declares the Cubism SDK version expected. `cubism2` → `.moc` + `.mtn`; `cubism4` → `.moc3` + `motion3.json`. If omitted, renderer auto-detects by file extension. |
| `assetSource` | `string` | recommended | Origin URL or marketplace listing for traceability. |
| `attributionRule` | `string` | recommended | Credit text required by the asset license. Shown in the viewer's about panel if present. |

### Cubism 2 vs Cubism 4 Compatibility

OpenPersona currently ships a **Cubism 2** sample model (`chitose.model.json` + `.moc` + `.mtn`) for the L2Dwidget renderer (fallback path). A **Cubism 4** model (`.moc3` + `motion3.json` + `exp3.json`) is required to unlock the pixi renderer path with direct `faceControl` parameter mapping.

| Renderer | Entry file | SDK | Status |
|---|---|---|---|
| `l2dwidget` (fallback) | `*.model.json` | Cubism 2 | Working — chitose sample ships with repo |
| `pixi` (primary) | `*.model3.json` | Cubism 4 | Waiting — needs real `.moc3` + textures |

Until a Cubism 4 model is supplied, the system falls back to `l2dwidget` automatically and the character renders correctly.

## Source Priority Policy

Model source selection order (must be stable and deterministic):

1. Persona local override (`LIVING_CANVAS_MODEL3_URL` / `PERSONA_MODEL3_URL`)
2. Persona pack declared default (`appearance.defaultModel3Url` in `soul/persona.json`)
3. Provider override (`LIVE2D_PROVIDER_MODEL3_URL` / `LIVE2D_MODEL3_URL`)
4. Runtime default override (`AVATAR_RUNTIME_DEFAULT_MODEL3_URL`)
5a. Bridge auto default slot — Cubism 4 (`assets/live2d/slot/default.model3.json`) — placeholder, triggers pixi → l2dwidget fallback until a real `.moc3` is supplied
5b. Bridge auto default slot — Cubism 2 (`assets/live2d/slot/default.model.json`) — `l2dwidget` renders this correctly out of the box
6. Fallback renderer (dev vector portrait)

## Compliance Requirements

For third-party assets, collect and archive:

- `assetSource`: source URL or marketplace listing
- `licenseProof`: screenshot/PDF/text of the original license terms
- `distributionRight`: explicit permission for packaging/distribution with product
- `serviceRight`: explicit permission for online/SaaS display
- `modificationRight`: whether edits are allowed
- `attributionRule`: how credits should be shown (if required)

Do not invent license labels by combining unrelated terms.
Always keep original license text and provider terms.

## Quality Acceptance (P0)

- Visual quality:
  - neutral state is stable
  - no obvious face distortion at idle
  - eye and mouth transitions are smooth
- Behavior quality:
  - text input updates at least 2 dimensions (`gazeX`, `jawOpen`)
  - idle motion is visible (subtle blink/breath)
- Runtime quality:
  - `provider=live2d`, `degrade=null` when model is reachable
  - fallback path works when model load fails
  - a single demo instance runs for 60s without source flapping (no repeated switching between viewer/not-found/fallback because of competing writers)

## Release Metadata Template

Use this metadata for each official model release:

```yaml
modelName: samantha-core
modelVersion: v1.0.0-alpha-sensory
model3Url: assets/live2d/samantha-core/samantha.model3.json
allowUserOverride: true
assetSource: <url-or-vendor>
licenseType: <original-license-name>
licenseProof: <path-or-url>
distributionRight: true
serviceRight: true
modificationRight: true
attributionRule: <text>
```

## Supplier Brief (Copy-ready)

We need one commercially usable Live2D Cubism model as the default OpenPersona avatar.
Please deliver a complete package with `model3.json + moc3 + textures + expressions + motions`.
The model must support runtime parameter control for head angle, eye direction, eye open/close, and mouth open.
Please include clear license documents confirming commercial online service usage and redistribution terms.
