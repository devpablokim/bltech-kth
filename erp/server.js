#!/usr/bin/env node
// 비엘테크(BL-tech) MediERP 서버 — 외부 의존성 0개 (Node 내장 모듈만 사용)
// 모든 기능(집계·판정·문서생성·AI)은 이 서버의 REST API에서 동작한다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loadDb, saveDb } = require('./lib/db');
const { handleApi } = require('./lib/api');

// data/.env 로드 (외부 의존성 없이) — ANTHROPIC_API_KEY 등. 이미 설정된 환경변수는 덮어쓰지 않는다.
(function loadEnv() {
  const envPath = path.join(__dirname, 'data', '.env');
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    let loaded = 0;
    for (const line of txt.split(/\r?\n/)) {
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!(m[1] in process.env) && val) { process.env[m[1]] = val; loaded++; }
    }
    if (loaded) console.log(`[env] data/.env 로드 — 변수 ${loaded}개 적용`);
  } catch { /* .env 없으면 무시 */ }
})();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const db = loadDb();

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  // Vercel 배포와 동일하게 /dashboard 경로에서도 서비스 (자산 경로 통일)
  if (pathname === '/dashboard' || pathname === '/dashboard/') pathname = '/index.html';
  else if (pathname.startsWith('/dashboard/')) pathname = pathname.slice('/dashboard'.length);
  let file = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.join(PUBLIC_DIR, path.normalize(file));
  if (!resolved.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      // SPA 폴백
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not Found'); }
        res.writeHead(200, { 'content-type': MIME['.html'] });
        res.end(idx);
      });
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(resolved)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(u.pathname);

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  let raw = '';
  req.on('data', (chunk) => { raw += chunk; if (raw.length > 2e6) req.destroy(); });
  req.on('end', async () => {
    let body = null;
    if (raw) { try { body = JSON.parse(raw); } catch { body = { csv: raw }; } }
    try {
      const { result, mutated } = await handleApi(db, req.method, pathname, body);
      if (result && result.__status) {
        const { __status, ...rest } = result;
        return sendJson(res, __status, rest);
      }
      if (mutated) saveDb(db);
      sendJson(res, 200, result);
    } catch (e) {
      console.error('[api]', req.method, pathname, e);
      sendJson(res, 500, { error: '서버 오류: ' + e.message });
    }
  });
});

server.listen(PORT, () => {
  console.log('───────────────────────────────────────────────');
  console.log('  BL-tech MediERP · 비엘테크 의료용품 통합 ERP');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  AI 엔진: ${process.env.ANTHROPIC_API_KEY ? 'Claude API 연동' : '내장 룰 엔진 (ANTHROPIC_API_KEY 설정 시 Claude 연동)'}`);
  console.log('───────────────────────────────────────────────');
});
