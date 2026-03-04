const { HeygenProvider } = require('./provider-heygen');
const { MockProvider } = require('./provider-mock');

function createProvider(name, opts = {}) {
  switch (name) {
    case 'heygen':
      return new HeygenProvider(opts);
    case 'mock':
      return new MockProvider(opts);
    default:
      throw new Error(`Unknown avatar provider: ${name}`);
  }
}

module.exports = {
  createProvider
};
