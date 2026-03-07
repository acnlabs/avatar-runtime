const { randomUUID } = require('node:crypto');
const { createProvider } = require('./providers');

function nowIso() {
  return new Date().toISOString();
}

function withDefaultCapabilities(caps = {}) {
  return {
    image: !!caps.image,
    model3d: !!caps.model3d,
    motion: !!caps.motion,
    voice: !!caps.voice,
    hearing: !!caps.hearing,
    worldSense: !!caps.worldSense
  };
}

function withDefaultVisualManifest(manifest = {}) {
  return {
    version: manifest.version || '0.1',
    ...manifest
  };
}

function withDefaultAppearanceIntent(intent = {}) {
  const allowedForms = new Set(['auto', 'face', 'sphere', 'vortex']);
  const form = allowedForms.has(intent.form) ? intent.form : 'auto';
  const lockSeconds = Number.isFinite(Number(intent.lockSeconds))
    ? Math.max(0, Number(intent.lockSeconds))
    : 0;
  return {
    version: intent.version || '0.1',
    form,
    style: intent.style || 'default',
    transition: intent.transition || 'smooth',
    priority: intent.priority || 'agent',
    lockSeconds,
    reason: intent.reason || '',
    source: intent.source || 'agent',
    updatedAt: intent.updatedAt || nowIso()
  };
}

function withDefaultFaceControl(control = {}) {
  return {
    pose: {
      yaw: Number(control?.pose?.yaw || 0),
      pitch: Number(control?.pose?.pitch || 0),
      roll: Number(control?.pose?.roll || 0)
    },
    eyes: {
      blinkL: Number(control?.eyes?.blinkL || 0),
      blinkR: Number(control?.eyes?.blinkR || 0),
      gazeX: Number(control?.eyes?.gazeX || 0),
      gazeY: Number(control?.eyes?.gazeY || 0)
    },
    brows: {
      browInner: Number(control?.brows?.browInner || 0),
      browOuterL: Number(control?.brows?.browOuterL || 0),
      browOuterR: Number(control?.brows?.browOuterR || 0)
    },
    mouth: {
      jawOpen: Number(control?.mouth?.jawOpen || 0),
      smile: Number(control?.mouth?.smile || 0),
      mouthPucker: Number(control?.mouth?.mouthPucker || 0)
    },
    emotion: {
      calm: Number(control?.emotion?.calm || 0.6),
      intensity: Number(control?.emotion?.intensity || 0.5)
    },
    source: control.source || 'agent',
    updatedAt: control.updatedAt || nowIso()
  };
}

function withDefaultProviderCapabilities(caps = {}, providerName = '') {
  const defaults = {
    faceRig: false,
    lipSync: false,
    gaze: false,
    blink: false,
    bodyMotion: false,
    streaming: false
  };
  const byProvider = {
    mock: { faceRig: true, gaze: true, blink: true },
    heygen: { faceRig: true, lipSync: true, bodyMotion: true, streaming: true },
    kusapics: { faceRig: false, lipSync: false, gaze: false, blink: false, bodyMotion: false, streaming: false },
    live2d: { faceRig: true, lipSync: true, gaze: true, blink: true, bodyMotion: false, streaming: false }
  };
  const merged = {
    ...defaults,
    ...(byProvider[String(providerName || '').toLowerCase()] || {}),
    ...caps
  };
  return {
    faceRig: !!merged.faceRig,
    lipSync: !!merged.lipSync,
    gaze: !!merged.gaze,
    blink: !!merged.blink,
    bodyMotion: !!merged.bodyMotion,
    streaming: !!merged.streaming
  };
}

function withDefaultMedia(media = {}, remote = {}) {
  const livekit = remote.livekit || {};
  return {
    avatarImage: media.avatarImage || null,
    avatarVideo: media.avatarVideo || null,
    model3Url: media.model3Url || remote.model3Url || null,
    viewerUrl: media.viewerUrl || null,
    livekitUrl: media.livekitUrl || livekit.url || null,
    livekitAccessToken: media.livekitAccessToken || livekit.accessToken || null,
    realtimeEndpoint: media.realtimeEndpoint || remote.realtimeEndpoint || null
  };
}

class AvatarRuntime {
  constructor(opts = {}) {
    this.providerName = opts.provider || process.env.AVATAR_PROVIDER || 'heygen';
    this.provider = createProvider(this.providerName, opts);
    this.sessions = new Map();
  }

  async startSession(payload = {}) {
    const sessionId = randomUUID();
    const providerSession = await this.provider.startSession(payload);
    const session = {
      sessionId,
      provider: this.providerName,
      createdAt: nowIso(),
      form: payload.form || 'image',
      personaId: payload.personaId || 'unknown',
      remote: providerSession
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      const err = new Error(`Session not found: ${sessionId}`);
      err.statusCode = 404;
      throw err;
    }
    return session;
  }

  async sendText(payload = {}) {
    const session = this.getSession(payload.sessionId);
    return this.provider.sendText({
      session,
      text: payload.text || ''
    });
  }

  async sendAudio(payload = {}) {
    const session = this.getSession(payload.sessionId);
    return this.provider.sendAudio({
      session,
      audioUrl: payload.audioUrl || '',
      audioBase64: payload.audioBase64 || ''
    });
  }

  async switchForm(payload = {}) {
    const session = this.getSession(payload.sessionId);
    const form = payload.form || 'image';
    session.form = form;
    return this.provider.switchForm({ session, form });
  }

  async status(payload = {}) {
    const session = payload.sessionId ? this.getSession(payload.sessionId) : null;
    const providerStatus = await this.provider.status({ session });
    const remote = session?.remote || {};
    return {
      runtime: 'avatar-runtime',
      contractVersion: '0.1',
      provider: this.providerName,
      available: true,
      degrade: providerStatus?.degrade || null,
      capabilities: withDefaultCapabilities(providerStatus?.capabilities || {}),
      providerCapabilities: withDefaultProviderCapabilities(
        providerStatus?.providerCapabilities || {},
        this.providerName
      ),
      visualManifest: withDefaultVisualManifest(providerStatus?.visualManifest || {}),
      appearanceIntent: withDefaultAppearanceIntent(providerStatus?.appearanceIntent || {}),
      faceControl: withDefaultFaceControl(providerStatus?.faceControl || {}),
      media: withDefaultMedia(providerStatus?.media || {}, remote),
      model3Source: providerStatus?.model3Source || null,
      session: session
        ? {
            sessionId: session.sessionId,
            personaId: session.personaId,
            form: session.form,
            createdAt: session.createdAt
          }
        : null
    };
  }
}

module.exports = {
  AvatarRuntime
};
