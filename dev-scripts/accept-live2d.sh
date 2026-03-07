#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="${ROOT_DIR}/reports/live2d-acceptance"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="${REPORT_DIR}/acceptance-${TIMESTAMP}.json"
LATEST_PATH="${REPORT_DIR}/latest.json"

mkdir -p "${REPORT_DIR}"

BRIDGE_PID=""
RUNTIME_PID=""

cleanup_case() {
  if [[ -n "${RUNTIME_PID}" ]]; then
    kill "${RUNTIME_PID}" >/dev/null 2>&1 || true
    wait "${RUNTIME_PID}" 2>/dev/null || true
    RUNTIME_PID=""
  fi
  if [[ -n "${BRIDGE_PID}" ]]; then
    kill "${BRIDGE_PID}" >/dev/null 2>&1 || true
    wait "${BRIDGE_PID}" 2>/dev/null || true
    BRIDGE_PID=""
  fi
}

cleanup_all() {
  cleanup_case
}
trap cleanup_all EXIT

wait_health() {
  local url="$1"
  local name="$2"
  local i
  for i in $(seq 1 30); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "[accept-live2d] ${name} health check timeout: ${url}" >&2
  return 1
}

run_case() {
  local case_name="$1"
  local bridge_port="$2"
  local runtime_port="$3"
  local bridge_model3="${4:-}"
  local expected_mode="$5"
  local expected_model3="$6"

  local case_dir="${REPORT_DIR}/${case_name}-${TIMESTAMP}"
  mkdir -p "${case_dir}"
  local bridge_log="${case_dir}/bridge.log"
  local runtime_log="${case_dir}/runtime.log"
  local runtime_status="${case_dir}/runtime-status.json"
  local bridge_status="${case_dir}/bridge-status.json"
  local start_out="${case_dir}/start.json"

  cleanup_case

  if [[ -n "${bridge_model3}" ]]; then
    LIVE2D_BRIDGE_PORT="${bridge_port}" LIVE2D_MODEL3_URL="${bridge_model3}" \
      node "${ROOT_DIR}/bridges/live2d-cubism-web-bridge.js" >"${bridge_log}" 2>&1 &
  else
    LIVE2D_BRIDGE_PORT="${bridge_port}" \
      node "${ROOT_DIR}/bridges/live2d-cubism-web-bridge.js" >"${bridge_log}" 2>&1 &
  fi
  BRIDGE_PID="$!"

  AVATAR_PROVIDER=live2d LIVE2D_ENDPOINT="http://127.0.0.1:${bridge_port}" \
    node "${ROOT_DIR}/bin/avatar-runtime.js" --port "${runtime_port}" >"${runtime_log}" 2>&1 &
  RUNTIME_PID="$!"

  wait_health "http://127.0.0.1:${bridge_port}/health" "bridge(${case_name})"
  wait_health "http://127.0.0.1:${runtime_port}/health" "runtime(${case_name})"

  curl -fsS -X POST "http://127.0.0.1:${runtime_port}/v1/session/start" \
    -H 'content-type: application/json' \
    -d '{"personaId":"samantha","form":"face"}' >"${start_out}"

  local session_id
  session_id="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(j.sessionId||'');" "${start_out}")"
  if [[ -z "${session_id}" ]]; then
    echo "[accept-live2d] missing sessionId for ${case_name}" >&2
    return 1
  fi

  curl -fsS "http://127.0.0.1:${runtime_port}/v1/status?sessionId=${session_id}" >"${runtime_status}"
  curl -fsS "http://127.0.0.1:${bridge_port}/v1/status" >"${bridge_status}"

  node -e "
const fs=require('fs');
const runtime=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const bridge=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const expectedMode=process.argv[3];
const expectedModel=process.argv[4];
const mode=bridge?.debug?.expectedRenderPath || '';
const model=runtime?.media?.model3Url || '';
const hasSlot=!!bridge?.debug?.hasDefaultModelSlot;
if(expectedMode && mode!==expectedMode){console.error('expected mode',expectedMode,'got',mode);process.exit(1);}
if(expectedModel && model!==expectedModel){console.error('expected model',expectedModel,'got',model);process.exit(1);}
if(!bridge?.providerCapabilities?.faceRig){console.error('faceRig capability missing');process.exit(1);}
if(!hasSlot){console.error('default model slot not detected');process.exit(1);}
" "${runtime_status}" "${bridge_status}" "${expected_mode}" "${expected_model3}"

  echo "{\"case\":\"${case_name}\",\"ok\":true,\"runtimeStatus\":\"${runtime_status}\",\"bridgeStatus\":\"${bridge_status}\",\"bridgeLog\":\"${bridge_log}\",\"runtimeLog\":\"${runtime_log}\"}"
}

A_BRIDGE_PORT="${A_BRIDGE_PORT:-3965}"
A_RUNTIME_PORT="${A_RUNTIME_PORT:-3961}"
B_BRIDGE_PORT="${B_BRIDGE_PORT:-3966}"
B_RUNTIME_PORT="${B_RUNTIME_PORT:-3962}"
B_OVERRIDE_MODEL3="${B_OVERRIDE_MODEL3:-http://127.0.0.1:65530/models/missing.model3.json}"

A_EXPECTED_MODEL3="http://127.0.0.1:${A_BRIDGE_PORT}/assets/live2d/slot/default.model3.json"
B_EXPECTED_MODEL3="${B_OVERRIDE_MODEL3}"
EXPECTED_MODE="live2d-preferred-with-client-fallback"

CASE_A="$(run_case "auto-default-slot" "${A_BRIDGE_PORT}" "${A_RUNTIME_PORT}" "" "${EXPECTED_MODE}" "${A_EXPECTED_MODEL3}")"
CASE_B="$(run_case "provider-override" "${B_BRIDGE_PORT}" "${B_RUNTIME_PORT}" "${B_OVERRIDE_MODEL3}" "${EXPECTED_MODE}" "${B_EXPECTED_MODEL3}")"

node -e "
const fs=require('fs');
const report={
  generatedAt:new Date().toISOString(),
  suite:'live2d-acceptance',
  result:'pass',
  cases:[JSON.parse(process.argv[1]),JSON.parse(process.argv[2])]
};
fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(process.argv[4],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
" "${CASE_A}" "${CASE_B}" "${REPORT_PATH}" "${LATEST_PATH}"

