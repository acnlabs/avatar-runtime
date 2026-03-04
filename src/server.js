const http = require('node:http');
const { AvatarRuntime } = require('./runtime');

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function route(req, res, runtime) {
  const { method, url } = req;
  if (method === 'GET' && url === '/health') {
    return json(res, 200, { ok: true, runtime: 'avatar-runtime' });
  }

  if (method === 'POST' && url === '/v1/session/start') {
    const body = await parseBody(req);
    const out = await runtime.startSession(body);
    return json(res, 200, out);
  }

  if (method === 'POST' && url === '/v1/input/text') {
    const body = await parseBody(req);
    const out = await runtime.sendText(body);
    return json(res, 200, out);
  }

  if (method === 'POST' && url === '/v1/input/audio') {
    const body = await parseBody(req);
    const out = await runtime.sendAudio(body);
    return json(res, 200, out);
  }

  if (method === 'POST' && url === '/v1/form/switch') {
    const body = await parseBody(req);
    const out = await runtime.switchForm(body);
    return json(res, 200, out);
  }

  if (method === 'GET' && url.startsWith('/v1/status')) {
    const query = new URL(`http://localhost${url}`).searchParams;
    const sessionId = query.get('sessionId');
    const out = await runtime.status({ sessionId });
    return json(res, 200, out);
  }

  return json(res, 404, { error: 'Not found' });
}

async function startServer({ port = 3721 } = {}) {
  const runtime = new AvatarRuntime();
  const server = http.createServer(async (req, res) => {
    try {
      await route(req, res, runtime);
    } catch (err) {
      const code = err.statusCode || 400;
      json(res, code, {
        error: err.message || 'Request failed'
      });
    }
  });

  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`[avatar-runtime] listening on http://127.0.0.1:${port}`);
  return server;
}

module.exports = {
  startServer
};
