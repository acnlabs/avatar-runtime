const { MockProvider } = require('./provider-mock');

class HeygenProvider {
  constructor(opts = {}) {
    this.apiKey = opts.heygenApiKey || process.env.HEYGEN_API_KEY || '';
    this.baseUrl = opts.baseUrl || process.env.HEYGEN_BASE_URL || 'https://api.heygen.com';
    this.mock = new MockProvider();
  }

  hasKey() {
    return !!this.apiKey;
  }

  async startSession(payload = {}) {
    if (!this.hasKey()) {
      return this.mock.startSession(payload);
    }
    return {
      providerSessionId: `heygen-${Date.now()}`,
      personaId: payload.personaId || 'unknown',
      note: 'MVP placeholder: wire HeyGen session create API here'
    };
  }

  async sendText({ session, text }) {
    if (!this.hasKey()) {
      return this.mock.sendText({ session, text });
    }
    return {
      sessionId: session.sessionId,
      type: 'text',
      outputText: text,
      visual: { speaking: true, form: session.form },
      note: 'MVP placeholder: wire HeyGen text chat API here'
    };
  }

  async sendAudio({ session, audioUrl, audioBase64 }) {
    if (!this.hasKey()) {
      return this.mock.sendAudio({ session, audioUrl, audioBase64 });
    }
    return {
      sessionId: session.sessionId,
      type: 'audio',
      transcript: 'MVP placeholder transcript',
      outputText: 'MVP placeholder: wire HeyGen voice API here',
      visual: { speaking: true, form: session.form }
    };
  }

  async switchForm({ session, form }) {
    if (!this.hasKey()) {
      return this.mock.switchForm({ session, form });
    }
    return {
      sessionId: session.sessionId,
      switchedTo: form,
      provider: 'heygen',
      note: 'MVP placeholder: map form to HeyGen avatar preset/scene'
    };
  }

  async status() {
    return {
      capabilities: {
        image: true,
        model3d: false,
        motion: true,
        voice: true,
        hearing: true,
        worldSense: false
      }
    };
  }
}

module.exports = {
  HeygenProvider
};
