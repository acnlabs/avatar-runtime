#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/assets/live2d/slot"
TARGET_CHITOSE_DIR="$TARGET_DIR/chitose"
TARGET_MODEL_C4="$TARGET_DIR/default.model3.json"
TARGET_MODEL_C2="$TARGET_DIR/default.model.json"
LICENSES_DIR="$ROOT_DIR/assets/live2d/licenses"

is_placeholder_c4="false"
if [[ -f "$TARGET_MODEL_C4" ]]; then
  if python3 - "$TARGET_MODEL_C4" <<'PY'
import json,sys
p=sys.argv[1]
try:
    with open(p, 'r', encoding='utf-8') as f:
        j=json.load(f)
    note=((j.get('Meta') or {}).get('Note') or '').lower()
    if 'template placeholder' in note:
        raise SystemExit(0)
except Exception:
    pass
raise SystemExit(1)
PY
  then
    is_placeholder_c4="true"
  fi
fi

if [[ -f "$TARGET_CHITOSE_DIR/chitose.model.json" || ( -f "$TARGET_MODEL_C4" && "$is_placeholder_c4" != "true" ) ]]; then
  echo "[live2d-sample] default model already exists"
  exit 0
fi

mkdir -p "$TARGET_CHITOSE_DIR" "$LICENSES_DIR"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "[live2d-sample] fetching sample package from npm..."
cd "$TMP_DIR"
npm pack live2d-widget-model-chitose@1.0.5 --silent >/dev/null
tar -xzf "live2d-widget-model-chitose-1.0.5.tgz"

SRC_DIR="$TMP_DIR/package/assets"
if [[ ! -f "$SRC_DIR/chitose.model.json" ]]; then
  echo "[live2d-sample] package structure mismatch: missing chitose.model.json" >&2
  exit 1
fi

cp -R "$SRC_DIR/"* "$TARGET_CHITOSE_DIR/"

cat > "$LICENSES_DIR/ATTRIBUTION.sample.md" <<'EOF'
# Default Live2D Sample Attribution

- Source package: `live2d-widget-model-chitose@1.0.5`
- Source repository: https://github.com/xiazeyu/live2d-widget-models
- License (as published by source package): GPL-2.0

This sample is for local demo bootstrap only. Replace with your official distributable model before production release.
EOF

echo "[live2d-sample] prepared: $TARGET_CHITOSE_DIR"
