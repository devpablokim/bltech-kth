// Vercel Serverless Function — 모든 /api/* 요청을 BL-tech MediERP 라우터(erp/lib/api.js)로 위임한다.
// 로컬(erp/server.js)과 동일한 비즈니스 로직이 서버단에서 그대로 동작한다.
//
// 주의: Vercel 파일시스템은 읽기 전용이라 DB는 /tmp에 영속화된다(웜 인스턴스 동안 유지).
//       콜드 스타트 시 시드 데이터로 재생성되는 데모 운영 모드다.
//       Claude 연동은 Vercel 프로젝트 환경변수에 ANTHROPIC_API_KEY를 등록하면 활성화된다.
const { loadDb, saveDb } = require('../erp/lib/db');
const { handleApi } = require('../erp/lib/api');

let db; // 웜 인스턴스 동안 메모리에 유지

function parseBody(req) {
  if (req.body == null) return null;
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return { csv: req.body }; }
  }
  return null;
}

module.exports = async (req, res) => {
  try {
    if (!db) db = loadDb();
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const { result, mutated } = await handleApi(db, req.method, pathname, parseBody(req));
    if (result && result.__status) {
      const { __status, ...rest } = result;
      return res.status(__status).json(rest);
    }
    if (mutated) { try { saveDb(db); } catch { /* 읽기 전용 폴백 — 메모리 상태는 유지됨 */ } }
    res.setHeader('cache-control', 'no-store');
    return res.status(200).json(result);
  } catch (e) {
    console.error('[api]', req.method, req.url, e);
    return res.status(500).json({ error: '서버 오류: ' + e.message });
  }
};
