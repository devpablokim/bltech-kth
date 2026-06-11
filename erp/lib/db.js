// 파일 기반 영속 DB — 서버 시작 시 시드, 모든 변경은 API를 통해서만 발생하고 즉시 디스크에 저장된다.
const fs = require('node:fs');
const path = require('node:path');
const { buildSeed } = require('./seed');

// Vercel 등 서버리스 환경은 파일시스템이 읽기 전용이므로 /tmp에 영속화한다
// (웜 인스턴스 동안 유지, 콜드 스타트 시 시드로 재생성 — 데모 운영 모드)
const DATA_DIR = process.env.VERCEL ? '/tmp/bltech-erp-data' : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
      console.error('[db] db.json 파싱 실패 — 시드로 재생성합니다:', e.message);
    }
  }
  const db = buildSeed();
  saveDb(db);
  console.log('[db] 시드 데이터 생성 완료 →', DB_PATH);
  return db;
}

function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 1), 'utf8');
}

module.exports = { loadDb, saveDb, DB_PATH };
