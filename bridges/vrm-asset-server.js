#!/usr/bin/env node
/**
 * vrm-asset-server.js — Static asset bridge for VRM model files.
 *
 * Serves VRM model files from assets/vrm/slot/ over HTTP with CORS enabled,
 * so the browser-side VRMRenderer can load them from any origin.
 *
 * Usage:
 *   node bridges/vrm-asset-server.js
 *   VRM_BRIDGE_PORT=3756 node bridges/vrm-asset-server.js
 *
 * Endpoints:
 *   GET /health                      — liveness check
 *   GET /assets/vrm/slot/*           — serve VRM model files
 *   GET /assets/vrm/slot/list        — JSON list of available .vrm files
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const port     = Number(process.env.VRM_BRIDGE_PORT || 3756);
const assetDir = path.resolve(process.cwd(), 'assets/vrm/slot');
const ASSET_PREFIX = '/assets/vrm/slot/';

const MIME = {
  '.vrm':  'model/gltf-binary',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, code, data) {
  cors(res);
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  cors(res);
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  });
}

function listVrmFiles() {
  if (!fs.existsSync(assetDir)) return [];
  return fs.readdirSync(assetDir)
    .filter(function (f) { return path.extname(f).toLowerCase() === '.vrm'; })
    .map(function (f) {
      return {
        name: f,
        url: ASSET_PREFIX + f,
      };
    });
}

const server = http.createServer(function (req, res) {
  const { method, url } = req;

  if (method === 'OPTIONS') {
    cors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === 'GET' && url === '/health') {
    return json(res, 200, { ok: true, server: 'vrm-asset-server', assetDir });
  }

  if (method === 'GET' && url === ASSET_PREFIX + 'list') {
    return json(res, 200, { models: listVrmFiles() });
  }

  if (method === 'GET' && url.startsWith(ASSET_PREFIX)) {
    const rel      = decodeURIComponent(url.slice(ASSET_PREFIX.length));
    const filePath = path.resolve(assetDir, rel);
    // Prevent path traversal
    if (!filePath.startsWith(assetDir + path.sep) && filePath !== assetDir) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    return serveFile(res, filePath);
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(port, function () {
  const models = listVrmFiles();
  console.log('[vrm-asset-server] listening on http://127.0.0.1:' + port);
  console.log('[vrm-asset-server] serving:', assetDir);
  if (models.length === 0) {
    console.log('[vrm-asset-server] no .vrm files found — place .vrm files in assets/vrm/slot/');
    console.log('[vrm-asset-server] free models: https://hub.vroid.com (CC license)');
  } else {
    models.forEach(function (m) {
      console.log('[vrm-asset-server]  ' + m.url);
    });
  }
});
