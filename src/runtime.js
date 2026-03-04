const { randomUUID } = require('node:crypto');
const { createProvider } = require('./providers');

function nowIso() {
  return new Date().toISOString();
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
    return {
      runtime: 'avatar-runtime',
      provider: this.providerName,
      available: true,
      degrade: null,
      capabilities: providerStatus.capabilities,
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
