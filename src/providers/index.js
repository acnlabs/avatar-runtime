const { HeygenProvider } = require('./provider-heygen');
const { MockProvider } = require('./provider-mock');
const { KusaPicsProvider } = require('./provider-kusapics');
const { Live2DProvider } = require('./provider-live2d');
const { VrmProvider } = require('./provider-vrm');

function assertProviderContract(provider, name) {
  const required = ['startSession', 'sendText', 'sendAudio', 'switchForm', 'status'];
  for (const method of required) {
    if (!provider || typeof provider[method] !== 'function') {
      throw new Error(`Invalid avatar provider "${name}": missing method ${method}()`);
    }
  }
  return provider;
}

function createProvider(name, opts = {}) {
  switch (name) {
    case 'heygen':
      return assertProviderContract(new HeygenProvider(opts), name);
    case 'kusapics':
      return assertProviderContract(new KusaPicsProvider(opts), name);
    case 'live2d':
      return assertProviderContract(new Live2DProvider(opts), name);
    case 'vrm':
      return assertProviderContract(new VrmProvider(opts), name);
    case 'mock':
      return assertProviderContract(new MockProvider(opts), name);
    default:
      throw new Error(`Unknown avatar provider: ${name}`);
  }
}

module.exports = {
  createProvider
};
