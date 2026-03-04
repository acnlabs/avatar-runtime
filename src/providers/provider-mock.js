class MockProvider {
  async startSession(payload = {}) {
    return {
      providerSessionId: `mock-${Date.now()}`,
      personaId: payload.personaId || 'unknown'
    };
  }

  async sendText({ session, text }) {
    return {
      sessionId: session.sessionId,
      type: 'text',
      outputText: `Mock avatar received: ${text}`,
      audioUrl: null,
      visual: {
        speaking: true,
        form: session.form
      }
    };
  }

  async sendAudio({ session, audioUrl }) {
    return {
      sessionId: session.sessionId,
      type: 'audio',
      transcript: audioUrl ? 'mock transcript from audioUrl' : 'mock transcript from audioBase64',
      outputText: 'Mock avatar processed your audio.',
      visual: {
        speaking: true,
        form: session.form
      }
    };
  }

  async switchForm({ session, form }) {
    return {
      sessionId: session.sessionId,
      switchedTo: form,
      provider: 'mock'
    };
  }

  async status() {
    return {
      capabilities: {
        image: true,
        model3d: true,
        motion: true,
        voice: true,
        hearing: true,
        worldSense: false
      }
    };
  }
}

module.exports = {
  MockProvider
};
