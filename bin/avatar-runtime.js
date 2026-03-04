#!/usr/bin/env node

const { startServer } = require('../src/server');

function parsePort(argv) {
  const idx = argv.indexOf('--port');
  if (idx === -1) return Number(process.env.PORT || 3721);
  const raw = argv[idx + 1];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 3721;
}

const port = parsePort(process.argv);

startServer({ port }).catch((err) => {
  console.error('[avatar-runtime] failed to start:', err.message);
  process.exit(1);
});
