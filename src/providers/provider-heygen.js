const { MockProvider } = require('./provider-mock');

class HeygenProvider {
  constructor(opts = {}) {
    this.apiKey = opts.heygenApiKey || process.env.HEYGEN_API_KEY || '';
    this.baseUrl = opts.baseUrl || process.env.HEYGEN_BASE_URL || 'https://api.heygen.com';
    this.defaultAvatarId = opts.avatarId || process.env.HEYGEN_AVATAR_ID || 'default';
    this.defaultQuality = opts.quality || process.env.HEYGEN_QUALITY || 'medium';
    this.defaultTaskType = opts.taskType || process.env.HEYGEN_TASK_TYPE || 'chat';
    this.defaultTaskMode = opts.taskMode || process.env.HEYGEN_TASK_MODE || 'sync';
    this.strict = String(opts.strict ?? process.env.HEYGEN_STRICT ?? 'false') === 'true';
    this.timeoutMs = Number(opts.timeoutMs || process.env.HEYGEN_TIMEOUT_MS || 20000);
    this.mock = new MockProvider();
  }

  hasKey() {
    return !!this.apiKey;
  }

  normalizeBaseUrl() {
    return this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
  }

  async request(path, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.normalizeBaseUrl()}${path}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(payload || {}),
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
        const err = new Error(`HeyGen API ${res.status} on ${path}`);
        err.statusCode = 502;
        err.details = parsed;
        throw err;
      }
      return parsed;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`HeyGen API timeout on ${path} after ${this.timeoutMs}ms`);
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  pickSessionId(session) {
    return session.remote?.providerSessionId || session.remote?.session_id || session.remote?.sessionId;
  }

  async startSession(payload = {}) {
    if (!this.hasKey() && !this.strict) {
      return this.mock.startSession(payload);
    }
    if (!this.hasKey() && this.strict) {
      const err = new Error('HEYGEN_API_KEY is required when HEYGEN_STRICT=true');
      err.statusCode = 400;
      throw err;
    }

    const req = {
      quality: payload.quality || this.defaultQuality,
      avatar_id: payload.avatarId || this.defaultAvatarId,
      version: payload.version || 'v2',
      disable_idle_timeout: payload.disableIdleTimeout ?? false,
      activity_idle_timeout: payload.activityIdleTimeout || 120
    };
    if (payload.voice && typeof payload.voice === 'object') req.voice = payload.voice;
    if (payload.knowledgeBase) req.knowledge_base = payload.knowledgeBase;
    if (payload.knowledgeBaseId) req.knowledge_base_id = payload.knowledgeBaseId;
    if (payload.videoEncoding) req.video_encoding = payload.videoEncoding;

    const created = await this.request('/v1/streaming.new', req);
    const data = created.data || created;
    const providerSessionId = data.session_id || data.sessionId;
    if (!providerSessionId) {
      const err = new Error('HeyGen did not return session_id');
      err.statusCode = 502;
      err.details = created;
      throw err;
    }

    const started = await this.request('/v1/streaming.start', {
      session_id: providerSessionId
    });

    return {
      providerSessionId,
      personaId: payload.personaId || 'unknown',
      started: true,
      startStatus: (started.data || started).status || 'ok',
      realtimeEndpoint: data.realtime_endpoint || null,
      livekit: {
        url: data.url || null,
        accessToken: data.access_token || null
      }
    };
  }

  async sendText({ session, text }) {
    if (!this.hasKey() && !this.strict) {
      return this.mock.sendText({ session, text });
    }
    const providerSessionId = this.pickSessionId(session);
    if (!providerSessionId) {
      const err = new Error('Missing provider session id');
      err.statusCode = 400;
      throw err;
    }
    const out = await this.request('/v1/streaming.task', {
      session_id: providerSessionId,
      text: text || '',
      task_type: this.defaultTaskType,
      task_mode: this.defaultTaskMode
    });
    const data = out.data || out;
    return {
      sessionId: session.sessionId,
      type: 'text',
      outputText: text || '',
      visual: { speaking: true, form: session.form },
      provider: 'heygen',
      providerTaskId: data.task_id || data.taskId || null,
      durationMs: data.duration_ms || null
    };
  }

  async sendAudio({ session, audioUrl, audioBase64 }) {
    if (!this.hasKey() && !this.strict) {
      return this.mock.sendAudio({ session, audioUrl, audioBase64 });
    }
    // HeyGen v1 streaming REST does not expose a direct "audio upload" task endpoint.
    // For MVP, require transcript/text handoff from upstream STT or client.
    return {
      sessionId: session.sessionId,
      type: 'audio',
      transcript: null,
      outputText: null,
      visual: { speaking: false, form: session.form },
      provider: 'heygen',
      unsupported: true,
      reason: 'Direct audio task is not available via /v1/streaming.task; use transcript -> sendText or realtime endpoint.'
    };
  }

  async switchForm({ session, form }) {
    if (!this.hasKey() && !this.strict) {
      return this.mock.switchForm({ session, form });
    }
    return {
      sessionId: session.sessionId,
      switchedTo: form,
      provider: 'heygen',
      note: 'Form is tracked by runtime; map to HeyGen avatar preset/scene at orchestration layer.'
    };
  }

  async closeSession({ session }) {
    const providerSessionId = this.pickSessionId(session);
    if (!providerSessionId) return { status: 'noop' };
    if (!this.hasKey() && !this.strict) return { status: 'mock_closed' };
    const out = await this.request('/v1/streaming.stop', {
      session_id: providerSessionId
    });
    return out.data || out;
  }

  async status({ session }) {
    const hasRealProvider = this.hasKey();
    return {
      capabilities: {
        image: true,
        model3d: false,
        motion: true,
        voice: true,
        hearing: hasRealProvider,
        worldSense: false
      },
      degrade: hasRealProvider
        ? null
        : {
            to: 'text_only',
            reason: 'HEYGEN_API_KEY missing; running in mock compatibility mode.'
          },
      providerSessionId: session ? this.pickSessionId(session) : null
    };
  }
}

module.exports = {
  HeygenProvider
};
