#!/usr/bin/env node
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.LIVE2D_BRIDGE_PORT || 3755);
const sessions = new Map();
const DEFAULT_ASSET_DIR = path.resolve(process.cwd(), 'assets/live2d/slot');
const DEFAULT_MODEL_C4_ROUTE = '/assets/live2d/slot/default.model3.json';
const DEFAULT_MODEL_C2_ROUTE = '/assets/live2d/slot/default.model.json';
const DEFAULT_MODEL_C4_ABS = path.resolve(DEFAULT_ASSET_DIR, 'default.model3.json');
const DEFAULT_MODEL_C2_ABS = path.resolve(DEFAULT_ASSET_DIR, 'default.model.json');

function nowIso() {
  return new Date().toISOString();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Number(v) || 0));
}

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function contentTypeOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.moc3') return 'application/octet-stream';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function resolveDefaultModelSlot() {
  if (fs.existsSync(DEFAULT_MODEL_C4_ABS) && !isTemplateModel3Placeholder(DEFAULT_MODEL_C4_ABS)) {
    return { route: DEFAULT_MODEL_C4_ROUTE, abs: DEFAULT_MODEL_C4_ABS };
  }
  if (fs.existsSync(DEFAULT_MODEL_C2_ABS)) {
    return { route: DEFAULT_MODEL_C2_ROUTE, abs: DEFAULT_MODEL_C2_ABS };
  }
  return null;
}

function isTemplateModel3Placeholder(modelPath) {
  try {
    const raw = fs.readFileSync(modelPath, 'utf8');
    const parsed = JSON.parse(raw);
  const note = String((((parsed || {}).Meta || {}).Note) || '').toLowerCase();
    return note.includes('template placeholder');
  } catch (_) {
    return false;
  }
}

function getDefaultModel3Url() {
  if (process.env.LIVE2D_MODEL3_URL) return process.env.LIVE2D_MODEL3_URL;
  const slot = resolveDefaultModelSlot();
  if (!slot) return '';
  const baseUrl = process.env.LIVE2D_BRIDGE_PUBLIC_BASE_URL || `http://127.0.0.1:${port}`;
  return `${baseUrl}${slot.route}`;
}

function serveDefaultAssets(urlPath, res) {
  const prefix = '/assets/live2d/slot/';
  if (!urlPath.startsWith(prefix)) return false;
  const rel = urlPath.slice(prefix.length);
  const safeRel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const baseDir = DEFAULT_ASSET_DIR;
  const abs = path.resolve(baseDir, safeRel);
  if (!abs.startsWith(baseDir)) {
    json(res, 403, { error: 'Forbidden' });
    return true;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    json(res, 404, { error: 'Not found' });
    return true;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypeOf(abs));
  fs.createReadStream(abs).pipe(res);
  return true;
}

function html(res, body) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
      if (raw.length > 2 * 1024 * 1024) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function ensureSession(providerSessionId) {
  const sid = providerSessionId || `l2d-${randomUUID()}`;
  if (!sessions.has(sid)) {
    const phase = Math.random() * Math.PI * 2;
    sessions.set(sid, {
      providerSessionId: sid,
      personaId: 'unknown',
      modelId: 'demo-cubism-model',
      model3Url: getDefaultModel3Url(),
      form: 'face',
      phase,
      faceControl: {
        pose: { yaw: 0, pitch: 0, roll: 0 },
        eyes: { blinkL: 0, blinkR: 0, gazeX: 0, gazeY: 0 },
        brows: { browInner: 0, browOuterL: 0, browOuterR: 0 },
        mouth: { jawOpen: 0, smile: 0.25, mouthPucker: 0 },
        emotion: { calm: 0.65, intensity: 0.45 },
        source: 'agent',
        updatedAt: nowIso()
      },
      updatedAt: nowIso()
    });
  }
  return sessions.get(sid);
}

function applyIdleMotion(state) {
  const t = Date.now() / 1000;
  const p = state.phase || 0;
  const blinkWave = Math.max(0, Math.sin((t * 1.7) + p));
  const breathWave = (Math.sin((t * 0.85) + p) + 1) / 2;
  const microYaw = Math.sin((t * 0.4) + p) * 0.05;
  const microGaze = Math.cos((t * 0.65) + p) * 0.06;

  // Keep agent-driven values dominant while adding subtle idle life-like motion.
  state.faceControl.pose.yaw = clamp((state.faceControl.pose.yaw || 0) * 0.92 + microYaw, -1, 1);
  state.faceControl.eyes.gazeX = clamp((state.faceControl.eyes.gazeX || 0) * 0.9 + microGaze, -1, 1);
  state.faceControl.eyes.blinkL = clamp(blinkWave > 0.94 ? 0.92 : 0.0, 0, 1);
  state.faceControl.eyes.blinkR = clamp(blinkWave > 0.94 ? 0.92 : 0.0, 0, 1);
  state.faceControl.mouth.jawOpen = clamp((state.faceControl.mouth.jawOpen || 0) * 0.9 + (breathWave * 0.06), 0, 1);
  state.faceControl.updatedAt = nowIso();
}

function toCubismParams(faceControl = {}) {
  return {
    ParamAngleX: clamp(((((faceControl.pose || {}).yaw) || 0) * 30), -30, 30),
    ParamAngleY: clamp(((((faceControl.pose || {}).pitch) || 0) * 30), -30, 30),
    ParamAngleZ: clamp(((((faceControl.pose || {}).roll) || 0) * 30), -30, 30),
    ParamEyeBallX: clamp((((faceControl.eyes || {}).gazeX) || 0), -1, 1),
    ParamEyeBallY: clamp((((faceControl.eyes || {}).gazeY) || 0), -1, 1),
    ParamEyeLOpen: clamp(1 - ((((faceControl.eyes || {}).blinkL) || 0)), 0, 1),
    ParamEyeROpen: clamp(1 - ((((faceControl.eyes || {}).blinkR) || 0)), 0, 1),
    ParamMouthOpenY: clamp((((faceControl.mouth || {}).jawOpen) || 0), 0, 1),
    ParamMouthForm: clamp(((((faceControl.mouth || {}).smile) || 0) - (((faceControl.mouth || {}).mouthPucker) || 0)), -1, 1)
  };
}

function statusOf(state) {
  applyIdleMotion(state);
  const baseUrl = process.env.LIVE2D_BRIDGE_PUBLIC_BASE_URL || `http://127.0.0.1:${port}`;
  const viewerQuery = new URLSearchParams({
    providerSessionId: state.providerSessionId,
    embed: '1'
  });
  if (state.model3Url) viewerQuery.set('model3Url', state.model3Url);
  return {
    capabilities: {
      image: true,
      model3d: false,
      motion: true,
      voice: true,
      hearing: true,
      worldSense: false
    },
    providerCapabilities: {
      faceRig: true,
      lipSync: true,
      gaze: true,
      blink: true,
      bodyMotion: false,
      streaming: false
    },
    visualManifest: {
      version: '0.1',
      mood: { valence: 0.25, arousal: 0.4 }
    },
    appearanceIntent: {
      version: '0.1',
      form: state.form || 'face',
      style: 'cubism-web',
      transition: 'smooth',
      priority: 'agent',
      lockSeconds: 0,
      reason: '',
      source: 'agent',
      updatedAt: state.updatedAt || nowIso()
    },
    faceControl: state.faceControl,
    media: {
      avatarImage: null,
      avatarVideo: null,
      model3Url: state.model3Url || null,
      viewerUrl: `${baseUrl}/viewer?${viewerQuery.toString()}`
    },
    providerSessionId: state.providerSessionId,
    debug: {
      cubismParams: toCubismParams(state.faceControl),
      usingModel3Url: state.model3Url || null,
      expectedRenderPath: state.model3Url ? 'live2d-preferred-with-client-fallback' : 'vector-fallback',
      hasDefaultModelSlot: !!resolveDefaultModelSlot(),
      defaultModelPath: (resolveDefaultModelSlot() || {}).abs || ''
    }
  };
}

function buildViewerHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cubism Web Bridge Viewer</title>
  <style>
    html, body { width: 100%; height: 100%; }
    body { margin: 0; font-family: ui-sans-serif, system-ui; background: #0b0f1a; color: #dce6ff; overflow: hidden; }
    .wrap { max-width: 980px; margin: 16px auto; padding: 0 16px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #121a2b; border: 1px solid #2a3450; border-radius: 12px; padding: 12px; }
    .embed-stage { width: 100%; height: 100%; display: none; }
    .embed-stage canvas { width: 100%; height: 100%; display: block; background: radial-gradient(circle at 40% 30%, #2a3d6d, #11172a); }
    .mode-badge {
      position: fixed;
      right: 10px;
      top: 10px;
      z-index: 20;
      background: rgba(9, 13, 26, 0.72);
      border: 1px solid rgba(115, 147, 255, 0.42);
      color: #dce6ff;
      border-radius: 10px;
      padding: 6px 8px;
      font-size: 11px;
      line-height: 1.35;
      max-width: min(52vw, 420px);
      word-break: break-all;
      display: none;
    }
    canvas { width: 100%; aspect-ratio: 1 / 1; background: radial-gradient(circle at 40% 30%, #2a3d6d, #11172a); border-radius: 10px; }
    pre { margin: 0; max-height: 420px; overflow: auto; font-size: 12px; }
    input, button { background: #0c1220; color: #dce6ff; border: 1px solid #2a3450; border-radius: 8px; padding: 8px 10px; }
  </style>
</head>
<body>
  <div class="wrap" id="devWrap" style="display:none">
    <h3>Cubism Web Bridge (dev)</h3>
    <div class="row">
      <div class="card">
        <canvas id="face" width="640" height="640"></canvas>
      </div>
      <div class="card">
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input id="sid" style="flex:1;" placeholder="providerSessionId" />
          <button id="create">Create</button>
          <button id="tick">SendText</button>
        </div>
        <pre id="state"></pre>
      </div>
    </div>
  </div>
  <div class="embed-stage" id="embedStage">
    <canvas id="embedFace" width="640" height="640"></canvas>
  </div>
  <div class="mode-badge" id="modeBadge"></div>
  <script>
    const qs = new URLSearchParams(location.search);
    const isEmbed = qs.get('embed') === '1';
    const showMode = qs.get('debug') === '1' || !isEmbed;
    const providedSessionId = qs.get('providerSessionId') || '';

    const devWrap = document.getElementById('devWrap');
    const embedStage = document.getElementById('embedStage');
    const modeBadge = document.getElementById('modeBadge');
    if (!isEmbed) {
      devWrap.style.display = '';
    } else {
      embedStage.style.display = 'block';
      document.body.style.background = 'transparent';
    }
    if (showMode && modeBadge) modeBadge.style.display = 'block';

    // Immediately notify parent that viewer has loaded (before first refresh).
    function emitRendererStateRaw(renderer, detail, model3Url) {
      if (!window.parent || window.parent === window) return;
      try {
        window.parent.postMessage({
          source: 'live2d-cubism-web-bridge',
          type: 'renderer-state',
          renderer: renderer,
          detail: detail,
          model3Url: model3Url || ''
        }, '*');
      } catch (_) {}
    }
    if (isEmbed) emitRendererStateRaw('vector-fallback', 'initializing', '');
    window.addEventListener('error', (ev) => {
      const msg = (ev && ev.message) ? ev.message : 'unknown-error';
      emitRendererStateRaw('vector-fallback', 'viewer-js-error:' + msg, '');
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev && ev.reason;
      const msg = reason && reason.message ? reason.message : String(reason || 'unknown-rejection');
      emitRendererStateRaw('vector-fallback', 'viewer-js-rejection:' + msg, '');
    });

    let sid = '';
    const canvas = isEmbed ? document.getElementById('embedFace') : document.getElementById('face');
    const ctx = canvas.getContext('2d');

    function resizeEmbedCanvas() {
      if (!isEmbed) return;
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = Math.max(256, Math.floor(window.innerWidth));
      const h = Math.max(256, Math.floor(window.innerHeight));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (isEmbed) {
      resizeEmbedCanvas();
      window.addEventListener('resize', resizeEmbedCanvas);
    }

    function draw(fc) {
      const yaw = (((fc.pose || {}).yaw) || 0) * 35;
      const pitch = (((fc.pose || {}).pitch) || 0) * 16;
      const gazeX = ((fc.eyes || {}).gazeX) || 0;
      const gazeY = ((fc.eyes || {}).gazeY) || 0;
      const jaw = ((fc.mouth || {}).jawOpen) || 0;
      const smile = ((fc.mouth || {}).smile) || 0;
      const blink = Math.max(((fc.eyes || {}).blinkL) || 0, ((fc.eyes || {}).blinkR) || 0);
      const w = isEmbed ? window.innerWidth : 640;
      const h = isEmbed ? window.innerHeight : 640;
      const cx = w / 2;
      const cy = h / 2;
      const sx = Math.max(0.55, Math.min(1.6, w / 640));
      const sy = Math.max(0.55, Math.min(1.6, h / 640));
      ctx.clearRect(0, 0, w, h);

      // Ambient glow for a cleaner "digital portrait" presence.
      const halo = ctx.createRadialGradient(cx, cy - 10, 35, cx, cy, 260 * Math.max(sx, sy));
      halo.addColorStop(0, 'rgba(145,130,255,0.28)');
      halo.addColorStop(1, 'rgba(145,130,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cx, cy + (pitch * sy));
      ctx.rotate((yaw * Math.PI) / 180);

      // Neck and shadow
      ctx.fillStyle = 'rgba(106,86,135,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 180 * sy, 55 * sx, 72 * sy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Face base with gradient
      const skin = ctx.createRadialGradient(-28 * sx, -80 * sy, 25, 0, 0, 250 * sx);
      skin.addColorStop(0, '#f8e3d4');
      skin.addColorStop(0.65, '#f2cdb7');
      skin.addColorStop(1, '#d8ab93');
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(0, 0, 170 * sx, 212 * sy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair silhouette
      const hair = ctx.createLinearGradient(0, -210 * sy, 0, 40 * sy);
      hair.addColorStop(0, '#312f62');
      hair.addColorStop(1, '#1b1c3b');
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(-170 * sx, -10 * sy);
      ctx.quadraticCurveTo(-150 * sx, -220 * sy, 0, -240 * sy);
      ctx.quadraticCurveTo(150 * sx, -220 * sy, 170 * sx, -10 * sy);
      ctx.quadraticCurveTo(120 * sx, -60 * sy, 115 * sx, 34 * sy);
      ctx.quadraticCurveTo(0, 0, -115 * sx, 34 * sy);
      ctx.quadraticCurveTo(-120 * sx, -60 * sy, -170 * sx, -10 * sy);
      ctx.closePath();
      ctx.fill();

      // Eye sockets
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      const eyeLx = (-56 + gazeX * 9) * sx;
      const eyeRx = (56 + gazeX * 9) * sx;
      const eyeY = (-28 + gazeY * 7) * sy;
      const eyeH = Math.max(2.5, (16 - blink * 14)) * sy;
      ctx.beginPath(); ctx.ellipse(eyeLx, eyeY, 23 * sx, eyeH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(eyeRx, eyeY, 23 * sx, eyeH, 0, 0, Math.PI * 2); ctx.fill();

      // Iris/pupil
      ctx.fillStyle = '#2a2d4a';
      ctx.beginPath(); ctx.ellipse((eyeLx + gazeX * 4 * sx), eyeY, 8 * sx, Math.max(2, eyeH * 0.55), 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse((eyeRx + gazeX * 4 * sx), eyeY, 8 * sx, Math.max(2, eyeH * 0.55), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc((eyeLx + 3 * sx), eyeY - 3 * sy, 2.4 * sx, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc((eyeRx + 3 * sx), eyeY - 3 * sy, 2.4 * sx, 0, Math.PI * 2); ctx.fill();

      // Brows
      ctx.strokeStyle = '#3b2955';
      ctx.lineWidth = 5 * Math.max(0.75, (sx + sy) / 2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo((-82 + gazeX * 4) * sx, (-58 + gazeY * 3) * sy);
      ctx.quadraticCurveTo((-56 + gazeX * 4) * sx, (-74 + gazeY * 2) * sy, (-26 + gazeX * 4) * sx, (-60 + gazeY * 3) * sy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((82 + gazeX * 4) * sx, (-58 + gazeY * 3) * sy);
      ctx.quadraticCurveTo((56 + gazeX * 4) * sx, (-74 + gazeY * 2) * sy, (26 + gazeX * 4) * sx, (-60 + gazeY * 3) * sy);
      ctx.stroke();

      // Nose highlight + tip
      ctx.strokeStyle = 'rgba(130,92,82,0.6)';
      ctx.lineWidth = 3 * Math.max(0.75, (sx + sy) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -2 * sy);
      ctx.quadraticCurveTo(9 * sx, 36 * sy, 0, 64 * sy);
      ctx.stroke();
      ctx.fillStyle = 'rgba(166,122,106,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 69 * sy, 11 * sx, 6.5 * sy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lips / mouth
      const mouthY = 112 * sy;
      const mouthW = (52 + smile * 18) * sx;
      const mouthH = (8 + jaw * 34) * sy;
      ctx.fillStyle = 'rgba(191,104,140,0.52)';
      ctx.beginPath();
      ctx.moveTo(-mouthW, mouthY);
      ctx.quadraticCurveTo(0, mouthY - (9 + smile * 8) * sy, mouthW, mouthY);
      ctx.quadraticCurveTo(0, mouthY + mouthH, -mouthW, mouthY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(128,61,92,0.62)';
      ctx.lineWidth = 2.4 * Math.max(0.75, (sx + sy) / 2);
      ctx.beginPath();
      ctx.moveTo(-mouthW * 0.86, mouthY);
      ctx.quadraticCurveTo(0, mouthY + mouthH * 0.3, mouthW * 0.86, mouthY);
      ctx.stroke();

      // Soft facial contour shadow
      ctx.strokeStyle = 'rgba(95,70,108,0.34)';
      ctx.lineWidth = 8 * Math.max(0.75, (sx + sy) / 2);
      ctx.beginPath();
      ctx.ellipse(0, 2 * sy, 160 * sx, 202 * sy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    let pixiApp = null;
    let live2dModel = null;
    let usingRealModel = false;
    let rendererDetail = 'init';

    function updateModeBadge(model3Url) {
      if (!modeBadge || !showMode) return;
      const modelText = model3Url ? model3Url : '(none)';
      modeBadge.textContent = 'renderer=' + (usingRealModel ? 'live2d' : 'vector-fallback') + ' | model3=' + modelText + ' | detail=' + rendererDetail;
    }

    async function ensurePixiBase() {
      if (window.PIXI) return;
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load pixi.js'));
        document.head.appendChild(s);
      });
    }

    async function ensurePixiLive2D(runtime) {
      await ensurePixiBase();
      if (window.PIXI && window.PIXI.live2d && window.PIXI.live2d.Live2DModel) return;
      const lib = runtime === 'c2'
        ? 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js'
        : 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js';
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = lib;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load pixi-live2d-display runtime'));
        document.head.appendChild(s);
      });
    }

    function applyFaceControlToPixiModel(fc) {
      if (!live2dModel || !live2dModel.internalModel || !live2dModel.internalModel.coreModel) return;
      const core = live2dModel.internalModel.coreModel;
      const params = {
        ParamAngleX: ((((fc.pose || {}).yaw) || 0) * 30),
        ParamAngleY: ((((fc.pose || {}).pitch) || 0) * 30),
        ParamAngleZ: ((((fc.pose || {}).roll) || 0) * 30),
        ParamEyeBallX: (((fc.eyes || {}).gazeX) || 0),
        ParamEyeBallY: (((fc.eyes || {}).gazeY) || 0),
        ParamEyeLOpen: 1 - ((((fc.eyes || {}).blinkL) || 0)),
        ParamEyeROpen: 1 - ((((fc.eyes || {}).blinkR) || 0)),
        ParamMouthOpenY: (((fc.mouth || {}).jawOpen) || 0),
        ParamMouthForm: ((((fc.mouth || {}).smile) || 0) - (((fc.mouth || {}).mouthPucker) || 0))
      };
      Object.keys(params).forEach((id) => {
        try {
          core.setParameterValueById(id, params[id]);
        } catch (_) {}
      });
      live2dModel.internalModel.motionManager && live2dModel.internalModel.motionManager.update && live2dModel.internalModel.motionManager.update(0);
    }

    function resolveLive2DRuntime(modelUrl) {
      if (!modelUrl) return '';
      return /\.model\.json($|\?)/i.test(modelUrl) ? 'c2' : 'c4';
    }

    function emitRendererState(model3Url) {
      emitRendererStateRaw(
        usingRealModel ? 'live2d' : 'vector-fallback',
        rendererDetail,
        model3Url
      );
    }

    // Heartbeat for parent page: prevents silent "loaded-but-no-signal" stalls.
    if (isEmbed) {
      setInterval(() => {
        const model3Url = qs.get('model3Url') || '';
        emitRendererState(model3Url);
      }, 1000);
    }

    async function ensureLive2DModel(model3Url) {
      if (!model3Url || !isEmbed) return false;
      if (usingRealModel && live2dModel) return true;
      try {
        const runtime = resolveLive2DRuntime(model3Url);
        await ensurePixiLive2D(runtime);
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        if (!pixiApp) {
          pixiApp = new window.PIXI.Application({
            view: canvas,
            width: Math.max(256, Math.floor(window.innerWidth)),
            height: Math.max(256, Math.floor(window.innerHeight)),
            transparent: true,
            antialias: true,
            autoStart: true,
            resolution: dpr
          });
          window.addEventListener('resize', () => {
            if (!pixiApp) return;
            pixiApp.renderer.resize(
              Math.max(256, Math.floor(window.innerWidth)),
              Math.max(256, Math.floor(window.innerHeight))
            );
            if (live2dModel) {
              const w = pixiApp.renderer.width;
              const h = pixiApp.renderer.height;
              const scale = Math.min(w / live2dModel.width, h / live2dModel.height) * 0.82;
              live2dModel.scale.set(scale);
              live2dModel.x = w * 0.5;
              live2dModel.y = h * 0.86;
              live2dModel.anchor.set(0.5, 1);
            }
          });
        }
        live2dModel = await window.PIXI.live2d.Live2DModel.from(model3Url, { autoUpdate: true });
        pixiApp.stage.removeChildren();
        pixiApp.stage.addChild(live2dModel);
        const w = pixiApp.renderer.width;
        const h = pixiApp.renderer.height;
        const scale = Math.min(w / live2dModel.width, h / live2dModel.height) * 0.82;
        live2dModel.scale.set(scale);
        live2dModel.x = w * 0.5;
        live2dModel.y = h * 0.86;
        live2dModel.anchor.set(0.5, 1);
        usingRealModel = true;
        rendererDetail = 'model-loaded:' + runtime;
        return true;
      } catch (err) {
        usingRealModel = false;
        rendererDetail = 'load-failed:' + ((err && err.message) ? err.message : 'unknown');
        return false;
      }
    }

    async function refresh() {
      if (!sid) return;
      try {
        const res = await fetch('/v1/status?providerSessionId=' + encodeURIComponent(sid));
        if (!res.ok) {
          rendererDetail = 'status-http-' + res.status;
          updateModeBadge('');
          emitRendererState('');
          return;
        }
        const data = await res.json();
        const stateEl = document.getElementById('state');
        if (stateEl) stateEl.textContent = JSON.stringify(data, null, 2);
        const model3Url = qs.get('model3Url') || (((data || {}).media || {}).model3Url) || '';
        const loaded = await ensureLive2DModel(model3Url);
        if (loaded) {
          applyFaceControlToPixiModel(data.faceControl || {});
        } else {
          draw(data.faceControl || {});
          if (!model3Url) rendererDetail = 'no-model3-url';
        }
        updateModeBadge(model3Url);
        emitRendererState(model3Url);
      } catch (err) {
        rendererDetail = 'status-fetch-failed:' + ((err && err.message) ? err.message : 'unknown');
        updateModeBadge('');
        emitRendererState('');
      }
    }
    document.getElementById('create').onclick = async () => {
      const res = await fetch('/v1/session/start', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ form:'face' }) });
      const data = await res.json();
      sid = data.providerSessionId;
      document.getElementById('sid').value = sid;
      refresh();
    };
    document.getElementById('tick').onclick = async () => {
      sid = document.getElementById('sid').value || sid;
      if (!sid) return;
      await fetch('/v1/input/text', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ providerSessionId: sid, text: 'viewer signal ' + Date.now() }) });
      refresh();
    };
    if (providedSessionId) {
      sid = providedSessionId;
      const sidInput = document.getElementById('sid');
      if (sidInput) sidInput.value = sid;
      refresh().catch(() => {});
    }
    setInterval(() => { refresh().catch(() => {}); }, 1200);
  </script>
</body>
</html>`;
}

async function route(req, res) {
  const { method, url } = req;
  const pathname = new URL(`http://localhost${url}`).pathname;
  if (method === 'GET' && url === '/health') return json(res, 200, { ok: true, service: 'live2d-cubism-web-bridge' });
  if (method === 'GET' && (url === '/' || url.startsWith('/viewer'))) return html(res, buildViewerHtml());
  if (method === 'GET' && serveDefaultAssets(pathname, res)) return;

  if (method === 'POST' && url === '/v1/session/start') {
    const body = await parseBody(req);
    const state = ensureSession(body.providerSessionId);
    state.personaId = body.personaId || state.personaId || 'unknown';
    state.modelId = body.modelId || state.modelId || 'demo-cubism-model';
    state.model3Url = body.model3Url || state.model3Url || getDefaultModel3Url();
    state.form = body.form || state.form || 'face';
    state.updatedAt = nowIso();
    return json(res, 200, {
      providerSessionId: state.providerSessionId,
      mode: state.form,
      modelId: state.modelId
    });
  }

  if (method === 'POST' && url === '/v1/input/text') {
    const body = await parseBody(req);
    const state = ensureSession(body.providerSessionId);
    const signal = Math.sin(String(body.text || '').length / 3);
    state.faceControl.pose.yaw = clamp(signal * 0.35, -1, 1);
    state.faceControl.eyes.gazeX = clamp(signal * 0.5, -1, 1);
    state.faceControl.mouth.jawOpen = clamp(Math.abs(signal), 0, 1);
    state.faceControl.updatedAt = nowIso();
    state.updatedAt = nowIso();
    return json(res, 200, {
      outputText: String(body.text || ''),
      visual: { speaking: true, form: state.form }
    });
  }

  if (method === 'POST' && url === '/v1/input/audio') {
    const body = await parseBody(req);
    const state = ensureSession(body.providerSessionId);
    state.faceControl.mouth.jawOpen = 0.62;
    state.faceControl.updatedAt = nowIso();
    state.updatedAt = nowIso();
    return json(res, 200, {
      transcript: body.audioUrl ? 'mock transcript from url' : 'mock transcript from base64',
      outputText: 'audio handled by cubism web bridge',
      visual: { speaking: true, form: state.form }
    });
  }

  if (method === 'POST' && url === '/v1/form/switch') {
    const body = await parseBody(req);
    const state = ensureSession(body.providerSessionId);
    state.form = body.form || 'face';
    state.updatedAt = nowIso();
    return json(res, 200, {
      providerSessionId: state.providerSessionId,
      switchedTo: state.form
    });
  }

  if (method === 'GET' && url.startsWith('/v1/status')) {
    const query = new URL(`http://localhost${url}`).searchParams;
    const sid = query.get('providerSessionId');
    if (!sid) return json(res, 200, statusOf(ensureSession()));
    return json(res, 200, statusOf(ensureSession(sid)));
  }

  return json(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    json(res, 400, { error: err.message || 'Request failed' });
  }
});

server.listen(port, () => {
  console.log(`[live2d-cubism-web-bridge] listening on http://127.0.0.1:${port}`);
});
