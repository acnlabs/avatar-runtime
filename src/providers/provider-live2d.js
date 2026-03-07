const { MockProvider } = require('./provider-mock');

class Live2DProvider {
  constructor(opts = {}) {
    this.endpoint = opts.live2dEndpoint || process.env.LIVE2D_ENDPOINT || '';
    this.modelId = opts.live2dModelId || process.env.LIVE2D_MODEL_ID || 'default';
    this.strict = String(opts.strict ?? process.env.LIVE2D_STRICT ?? 'false') === 'true';
    this.timeoutMs = Number(opts.timeoutMs || process.env.LIVE2D_TIMEOUT_MS || 10000);
    this.mock = new MockProvider();
  }

  normalizeEndpoint() {
    if (!this.endpoint) return '';
    return this.endpoint.endsWith('/') ? this.endpoint.slice(0, -1) : this.endpoint;
  }

  async request(path, payload) {
    const url = `${this.normalizeEndpoint()}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: payload ? 'POST' : 'GET',
        headers: payload ? { 'content-type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal
      });
      const raw = await res.text();
      let parsed;
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = { raw };
      }
      if (!res.ok) {
        const err = new Error(`Live2D bridge ${res.status} on ${path}`);
        err.statusCode = 502;
        err.details = parsed;
        throw err;
      }
      return parsed;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`Live2D bridge timeout on ${path} after ${this.timeoutMs}ms`);
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      if (!err.statusCode) err.statusCode = 502;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  hasConfig() {
    return !!this.endpoint;
  }

  assertConfig() {
    if (!this.hasConfig() && this.strict) {
      const err = new Error('LIVE2D_ENDPOINT is required when LIVE2D_STRICT=true');
      err.statusCode = 400;
      throw err;
    }
  }

  async startSession(payload = {}) {
    this.assertConfig();
    if (!this.hasConfig()) return this.mock.startSession(payload);
    const out = await this.request('/v1/session/start', {
      personaId: payload.personaId || 'unknown',
      form: payload.form || 'image',
      modelId: payload.modelId || this.modelId,
      model3Url: payload.model3Url || process.env.LIVE2D_MODEL3_URL || ''
    });
    return {
      providerSessionId: out.providerSessionId || out.sessionId || `live2d-${Date.now()}`,
      personaId: payload.personaId || 'unknown',
      modelId: out.modelId || payload.modelId || this.modelId,
      mode: out.mode || payload.form || 'image',
      ...out
    };
  }

  async sendText({ session, text }) {
    this.assertConfig();
    if (!this.hasConfig()) return this.mock.sendText({ session, text });
    const out = await this.request('/v1/input/text', {
      providerSessionId: session?.remote?.providerSessionId || null,
      text: text || ''
    });
    return {
      sessionId: session.sessionId,
      type: 'text',
      provider: 'live2d',
      outputText: out.outputText || text || '',
      visual: out.visual || { speaking: true, form: session.form },
      ...out
    };
  }

  async sendAudio({ session, audioUrl, audioBase64 }) {
    this.assertConfig();
    if (!this.hasConfig()) return this.mock.sendAudio({ session, audioUrl, audioBase64 });
    const out = await this.request('/v1/input/audio', {
      providerSessionId: session?.remote?.providerSessionId || null,
      audioUrl: audioUrl || '',
      audioBase64: audioBase64 || ''
    });
    return {
      sessionId: session.sessionId,
      type: 'audio',
      provider: 'live2d',
      ...out
    };
  }

  async switchForm({ session, form }) {
    this.assertConfig();
    if (!this.hasConfig()) return this.mock.switchForm({ session, form });
    const out = await this.request('/v1/form/switch', {
      providerSessionId: session?.remote?.providerSessionId || null,
      form
    });
    return {
      sessionId: session.sessionId,
      switchedTo: form,
      provider: 'live2d',
      ...out
    };
  }

  async status({ session }) {
    const available = this.hasConfig();
    const activeModel3Url = process.env.LIVE2D_MODEL3_URL || '';
    const model3Source = activeModel3Url ? 'provider-env' : 'none';

    if (!available) {
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
        degrade: {
          to: 'text_only',
          reason: 'LIVE2D_ENDPOINT missing; running in mock compatibility mode.'
        },
        visualManifest: { version: '0.1' },
        media: {
          avatarImage: null,
          avatarVideo: null,
          model3Url: activeModel3Url || null
        },
        model3Source: { source: model3Source, model3Url: activeModel3Url || null, rendererHint: activeModel3Url ? 'live2d-preferred-with-client-fallback' : 'vector-fallback' },
        providerSessionId: session?.remote?.providerSessionId || null
      };
    }
    try {
      const providerSessionId = session?.remote?.providerSessionId || null;
      const statusPath = providerSessionId
        ? `/v1/status?providerSessionId=${encodeURIComponent(providerSessionId)}`
        : '/v1/status';
      const out = await this.request(statusPath);
      const resolvedModel3Url = out.media?.model3Url || out.model3Url || activeModel3Url || null;
      return {
        capabilities: out.capabilities || {
          image: true,
          model3d: false,
          motion: true,
          voice: true,
          hearing: true,
          worldSense: false
        },
        providerCapabilities: out.providerCapabilities || {
          faceRig: true,
          lipSync: true,
          gaze: true,
          blink: true,
          bodyMotion: false,
          streaming: false
        },
        degrade: out.degrade || null,
        visualManifest: out.visualManifest || { version: '0.1' },
        appearanceIntent: out.appearanceIntent || undefined,
        faceControl: out.faceControl || undefined,
        media: {
          ...(out.media || { avatarImage: null, avatarVideo: null }),
          model3Url: resolvedModel3Url
        },
        model3Source: out.model3Source || {
          source: resolvedModel3Url ? 'bridge' : 'none',
          model3Url: resolvedModel3Url,
          rendererHint: resolvedModel3Url ? 'live2d-preferred-with-client-fallback' : 'vector-fallback'
        },
        providerSessionId: out.providerSessionId || providerSessionId
      };
    } catch (err) {
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
        degrade: {
          to: 'text_only',
          reason: err.message || 'Live2D bridge unavailable.'
        },
        visualManifest: { version: '0.1' },
        media: {
          avatarImage: null,
          avatarVideo: null,
          model3Url: activeModel3Url || null
        },
        model3Source: {
          source: 'bridge-error',
          model3Url: activeModel3Url || null,
          rendererHint: 'vector-fallback',
          error: err.message || 'bridge unavailable'
        },
        providerSessionId: session?.remote?.providerSessionId || null
      };
    }
  }
}

module.exports = {
  Live2DProvider
};
