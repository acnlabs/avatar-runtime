#!/usr/bin/env bash
# ensure-default-vrm-sample.sh
#
# Downloads the official @pixiv/three-vrm sample model for local dev testing.
# Run from the package root (where package.json lives):
#
#   bash scripts/ensure-default-vrm-sample.sh
#
# ⚠️  Licensing: VRM1_Constraint_Twist_Sample is provided by pixiv under the
#    CC BY 4.0 licence — free to use, share, and adapt with attribution.
#    Do NOT use chitose (Live2D) or paid VRoid Hub models as defaults.
#
# What this script does:
#   - Downloads VRM1_Constraint_Twist_Sample.vrm into assets/vrm/slot/
#   - Also sets it as the default (symlinks or copies to default.vrm)
#   - Safe to run multiple times (no-op if already present)

set -e

SLOT_DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/vrm/slot"
TARGET="$SLOT_DIR/VRM1_Constraint_Twist_Sample.vrm"
DEFAULT="$SLOT_DIR/default.vrm"
MODEL_URL="https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm"

echo "[vrm-sample] slot dir: $SLOT_DIR"

if [ -f "$TARGET" ]; then
  echo "[vrm-sample] ✓ already present: VRM1_Constraint_Twist_Sample.vrm ($(du -sh "$TARGET" | cut -f1))"
else
  echo "[vrm-sample] downloading VRM1_Constraint_Twist_Sample.vrm (~10 MB)..."
  curl -L --progress-bar -o "$TARGET" "$MODEL_URL"
  echo "[vrm-sample] ✓ saved to $TARGET"
fi

# Create/update default.vrm symlink so provider-vrm.js default URL works
if [ ! -e "$DEFAULT" ]; then
  ln -sf "VRM1_Constraint_Twist_Sample.vrm" "$DEFAULT"
  echo "[vrm-sample] ✓ default.vrm → VRM1_Constraint_Twist_Sample.vrm"
else
  echo "[vrm-sample] ✓ default.vrm already set"
fi

echo ""
echo "Next steps:"
echo "  1. npm run dev:vrm-bridge    # terminal A — serves assets/vrm/slot/ on :3756"
echo "  2. AVATAR_PROVIDER=vrm npm start    # terminal B — runtime on :3721"
echo "  3. Open the demo page or embed the widget with avatarModelVrmUrl"
