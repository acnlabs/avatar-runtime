# Default Live2D Avatar Pack

This directory is the official default model slot for zero-config startup in OpenPersona.

## What's Here

### Cubism 2 Sample — chitose (dev/demo use)

A complete Cubism 2 model used as the **L2Dwidget fallback renderer**. Ships with the repo
so the system renders a real character out of the box without any configuration.

```
chitose.model.json       ← entry file (Cubism 2 format)
moc/
  chitose.moc            ← compiled Cubism 2 model
  chitose.2048/
    texture_00.png       ← character texture atlas
mtn/
  chitose_idle.mtn       ← idle animation
  chitose_handwave.mtn
  chitose_kime01.mtn
  chitose_kime02.mtn
exp/
  f01.exp.json … f07.exp.json   ← expression presets
chitose.physics.json
chitose.pose.json
```

**License:** Live2D Free Material License — dev/demo only, NOT for commercial redistribution.
See `LICENSE.txt` and `ATTRIBUTION.md` for details.

### Cubism 4 Placeholder — default.model3.json

An empty template file. The `pixi` renderer path requires a real Cubism 4 model (`.moc3`).
Until one is provided, the system automatically falls back to the `l2dwidget` renderer.

```
default.model3.json      ← placeholder (Textures: [], Motions: {})
```

To replace: drop a complete Cubism 4 model pack here and update `default.model3.json`
to reference `default.moc3`, textures, expressions, and motions. Then set:

```bash
LIVE2D_MODEL3_URL=http://127.0.0.1:3755/assets/live2d/slot/default.model3.json
```

## Adding a Production Model

1. Obtain a commercial-licensed Cubism 4 model (`.model3.json` + `.moc3` + textures + motions)
2. Place it in a sibling directory, e.g. `assets/live2d/samantha-core/`
3. Document its license in that directory's `ATTRIBUTION.md` and `LICENSE.txt`
4. Point `LIVE2D_MODEL3_URL` (or `appearance.defaultModel3Url` in `soul/persona.json`) at the new entry file
5. No code changes required — the renderer auto-selects the pixi path

See `docs/LIVE2D-ASSET-SPEC.md` for the full field reference, compliance checklist, and supplier brief.

## Runtime Environment Variables

| Variable | Purpose |
|---|---|
| `LIVE2D_MODEL3_URL` | Provider-level default model URL |
| `LIVING_CANVAS_MODEL3_URL` | Persona-local override (highest priority) |
| `AVATAR_RUNTIME_DEFAULT_MODEL3_URL` | Runtime default override (slot 4) |
