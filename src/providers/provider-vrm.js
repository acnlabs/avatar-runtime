const { MockProvider } = require('./provider-mock');

/**
 * VrmProvider — local VRM 3D avatar provider.
 *
 * Unlike cloud providers (HeyGen, D-ID), VRM rendering is entirely client-side.
 * This provider's job is to expose the VRM model URL in the session status so
 * the browser-side VRMRenderer can pick it up.
 *
 * A VRM asset bridge (bridges/vrm-asset-server.js) serves the model files over
 * HTTP, and this provider constructs the model URL from the bridge endpoint.
 *
 * Env vars:
 *   VRM_BRIDGE_ENDPOINT   URL of the running vrm-asset-server (default: http://127.0.0.1:3756)
 *   VRM_MODEL_URL         Override: direct URL to a .vrm file (skips bridge)
 *   VRM_STRICT            Set true to fail when bridge is unreachable (default: false)
 */
class VrmProvider {
  constructor(opts = {}) {
    this.bridgeEndpoint = opts.vrmBridgeEndpoint || process.env.VRM_BRIDGE_ENDPOINT || 'http://127.0.0.1:3756';
    this.modelUrl       = opts.vrmModelUrl       || process.env.VRM_MODEL_URL       || '';
    this.strict         = String(opts.strict ?? process.env.VRM_STRICT ?? 'false') === 'true';
    this.mock           = new MockProvider();
  }

  _resolvedModelUrl() {
    return this.modelUrl || `${this.bridgeEndpoint}/assets/vrm/slot/default.vrm`;
  }

  async startSession(payload = {}) {
    const session = await this.mock.startSession(payload);
    return {
      ...session,
      provider: 'vrm',
    };
  }

  async sendText(payload = {}) {
    return this.mock.sendText(payload);
  }

  async sendAudio(payload = {}) {
    return this.mock.sendAudio(payload);
  }

  async switchForm(payload = {}) {
    return this.mock.switchForm(payload);
  }

  async status(payload = {}) {
    const base = await this.mock.status(payload);
    return {
      ...base,
      provider: 'vrm',
      providerCapabilities: {
        faceRig:      true,
        gaze:         true,
        blink:        true,
        lipSync:      false,
        bodyMotion:   false,
        streaming:    false,
        bodyRig:      true,
        sceneControl: true,
      },
      media: {
        ...base.media,
        avatarModelVrmUrl: this._resolvedModelUrl(),
      },
    };
  }
}

module.exports = { VrmProvider };
