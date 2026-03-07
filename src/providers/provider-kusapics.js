// TODO: KusaPics provider is a skeleton — all methods degrade to mock.
// Implement real API calls once KusaPics integration is ready:
//   - startSession: POST /session to KusaPics API, get session token
//   - sendText: POST /generate with prompt, get image/video URL
//   - sendAudio: POST /generate with audio, get animated response
//   - switchForm: update rendering mode (image/video/face)
//   - status: return real faceControl values from KusaPics response
// Ref: docs/PROVIDER-CONTRACT.md for the full interface contract.
const { MockProvider } = require('./provider-mock');

class KusaPicsProvider {
  constructor(opts = {}) {
    this.apiKey = opts.kusapicsApiKey || process.env.KUSAPICS_API_KEY || '';
    this.baseUrl = opts.baseUrl || process.env.KUSAPICS_BASE_URL || '';
    this.strict = String(opts.strict ?? process.env.KUSAPICS_STRICT ?? 'false') === 'true';
    this.mock = new MockProvider();
  }

  hasConfig() {
    return !!this.apiKey && !!this.baseUrl;
  }

  assertConfig() {
    if (!this.hasConfig() && this.strict) {
      const err = new Error('KUSAPICS_API_KEY and KUSAPICS_BASE_URL are required when KUSAPICS_STRICT=true');
      err.statusCode = 400;
      throw err;
    }
  }

  async startSession(payload = {}) {
    this.assertConfig();
    if (!this.hasConfig()) {
      return this.mock.startSession(payload);
    }
    return {
      providerSessionId: `kusapics-${Date.now()}`,
      personaId: payload.personaId || 'unknown',
      mode: payload.form || 'image',
      note: 'KusaPics provider skeleton: wire real session/task API here.'
    };
  }

  async sendText({ session, text }) {
    this.assertConfig();
    if (!this.hasConfig()) {
      return this.mock.sendText({ session, text });
    }
    return {
      sessionId: session.sessionId,
      type: 'text',
      provider: 'kusapics',
      outputText: text || '',
      task: {
        status: 'queued',
        type: session.form === 'motion' ? 'video' : 'image'
      },
      unsupported: true,
      reason: 'KusaPics API wiring pending: map text prompt to image/video generation endpoints.'
    };
  }

  async sendAudio({ session, audioUrl, audioBase64 }) {
    this.assertConfig();
    if (!this.hasConfig()) {
      return this.mock.sendAudio({ session, audioUrl, audioBase64 });
    }
    return {
      sessionId: session.sessionId,
      type: 'audio',
      provider: 'kusapics',
      unsupported: true,
      reason: 'KusaPics audio-to-avatar flow is not wired in skeleton provider yet.'
    };
  }

  async switchForm({ session, form }) {
    this.assertConfig();
    if (!this.hasConfig()) {
      return this.mock.switchForm({ session, form });
    }
    return {
      sessionId: session.sessionId,
      switchedTo: form,
      provider: 'kusapics'
    };
  }

  async status({ session }) {
    const available = this.hasConfig();
    return {
      capabilities: {
        image: true,
        model3d: false,
        motion: true,
        voice: false,
        hearing: false,
        worldSense: false
      },
      providerCapabilities: {
        faceRig: false,
        lipSync: false,
        gaze: false,
        blink: false,
        bodyMotion: false,
        streaming: false
      },
      degrade: available
        ? null
        : {
            to: 'text_only',
            reason: 'KUSAPICS_API_KEY/KUSAPICS_BASE_URL missing; running in mock compatibility mode.'
          },
      visualManifest: {
        version: '0.1'
      },
      media: {
        avatarImage: null,
        avatarVideo: null
      },
      providerSessionId: session?.remote?.providerSessionId || null
    };
  }
}

module.exports = {
  KusaPicsProvider
};
