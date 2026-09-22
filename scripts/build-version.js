#!/usr/bin/env node
// Runs at build time (e.g. via `npm run build` on Railway/Nixpacks).
// Writes version.json so the server can read it at runtime without needing git.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let version;
if (process.env.RAILWAY_GIT_COMMIT_SHA) {
  // Railway's Nixpacks build strips .git from the build context, so `git` isn't
  // available there — use the git info Railway injects as env vars instead.
  const full = process.env.RAILWAY_GIT_COMMIT_SHA;
  version = {
    hash: full.slice(0, 7),
    full,
    date: new Date().toISOString(),
    message: process.env.RAILWAY_GIT_COMMIT_MESSAGE || '',
  };
} else {
  try {
    const hash    = execSync('git rev-parse --short HEAD').toString().trim();
    const full    = execSync('git rev-parse HEAD').toString().trim();
    const date    = execSync('git log -1 --format=%cI').toString().trim(); // ISO 8601 with colon in tz
    const message = execSync('git log -1 --format=%s').toString().trim();
    version = { hash, full, date, message };
  } catch {
    version = {
      hash: 'unknown',
      full: 'unknown',
      date: new Date().toISOString(),
      message: '',
    };
  }
}

const out = path.join(__dirname, '..', 'version.json');
fs.writeFileSync(out, JSON.stringify(version, null, 2));
console.log('version.json written:', version.hash, version.date);

// Stamp the service worker's cache name with this build's commit hash, so
// sw.js is byte-different on every deploy — otherwise the browser's SW
// update check (a byte-for-byte diff of sw.js) sees no change, never
// installs the new worker, and the cache-first strategy in the fetch
// handler keeps serving last deploy's JS/CSS indefinitely.
const swPath = path.join(__dirname, '..', 'sw.js');
const swSrc = fs.readFileSync(swPath, 'utf8');
const stamped = swSrc.replace(
  /const CACHE_NAME = '[^']*';/,
  `const CACHE_NAME = 'workout-tracker-${version.hash}';`
);
if (stamped === swSrc) {
  console.warn('sw.js CACHE_NAME line not found — service worker cache was not stamped.');
} else {
  fs.writeFileSync(swPath, stamped);
  console.log('sw.js stamped with cache name: workout-tracker-' + version.hash);
}
