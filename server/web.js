// Serveur web statique pour la version en ligne : sert le jeu compilé (dossier dist/) avec
// compression, cache adapté et en-têtes de sécurité. Le WebSocket du jeu se branche sur le même port.
import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { createHash } from 'crypto';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.wasm': 'application/wasm', '.apk': 'application/vnd.android.package-archive', '.exe': 'application/vnd.microsoft.portable-executable'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.webmanifest', '.gltf', '.glb', '.wasm']);

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "media-src 'self' data: blob:",
  "font-src 'self' data:", "connect-src 'self' ws: wss: blob: data:", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'"
].join('; ');

export function createWebServer({ distDir, onHealth, onApi }) {
  const cache = new Map(); // chemin -> { buf, gz, type, etag, immutable }

  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const file = path.join(distDir, rel);
    if (!file.startsWith(distDir + path.sep) && file !== distDir) return null; // anti « ../ »
    let st;
    try { st = fs.statSync(file); } catch { return null; }
    if (!st.isFile()) return null;
    const ext = path.extname(file).toLowerCase();
    const buf = fs.readFileSync(file);
    const entry = {
      buf, type: MIME[ext] || 'application/octet-stream',
      gz: COMPRESSIBLE.has(ext) && buf.length > 512 ? zlib.gzipSync(buf, { level: 9 }) : null,
      etag: '"' + createHash('sha1').update(buf).digest('hex').slice(0, 20) + '"',
      immutable: /^assets\//.test(rel)
    };
    if (buf.length < 25 * 1024 * 1024) cache.set(rel, entry);
    return entry;
  }


  function serveAudio(req, res, rel, base) {
    const file = path.join(distDir, rel);
    if (!file.startsWith(distDir + path.sep)) { res.writeHead(404, base); res.end(); return; }
    let st;
    try { st = fs.statSync(file); } catch { st = null; }
    if (!st || !st.isFile()) { res.writeHead(404, { ...base, 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Introuvable'); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = { ...base, 'Content-Type': type, ETag: etag, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=604800' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
    let start = 0, end = st.size - 1, status = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') { start = Math.max(0, st.size - Number(m[2])); } else { start = Number(m[1]); if (m[2] !== '') end = Math.min(end, Number(m[2])); }
      if (start > end || start >= st.size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => { try { res.destroy(); } catch { /* ignoré */ } });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }

  const server = http.createServer((req, res) => {
    const https = (req.headers['x-forwarded-proto'] || '').includes('https');
    const base = {
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': CSP
    };
    if (https) base['Strict-Transport-Security'] = 'max-age=31536000';
    if (onApi && req.url && req.url.startsWith('/api/')) { // V10.2 : API (paiements) — gérée par server.js, jamais mise en cache
      Promise.resolve(onApi(req, res, { ...base, 'Cache-Control': 'no-store' })).catch((e) => { try { res.writeHead(500, base); res.end(); } catch { /* ignoré */ } console.error('[Korvalune] api :', e?.message); });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { ...base, Allow: 'GET, HEAD' }); res.end(); return; }
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400, base); res.end(); return; }
    if (url.pathname === '/healthz') { res.writeHead(200, { ...base, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(onHealth ? onHealth() : { ok: true })); return; }
    // Nom de domaine officiel (variable PUBLIC_HOST, ex. korvalune.fr) : le site vitrine n'est servi que là, l'ancienne adresse y redirige.
    const wantHost = (process.env.PUBLIC_HOST || '').trim().toLowerCase();
    const gotHost = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (wantHost && gotHost && gotHost !== wantHost && /^\/(bienvenue|accueil|robots\.txt|sitemap\.xml)/.test(url.pathname)) {
      res.writeHead(301, { ...base, Location: 'https://' + wantHost + (url.pathname === '/accueil' || url.pathname === '/accueil/' ? '/bienvenue/' : url.pathname) }); res.end(); return;
    }
    if (url.pathname === '/bienvenue' || url.pathname === '/accueil' || url.pathname === '/accueil/') { res.writeHead(302, { ...base, Location: '/bienvenue/', 'Cache-Control': 'no-cache' }); res.end(); return; } // V10.66 : site vitrine public
    let rel;
    try { rel = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch { res.writeHead(400, base); res.end(); return; }
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    // V10.40 : fichiers audio (musiques en flux, bruitages) — lus à la demande sans les garder en mémoire, avec requêtes partielles (Range)
    // indispensables aux lecteurs <audio> de Safari / iOS
    if (/^audio\/.+\.(mp3|ogg|wav)$/i.test(rel)) { serveAudio(req, res, rel, base); return; }
    const entry = load(rel);
    if (!entry) { res.writeHead(404, { ...base, 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Introuvable'); return; }
    const headers = { ...base, 'Content-Type': entry.type, ETag: entry.etag, 'Cache-Control': entry.immutable ? 'public, max-age=31536000, immutable' : 'no-cache', Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304, headers); res.end(); return; }
    const useGz = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const body = useGz ? entry.gz : entry.buf;
    if (useGz) headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return server;
}
