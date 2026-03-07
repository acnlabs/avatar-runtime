#!/usr/bin/env node
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const port = Number(process.env.LIVE2D_BRIDGE_PORT || 3755);
const sessions = new Map();

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
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

function defaultStatus(providerSessionId) {
  const state = sessions.get(providerSessionId) || {};
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
      mood: {
        valence: 0.2,
        arousal: 0.35
      }
    },
    appearanceIntent: {
      version: '0.1',
      form: state.form || 'face',
      style: 'live2d-default',
      transition: 'smooth',
      priority: 'agent',
      lockSeconds: 0,
      reason: '',
      source: 'agent',
      updatedAt: new Date().toISOString()
    },
    faceControl: {
      pose: { yaw: state.yaw || 0, pitch: 0, roll: 0 },
      eyes: { blinkL: 0, blinkR: 0, gazeX: state.gazeX || 0, gazeY: 0 },
      brows: { browInner: 0, browOuterL: 0, browOuterR: 0 },
      mouth: { jawOpen: state.jawOpen || 0, smile: 0.35, mouthPucker: 0 },
      emotion: { calm: 0.65, intensity: 0.45 },
      source: 'agent',
      updatedAt: new Date().toISOString()
    },
    media: {
      avatarImage: null,
      avatarVideo: null
    },
    providerSessionId
  };
}

async function route(req, res) {
  const { method, url } = req;

  if (method === 'GET' && url === '/health') {
    return json(res, 200, { ok: true, service: 'live2d-bridge-mock' });
  }

  if (method === 'POST' && url === '/v1/session/start') {
    const body = await parseBody(req);
    const providerSessionId = body.providerSessionId || `l2d-${randomUUID()}`;
    sessions.set(providerSessionId, {
      personaId: body.personaId || 'unknown',
      form: body.form || 'face',
      modelId: body.modelId || 'default',
      yaw: 0,
      gazeX: 0,
      jawOpen: 0
    });
    return json(res, 200, {
      providerSessionId,
      mode: body.form || 'face',
      modelId: body.modelId || 'default'
    });
  }

  if (method === 'POST' && url === '/v1/input/text') {
    const body = await parseBody(req);
    const sid = body.providerSessionId;
    const prev = sessions.get(sid) || {};
    const text = String(body.text || '');
    const signal = Math.sin(text.length / 3);
    sessions.set(sid, {
      ...prev,
      jawOpen: Math.min(1, Math.abs(signal)),
      gazeX: Math.max(-1, Math.min(1, signal * 0.4)),
      yaw: Math.max(-1, Math.min(1, signal * 0.3))
    });
    return json(res, 200, {
      outputText: text,
      visual: { speaking: true, form: prev.form || 'face' }
    });
  }

  if (method === 'POST' && url === '/v1/input/audio') {
    const body = await parseBody(req);
    const sid = body.providerSessionId;
    const prev = sessions.get(sid) || {};
    sessions.set(sid, {
      ...prev,
      jawOpen: 0.65
    });
    return json(res, 200, {
      transcript: body.audioUrl ? 'mock transcript from url' : 'mock transcript from base64',
      outputText: 'mock audio handled',
      visual: { speaking: true, form: prev.form || 'face' }
    });
  }

  if (method === 'POST' && url === '/v1/form/switch') {
    const body = await parseBody(req);
    const sid = body.providerSessionId;
    const prev = sessions.get(sid) || {};
    sessions.set(sid, { ...prev, form: body.form || 'face' });
    return json(res, 200, {
      providerSessionId: sid,
      switchedTo: body.form || 'face'
    });
  }

  if (method === 'GET' && url.startsWith('/v1/status')) {
    const query = new URL(`http://localhost${url}`).searchParams;
    const sid = query.get('providerSessionId');
    if (sid) return json(res, 200, defaultStatus(sid));
    return json(res, 200, {
      degrade: null,
      ...defaultStatus('none')
    });
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
  console.log(`[live2d-bridge-mock] listening on http://127.0.0.1:${port}`);
});
