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

// Legacy helper — kept for external scripts that may still call it.
// blinkL/R default corrected to 1 (open eyes).
function withDefaultFaceControl(control = {}) {
  return {
    pose: {
      yaw:   Number(control?.pose?.yaw   ?? 0),
      pitch: Number(control?.pose?.pitch ?? 0),
      roll:  Number(control?.pose?.roll  ?? 0)
    },
    eyes: {
      blinkL: Number(control?.eyes?.blinkL ?? 1),
      blinkR: Number(control?.eyes?.blinkR ?? 1),
      gazeX:  Number(control?.eyes?.gazeX  ?? 0),
      gazeY:  Number(control?.eyes?.gazeY  ?? 0)
    },
    brows: {
      browInner:  Number(control?.brows?.browInner  ?? 0),
      browOuterL: Number(control?.brows?.browOuterL ?? 0),
      browOuterR: Number(control?.brows?.browOuterR ?? 0)
    },
    mouth: {
      jawOpen:     Number(control?.mouth?.jawOpen     ?? 0),
      smile:       Number(control?.mouth?.smile       ?? 0),
      mouthPucker: Number(control?.mouth?.mouthPucker ?? 0)
    },
    emotion: {
      calm:      Number(control?.emotion?.calm      ?? 0.6),
      intensity: Number(control?.emotion?.intensity ?? 0.5)
    },
    source:    control.source    || 'agent',
    updatedAt: control.updatedAt || nowIso()
  };
}

// Face sub-domain default for control.avatar.face — no emotion, blinkL/R default 1.
function withDefaultAvatarFace(f = {}) {
  return {
    pose: {
      yaw:   Number(f?.pose?.yaw   ?? 0),
      pitch: Number(f?.pose?.pitch ?? 0),
      roll:  Number(f?.pose?.roll  ?? 0)
    },
    eyes: {
      blinkL: Number(f?.eyes?.blinkL ?? 1),
      blinkR: Number(f?.eyes?.blinkR ?? 1),
      gazeX:  Number(f?.eyes?.gazeX  ?? 0),
      gazeY:  Number(f?.eyes?.gazeY  ?? 0)
    },
    brows: {
      browInner:  Number(f?.brows?.browInner  ?? 0),
      browOuterL: Number(f?.brows?.browOuterL ?? 0),
      browOuterR: Number(f?.brows?.browOuterR ?? 0)
    },
    mouth: {
      jawOpen:     Number(f?.mouth?.jawOpen     ?? 0),
      smile:       Number(f?.mouth?.smile       ?? 0),
      mouthPucker: Number(f?.mouth?.mouthPucker ?? 0)
    },
    source:    f.source    || 'agent',
    updatedAt: f.updatedAt || nowIso()
  };
}

function withDefaultAvatarBody(b = {}) {
  return {
    preset: b.preset || 'idle',
    skeleton: Object.assign({
      hips:          { x: 0, y: 0, z: 0 },
      spine:         { x: 0, y: 0, z: 0 },
      chest:         { x: 0, y: 0, z: 0 },
      neck:          { x: 0, y: 0, z: 0 },
      leftUpperArm:  { x: 0, y: 0, z: 0 },
      leftLowerArm:  { x: 0, y: 0, z: 0 },
      rightUpperArm: { x: 0, y: 0, z: 0 },
      rightLowerArm: { x: 0, y: 0, z: 0 },
      leftUpperLeg:  { x: 0, y: 0, z: 0 },
      rightUpperLeg: { x: 0, y: 0, z: 0 }
    }, b.skeleton || {}),
    ik: Object.assign({
      leftHand:  { position: { x: 0, y: 0, z: 0 }, weight: 0 },
      rightHand: { position: { x: 0, y: 0, z: 0 }, weight: 0 }
    }, b.ik || {}),
    source:    b.source    || 'agent',
    updatedAt: b.updatedAt || nowIso()
  };
}

function withDefaultAvatarEmotion(e = {}) {
  return {
    valence:   Number(e?.valence   ?? 0),
    arousal:   Number(e?.arousal   ?? 0),
    label:     e.label     || 'neutral',
    intensity: Number(e?.intensity ?? 0.5),
    source:    e.source    || 'agent',
    updatedAt: e.updatedAt || nowIso()
  };
}

function withDefaultSceneControl(s = {}) {
  const cam = s.camera || {};
  const world = s.world || {};
  const kl = world.keyLight || {};
  return {
    camera: {
      position: Object.assign({ x: 0, y: 1.5, z: 3 }, cam.position || {}),
      target:   Object.assign({ x: 0, y: 1,   z: 0 }, cam.target   || {}),
      fov:      Number(cam.fov ?? 45)
    },
    world: {
      background:   world.background   || '#111111',
      ambientLight: Number(world.ambientLight ?? 0.4),
      keyLight: {
        intensity: Number(kl.intensity ?? 1.0),
        direction: Object.assign({ x: 1, y: 2, z: 1 }, kl.direction || {})
      }
    },
    props:     Array.isArray(s.props) ? s.props : [],
    source:    s.source    || 'agent',
    updatedAt: s.updatedAt || nowIso()
  };
}

function withDefaultAvatarControl() {
  return {
    avatar: {
      face:    withDefaultAvatarFace(),
      body:    withDefaultAvatarBody(),
      emotion: withDefaultAvatarEmotion()
    },
    scene: withDefaultSceneControl()
  };
}

function withDefaultProviderCapabilities(caps = {}, providerName = '') {
  const defaults = {
    faceRig:      false,
    lipSync:      false,
    gaze:         false,
    blink:        false,
    bodyMotion:   false,
    streaming:    false,
    bodyRig:      false,
    sceneControl: false
  };
  const byProvider = {
    mock:     { faceRig: true, gaze: true, blink: true },
    heygen:   { faceRig: true, lipSync: true, bodyMotion: true, streaming: true },
    kusapics: { faceRig: false, lipSync: false, gaze: false, blink: false, bodyMotion: false, streaming: false },
    live2d:   { faceRig: true, lipSync: true, gaze: true, blink: true, bodyMotion: false, streaming: false }
  };
  const merged = {
    ...defaults,
    ...(byProvider[String(providerName || '').toLowerCase()] || {}),
    ...caps
  };
  return {
    faceRig:      !!merged.faceRig,
    lipSync:      !!merged.lipSync,
    gaze:         !!merged.gaze,
    blink:        !!merged.blink,
    bodyMotion:   !!merged.bodyMotion,
    streaming:    !!merged.streaming,
    bodyRig:      !!merged.bodyRig,
    sceneControl: !!merged.sceneControl
  };
}

function withDefaultMedia(media = {}, remote = {}) {
  const livekit = remote.livekit || {};
  return {
    avatarImage:        media.avatarImage        || null,
    avatarVideo:        media.avatarVideo        || null,
    model3Url:          media.model3Url          || remote.model3Url        || null,
    viewerUrl:          media.viewerUrl          || null,
    livekitUrl:         media.livekitUrl         || livekit.url             || null,
    livekitAccessToken: media.livekitAccessToken || livekit.accessToken     || null,
    realtimeEndpoint:   media.realtimeEndpoint   || remote.realtimeEndpoint || null
  };
}

// Deep-merge b into a (one level of nesting), skipping undefined values.
function deepMerge(a, b) {
  const out = Object.assign({}, a);
  for (const k of Object.keys(b || {})) {
    const bv = b[k];
    if (bv !== undefined && bv !== null && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = Object.assign({}, a[k] || {}, bv);
    } else if (bv !== undefined) {
      out[k] = bv;
    }
  }
  return out;
}

// Merge a single control sub-domain.
// Provider wins entirely when it is actively driving (source !== 'agent').
// Otherwise the agent baseline is authoritative — provider defaults must not clobber agent values.
function mergeSubdomain(agent, provider) {
  if (provider && provider.source && provider.source !== 'agent') {
    return provider;
  }
  return agent;
}

class AvatarRuntime {
  constructor(opts = {}) {
    this.providerName = opts.provider || process.env.AVATAR_PROVIDER || 'heygen';
    this.provider = createProvider(this.providerName, opts);
    this.sessions = new Map();
    this._agentControl = withDefaultAvatarControl();
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

  /**
   * Update one or more control sub-domains.
   * Accepts partial patch — only supplied sub-fields are updated.
   * Each sub-domain is merged independently to avoid clobbering siblings.
   *
   * @param {object} patch - { avatar?: { face?, body?, emotion? }, scene?: {...} }
   */
  setControl(patch = {}) {
    const av = patch.avatar || {};
    const ac = this._agentControl;
    if (av.face) {
      ac.avatar.face = deepMerge(ac.avatar.face, {
        ...av.face,
        source: 'agent',
        updatedAt: nowIso()
      });
    }
    if (av.body) {
      ac.avatar.body = deepMerge(ac.avatar.body, {
        ...av.body,
        source: 'agent',
        updatedAt: nowIso()
      });
    }
    if (av.emotion) {
      ac.avatar.emotion = deepMerge(ac.avatar.emotion, {
        ...av.emotion,
        source: 'agent',
        updatedAt: nowIso()
      });
    }
    if (patch.scene) {
      ac.scene = deepMerge(ac.scene, {
        ...patch.scene,
        source: 'agent',
        updatedAt: nowIso()
      });
    }
    return this._agentControl;
  }

  /**
   * Merge agent control baseline with provider status output.
   * Handles old-format providers that return faceControl at top level.
   * Each sub-domain merges independently; provider wins when source !== 'agent'.
   */
  _mergeControl(providerStatus) {
    const providerFace  = providerStatus.faceControl  || {};
    const providerBody  = providerStatus.bodyControl   || {};
    const providerScene = providerStatus.sceneControl  || {};
    // emotion fallback: new format uses top-level; legacy (live2d bridge) puts it in faceControl.emotion
    const providerEmotion = providerStatus.emotion || providerFace.emotion || {};
    // strip emotion from face before normalising — emotion lives at avatar level
    const { emotion: _ignored, ...providerFaceOnly } = providerFace;

    const ac = this._agentControl;
    return {
      avatar: {
        face:    mergeSubdomain(ac.avatar.face,    withDefaultAvatarFace(providerFaceOnly)),
        body:    mergeSubdomain(ac.avatar.body,    providerBody),
        emotion: mergeSubdomain(ac.avatar.emotion, providerEmotion)
      },
      scene: mergeSubdomain(ac.scene, providerScene)
    };
  }

  async status(payload = {}) {
    const session = payload.sessionId ? this.getSession(payload.sessionId) : null;
    const providerStatus = await this.provider.status({ session });
    const remote = session?.remote || {};
    return {
      runtime: 'avatar-runtime',
      contractVersion: '0.2',
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
      control: this._mergeControl(providerStatus || {}),
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
  AvatarRuntime,
  withDefaultFaceControl
};
