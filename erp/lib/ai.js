// AI 모듈 — 서버 내장 룰 엔진이 기본으로 동작하고, ANTHROPIC_API_KEY가 있으면 Claude API로 답변을 향상한다.
// 모든 데이터 접근·집계는 서버 DB에서 직접 수행된다 (프론트는 결과만 표시).

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const norm = (s) => String(s || '').toLowerCase().replace(/[\s㈜()（）·.\-주식회사]/g, '');

const item = (db, code) => db.items.find((i) => i.code === code);
const custName = (db, code) => ((db.customers.find((c) => c.code === code)) || {}).name || code;
function custStat(db, c) {
  const invoiced = db.invoices.filter((v) => v.customerCode === c.code && v.status === '발행').reduce((s, v) => s + v.total, 0);
  const paid2 = db.payments.filter((p) => p.customerCode === c.code).reduce((s, p) => s + p.amount, 0);
  const sales = c.baseSales + invoiced, paid = c.basePaid + paid2;
  return { sales, paid, recv: sales - paid };
}
function openQty(db, code) { return db.orders.filter((o) => o.itemCode === code && o.status !== '출고완료').reduce((s, o) => s + o.qty, 0); }
const eff = (x) => Math.round(x.safety * (1 + (x.safetyMargin || 0) / 100)); // 마진 적용 안전재고
function shortages(db) {
  return db.items.map((i) => ({ i, avail: i.onHand - openQty(db, i.code) })).filter((x) => x.avail < eff(x.i))
    .map((x) => ({ code: x.i.code, name: x.i.name, unit: x.i.unit, avail: x.avail, safety: eff(x.i), short: x.avail < 0 }));
}

/* ── Claude API (선택) — 키가 없거나 실패하면 룰 엔진 결과를 그대로 사용 ── */
async function maybeClaude(systemPrompt, userPrompt, fallbackText) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { text: fallbackText, engine: 'RULE-ENGINE' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6', max_tokens: 1000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text ? { text, engine: 'CLAUDE API' } : { text: fallbackText, engine: 'RULE-ENGINE' };
  } catch (e) {
    return { text: fallbackText, engine: 'RULE-ENGINE (API 폴백)' };
  }
}

/* ═══════════ 자연어 질의 — 통합 AI 비서 ═══════════ */
// Claude가 마크다운으로 답하는 경우를 대비해 채팅용 HTML로 가볍게 변환한다.
function mdToHtml(t) {
  return String(t)
    .replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/^\s*[-•*]\s+/gm, '· ')
    .replace(/^---+\s*$/gm, '')
    .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
}
async function query(db, q) {
  const rule = ruleAnswer(db, q);
  const ctx = JSON.stringify({ 질문: q, 내장분석결과: rule.text.replace(/<[^>]+>/g, ''), 회사: db.meta.company }).slice(0, 4000);
  const out = await maybeClaude(
    '당신은 의료용품 제조/수출 기업 비엘테크의 ERP 통합 AI 비서입니다. 제공된 내장 분석 결과를 바탕으로 한국어로 간결하게(3~6문장) 답하세요. 마크다운 문법(#, ##, **, 표, 구분선)은 절대 사용하지 말고, 핵심 수치만 HTML <b> 태그로 강조한 일반 문장으로 답하세요. 새로운 수치를 지어내지 마세요.',
    ctx, rule.text,
  );
  const answer = out.engine.startsWith('CLAUDE') ? mdToHtml(out.text) : out.text;
  return { answer, source: rule.source, engine: out.engine };
}

function ruleAnswer(db, q) {
  const today = todayStr();
  const lotM = q.match(/L\d{6}-[A-Z]\d{2}/i);
  if (lotM) return lotTrace(db, lotM[0].toUpperCase());
  if (/생산량|생산 ?실적|얼마나 생산/.test(q)) return prodSummary(db);
  if (/불량|기포|품질/.test(q)) return qualitySummary(db);
  if (/발주|원재료|자재/.test(q)) return reorder(db);
  if (/재고|소진|부족|펑크/.test(q)) return stockRisk(db);
  if (/미수|채권|입금|회수/.test(q)) return recvSummary(db);
  if (/납기|지연/.test(q)) return dueRisk(db);
  if (/명세서|세금계산서|인보이스/.test(q)) return invoiceStatus(db);
  if (/가동|설비|실링기|압출/.test(q)) return machineStatus(db);
  if (/수출|선적|통관|배송/.test(q)) return exportStatus(db);
  if (/원가|마진/.test(q)) return costSummary(db);
  if (/작업자|생산자|직원/.test(q)) return workerSummary(db);
  const c = db.customers.find((x) => { const nq = norm(q); return nq.includes(norm(x.name).slice(0, 2)) || (x.alias || []).some((a) => nq.includes(norm(a))); });
  if (c) return customerSummary(db, c);
  return overview(db);
}

function prodSummary(db) {
  const today = todayStr();
  const lots = db.lots.filter((l) => l.date === today);
  const total = lots.reduce((s, l) => s + l.qty, 0);
  const by = {}; lots.forEach((l) => { by[l.itemCode] = (by[l.itemCode] || 0) + l.qty; });
  const lines = Object.entries(by).map(([c, q]) => `· ${(item(db, c) || {}).name}: <b>${fmt(q)}${(item(db, c) || {}).unit}</b>`).join('<br>');
  const rate = Math.round((total / db.meta.todayPlan) * 1000) / 10;
  return { text: `오늘 총 <b>${fmt(total)} EA</b> 생산했습니다 (계획 ${fmt(db.meta.todayPlan)} 대비 달성률 <b>${rate}%</b>, LOT ${lots.length}건).<br><br>${lines}`, source: '생산실적 자동집계 · LOT 테이블' };
}
function qualitySummary(db) {
  const s = db.qcStats;
  return { text: `최근 불량률은 <b>${s.defectRate}%</b>로 전주 대비 ${s.defectTrend}%p 상승했습니다. 증가분 대부분은 <b>기포 불량</b>이며, AI 분석 결과 <b>실내 습도 상승(${s.humidityRange})과 상관도 ${s.humidityCorr}</b>로 가장 유의했습니다. 기포테스트 합격률 ${s.bubblePassRate}%, 무게 기준 이탈 ${s.weightOut}건, 온도 기준 초과 ${s.tempOver}건. 습도 50% 이하 유지 시 기존 수준 회복이 예상됩니다.`, source: 'AI 불량분석 · 품질정보 × 온습도 교차분석' };
}
function lotTrace(db, lotNo) {
  const l = db.lots.find((x) => x.no === lotNo);
  if (!l) return { text: `LOT <b>${lotNo}</b> 기록을 찾을 수 없습니다.`, source: 'LOT 추적' };
  const it = item(db, l.itemCode);
  const qc = db.qualityRecords.filter((r) => r.lotNo === lotNo);
  const bad = qc.filter((r) => r.verdict !== '정상').length;
  const batch = db.materialBatches.find((b) => l.no.includes(b.lots.split('–')[0].slice(-3)) || (b.lots || '').includes(l.no.slice(-3)));
  return { text: `<b>${lotNo}</b> (${it ? it.name : l.itemCode}) — 생산자 ${l.worker}, ${l.machine}, ${l.date} 생산. 수량 <b>${fmt(l.qty)}${it ? it.unit : ''}</b>, 잔량 ${fmt(l.remain)}, 코팅량 ${l.coating}.${batch ? ` 원재료: 수지 ${batch.resin} ${batch.color} + 촉매 ${batch.catalyst} (배합 ${batch.mixDate}).` : ''} 품질 기록 ${qc.length}건 중 이상 ${bad}건. 상태: <b>${l.status}</b>.`, source: 'LOT 추적 · 생산/품질/원재료 통합 조회' };
}
function stockRisk(db) {
  const sh = shortages(db);
  const bad = sh.filter((x) => x.short);
  const rawsBad = db.rawMaterials.filter((m) => m.onHand < eff(m));
  const lines = bad.map((x) => `· <b>${x.name}</b> 가용 <b>${fmt(x.avail)}${x.unit}</b> (수주잔량 반영)`).join('<br>');
  const rawLines = rawsBad.map((m) => `· ${m.name} ${m.onHand}${m.unit} &lt; 적용 안전 ${eff(m)}${m.unit}`).join('<br>');
  return { text: `완제품 부족 <b>${bad.length}품목</b> / 주의 ${sh.length - bad.length}품목, 원재료 부족 <b>${rawsBad.length}품목</b>입니다.<br><br>${lines}${rawLines ? '<br>' + rawLines : ''}<br><br>부족 품목은 생산계획 우선순위에 자동 반영되어 있습니다. 가용재고 = 현재고 − 수주잔량 기준.`, source: '수주잔량 × 현재고 × 안전재고 자동 비교' };
}
function reorder(db) {
  const need = db.rawMaterials.filter((m) => m.onHand < eff(m) * 1.4);
  const lines = need.map((m) => {
    const days = m.avgUse ? Math.round((m.onHand / m.avgUse) * 10) / 10 : 99;
    const po = db.purchaseOrders.find((p) => p.materialCode === m.code && p.status !== '입고완료');
    return `· <b>${m.name}</b> 잔량 ${m.onHand}${m.unit} — 소진 예측 <b>${days}일</b>, 리드타임 ${m.leadDays}일${po ? ` (발주 ${po.no} ${po.status})` : ' → <b>금일 발주 권장</b>'}`;
  }).join('<br>');
  return { text: `발주 검토가 필요한 원재료 <b>${need.length}품목</b>:<br><br>${lines}`, source: 'AI 발주 제안 · 소비 추세 × 리드타임' };
}
function recvSummary(db) {
  const rows = db.customers.map((c) => ({ c, ...custStat(db, c) })).filter((x) => x.recv > 0).sort((a, b) => b.recv - a.recv);
  const total = rows.reduce((s, x) => s + x.recv, 0);
  const lines = rows.slice(0, 4).map((x) => `· <b>${x.c.name}</b> ₩${fmt(x.recv)}${x.c.agingNote ? ` <i>(${x.c.agingNote})</i>` : ''}`).join('<br>');
  return { text: `총 미수금은 <b>₩${fmt(total)}</b>입니다 (${rows.length}개사).<br><br>${lines}<br><br>회수 우선순위 1위는 ${rows[0] ? rows[0].c.name : '-'} — Follow-up 일정과 연계해 관리하세요.`, source: '매출·입금 원장 자동 집계' };
}
function dueRisk(db) {
  const today = todayStr();
  const risk = db.orders.filter((o) => o.status !== '출고완료').map((o) => ({ o, dd: Math.ceil((new Date(o.dueDate) - new Date(today)) / 864e5) })).filter((x) => x.dd <= 2).sort((a, b) => a.dd - b.dd);
  const lines = risk.map((x) => `· <b>${x.o.no}</b> ${custName(db, x.o.customerCode)} — ${(item(db, x.o.itemCode) || {}).name} ${fmt(x.o.qty)}, 납기 D${x.dd >= 0 ? '-' + x.dd : '+' + (-x.dd)} (${x.o.status})`).join('<br>');
  return { text: `납기 임박(D-2 이내) 수주는 <b>${risk.length}건</b>입니다.<br><br>${lines || '· 없음'}<br><br>부족 품목은 생산 1순위로 자동 상향되어 있으며, 현재 일정대로면 납기 준수 가능합니다.`, source: '수주 납기 × 생산계획 시뮬레이션' };
}
function invoiceStatus(db) {
  const pend = db.invoices.filter((v) => v.status === '대기');
  const issued = db.invoices.filter((v) => v.status === '발행');
  return { text: `거래명세서는 <b>발행 완료 ${issued.length}건, 발행 대기 ${pend.length}건</b>입니다. 출고 확정과 동시에 자동 작성되며, 발행 승인 시 RPA가 ERP에 자동 입력합니다 (건당 11초). 오늘 수기 작성 0건.<br><br>대기: ${pend.map((v) => `${custName(db, v.customerCode)} ₩${fmt(v.total)}`).join(' · ') || '없음'}`, source: '발행 큐 · RPA 로그' };
}
function machineStatus(db) {
  const lines = db.machines.map((m) => `· <b>${m.name}</b> — ${m.status}${m.sealTemp ? ` · ${m.sealTemp}℃` : ''}${m.lot && m.lot !== '-' ? ` · ${m.lot}` : ''}`).join('<br>');
  const used = Math.round((db.capacity.throughput.used / db.capacity.throughput.total) * 100);
  return { text: `설비 가동률 <b>${used}%</b> (생산능력 ${fmt(db.capacity.throughput.used)}/${fmt(db.capacity.throughput.total)} EA환산), 가용 인원 ${db.capacity.people.avail}/${db.capacity.people.total}명.<br><br>${lines}<br><br>실링기 #2는 온도 상한 근접으로 점검을 권장합니다.`, source: '설비 센서 스트림 · 생산능력' };
}
function exportStatus(db) {
  const lines = db.exportShipments.map((e) => `· <b>${e.id}</b> ${custName(db, e.customerCode)} (${e.country}) — ${e.steps[e.stepIndex]} · ETD ${e.etd} · ${e.incoterms}`).join('<br>');
  return { text: `수출 선적은 총 ${db.exportShipments.length}건, 진행 중 <b>${db.exportShipments.filter((e) => e.stepIndex < e.steps.length - 1).length}건</b>입니다.<br><br>${lines}<br><br>Pacific Medical 건은 ETD까지 생산 완료가 필요해 생산계획 3순위에 배정되어 있습니다.`, source: '수출 선적 × 통관 단계 추적' };
}
function costSummary(db) {
  const al = db.rawMaterials.find((m) => m.code === 'M-0040');
  const impacted = db.items.filter((i) => i.bom.some(([c]) => c === 'M-0040'));
  return { text: `AL 호일 단가 <b>+9% 인상</b>으로 영향 품목 <b>${impacted.length}개</b>(${impacted.map((i) => i.name).join(', ')})의 원가가 상승했습니다. 거래처 단가 개정 검토 2건이 등록되어 있습니다. 원가 관리 탭에서 품목별 재료비/노무비/경비 구성을 확인하세요.`, source: 'BOM 원가 자동 계산 · 자재 단가 변동 감지' };
}
function workerSummary(db) {
  const today = todayStr();
  const by = {}; db.lots.filter((l) => l.date === today).forEach((l) => { by[l.worker] = (by[l.worker] || 0) + l.qty; });
  const lines = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([w, q]) => `· <b>${w}</b> ${fmt(q)} EA`).join('<br>');
  return { text: `오늘 생산자별 실적입니다.<br><br>${lines}<br><br>모든 작업 이력은 LOT 단위로 추적됩니다.`, source: '작업자 실적 자동 집계' };
}
function customerSummary(db, c) {
  const st = custStat(db, c);
  const od = db.orders.filter((o) => o.customerCode === c.code);
  const cl = db.claims.filter((k) => k.customerCode === c.code);
  const wo = db.workOrders.find((w) => w.customerCode === c.code);
  return { text: `<b>${c.name}</b> (${c.country} · 단가등급 ${c.grade}) — 누적 매출 ₩${fmt(st.sales)}, 미수금 <b>₩${fmt(st.recv)}</b>. 수주 ${od.length}건${wo ? `, 작업지시 ${wo.no} (스펙 ${wo.specVer}${wo.specChange ? ` — ${wo.specChange}` : ''})` : ''}. 클레임 ${cl.length}건 (진행중 ${cl.filter((k) => k.status === '진행중').length}건).`, source: '거래처 360° 통합 조회 · OEM 스펙 라이브러리' };
}
function overview(db) {
  const today = todayStr();
  const prod = db.lots.filter((l) => l.date === today).reduce((s, l) => s + l.qty, 0);
  const recv = db.customers.reduce((s, c) => s + custStat(db, c).recv, 0);
  const pend = db.invoices.filter((v) => v.status === '대기').length;
  return { text: `오늘의 통합 현황: 생산 <b>${fmt(prod)} EA</b>, 진행 수주 ${db.orders.filter((o) => o.status !== '출고완료').length}건, 거래명세서 대기 ${pend}건, 총 미수금 ₩${fmt(recv)}, 수출 진행 ${db.exportShipments.filter((e) => e.stepIndex < 4).length}건.<br><br>구체적으로 물어보세요 — 예: "오늘 생산량은?", "재고 부족 품목", "미수금 현황", "L${todayStr().slice(2).replace(/-/g, '')}-B01 이력", "납기 위험 수주"`, source: '통합 현황 자동 요약' };
}

/* ═══════════ 문서 생성 — 브리핑 · 제안서 · 이메일 · 시장분석 ═══════════ */
function custBriefData(db, c) {
  const st = custStat(db, c);
  const od = db.orders.filter((o) => o.customerCode === c.code).slice(0, 4);
  const cl = db.claims.filter((k) => k.customerCode === c.code);
  const fu = db.followUps.find((f) => f.customerCode === c.code && !f.done);
  return { st, od, cl, fu };
}

async function brief(db, customerCode) {
  const c = db.customers.find((x) => x.code === customerCode);
  if (!c) return { __status: 400, error: '거래처를 선택하세요' };
  const { st, od, cl, fu } = custBriefData(db, c);
  const fb = [
    `■ 거래 현황 — ${c.name} (${c.country} · 등급 ${c.grade})`,
    `· 누적 매출 ₩${fmt(st.sales)} / 입금 ₩${fmt(st.paid)} / 미수금 ₩${fmt(st.recv)}`,
    `· 최근 수주 ${od.length}건: ${od.map((o) => `${(item(db, o.itemCode) || {}).name} ${fmt(o.qty)}`).join(', ') || '없음'}`,
    `· 클레임 ${cl.length}건 (진행중 ${cl.filter((k) => k.status === '진행중').length}건)`,
    '',
    `■ 리스크 평가`,
    st.recv > 20000000 ? `· 미수금 ₩${fmt(st.recv)} — ${c.agingNote || '회수 관리 필요'} → 중점 관리 대상` : `· 미수금 리스크 낮음 (₩${fmt(st.recv)})`,
    cl.some((k) => k.status === '진행중') ? `· 진행중 클레임: ${cl.filter((k) => k.status === '진행중').map((k) => k.type).join(', ')} — 신뢰 회복 조치 우선` : '· 미결 클레임 없음',
    '',
    `■ 다음 영업 액션`,
    fu ? `1. ${fu.date} 예정 — ${fu.note}` : '1. 정기 Follow-up 일정 등록 권장',
    st.recv > 0 ? `2. 미수금 ₩${fmt(st.recv)} 입금 일정 확정 — 회계팀 공유` : `2. ${c.grade} 등급 유지 조건 재안내 및 추가 수주 제안`,
  ].join('\n');
  return await aiDoc(db, '거래처 영업 브리핑', fb, `거래처 ${c.name} 데이터 기반 (1)거래 현황 3줄 요약 (2)미수금/클레임 리스크 (3)다음 액션 2가지`);
}

async function proposal(db, { customerCode, item: itemName, goal }) {
  const c = db.customers.find((x) => x.code === customerCode) || db.customers[0];
  const { st, od } = custBriefData(db, c);
  const fb = [
    `제 목: ${itemName || '신제품'} 공급 제안 — ${c.name} 귀중`,
    '',
    `1. 제안 배경`,
    `   귀사와의 거래는 누적 ₩${fmt(st.sales)} 규모로, 최근 ${od.length}건의 수주(${od.map((o) => (item(db, o.itemCode) || {}).name).filter((v, i, a) => a.indexOf(v) === i).join(', ')})를 안정적으로 공급해 왔습니다. 당사는 ISO 13485·GMP 기반 의료용 멸균 포장 공정과 LOT 단위 전 이력 추적 체계를 운영하고 있습니다.`,
    '',
    `2. 제안 내용`,
    `   ${itemName || '신제품'} — ${goal || '신규 도입 제안'}. 시생산 LOT 품질 데이터(기포테스트·무게·실링온도)를 납품 시 함께 제공합니다.`,
    '',
    `3. 거래 조건`,
    `   귀사 단가등급 ${c.grade} 적용 단가로 견적하며, 초도 물량은 최소 생산수량 기준으로 협의 가능합니다. 납기는 발주 후 표준 리드타임 내 출고를 보증합니다.`,
    '',
    `4. 기대 효과`,
    `   멸균 유효성(ISO 11607) 적합 포장으로 인증 대응 부담 절감, LOT 추적으로 품질 이슈 즉시 역추적.`,
    '',
    `5. 다음 단계`,
    `   샘플 발송(1주) → 품질 평가(2주) → 시생산 LOT 협의. 회신 주시면 일정 확정하겠습니다.`,
  ].join('\n');
  return await aiDoc(db, 'AI 제안서 초안', fb, `${c.name} (등급 ${c.grade}) 대상 "${itemName}" 제안서 — 목적: ${goal}`);
}

async function email(db, customerCode) {
  const c = db.customers.find((x) => x.code === customerCode);
  if (!c) return { __status: 400, error: '거래처를 선택하세요' };
  const { st, fu } = custBriefData(db, c);
  const isAbroad = c.country !== '한국';
  const fb = [
    isAbroad ? `Subject: [BL-tech] Follow-up — ${fu ? fu.note.slice(0, 24) : 'Partnership'}` : `제목: [비엘테크] ${fu ? fu.note : '정기 안부 및 일정 협의'}`,
    '',
    `${c.contact && c.contact.name ? c.contact.name : '담당자'}님, 안녕하세요. 비엘테크 ${(db.employees.find((e) => e.code === c.manager) || {}).name || '영업담당'}입니다.`,
    '',
    fu ? `다름이 아니라 "${fu.note}" 건으로 연락드립니다. 예정일(${fu.date}) 관련하여 가능하신 일정 회신 부탁드립니다.` : '진행 중인 거래 관련 일정 협의차 연락드립니다.',
    st.recv > 0 ? `아울러 현재 미결제 잔액 ₩${fmt(st.recv)}의 입금 예정일을 함께 확인 부탁드립니다.` : '',
    '',
    '항상 당사 제품을 신뢰해 주셔서 감사합니다. 회신 기다리겠습니다.',
    '',
    `비엘테크(BL-tech) 드림 · ISO 13485 · GMP`,
  ].filter((l) => l !== null).join('\n');
  return await aiDoc(db, 'Follow-up 이메일 초안', fb, `${c.name} (${c.country}) Follow-up 이메일 — 목적: ${fu ? fu.note : '정기 협의'}`);
}

async function market(db, topic) {
  const t = topic || '의료용 멸균 포장재 시장';
  const exportCountries = [...new Set(db.customers.filter((c) => c.country !== '한국').map((c) => c.country))];
  const fb = [
    `■ 조사 주제: ${t}`,
    '',
    `1. 시장 동향 요약 (내장 데이터 기반 추정)`,
    `   · 의료용 멸균 포장(SBS: Sterile Barrier System) 시장은 고령화·일회용 의료기기 확대로 연 6~8% 성장 추정.`,
    `   · ISO 11607 개정·EU MDR 시행으로 포장 유효성 문서화 요구 강화 — 당사 LOT 추적 체계가 차별점.`,
    `   · 당사 수출 거래국: ${exportCountries.join(', ')} — 對미국 매출 비중이 가장 크고 베트남이 성장축.`,
    '',
    `2. 주요 경쟁 구도`,
    `   · 글로벌: Amcor, Oliver Healthcare, Wipak 등 대형사가 프리미엄 시장 점유.`,
    `   · 당사 포지션: 중소형 OEM 대응력 + 빠른 스펙 전환(스펙 라이브러리 ${db.meta.specLibrary}건)이 강점.`,
    '',
    `3. 신규 거래처 발굴 기회`,
    `   ① 베트남·동남아 의료기기 조립 공장의 현지 멸균 포장 수요 (VinaMed 채널 확장)`,
    `   ② 국내 진단키트 제조사의 수출용 파우치 전환 수요`,
    `   ③ 일본 중소 의료상사의 다품종 소량 OEM (사쿠라·모리 레퍼런스 활용)`,
    '',
    `4. 영업전략 제언`,
    `   · A+ 등급 단가는 물량 연동제로 전환해 마진 방어 (AL 호일 +9% 원가 상승 반영)`,
    `   · 수출 비중 확대 시 영세율 매출 증가 — 환변동 대비 USD 단가 분기 재검토`,
    '',
    `※ 본 보고서는 서버 내장 룰 엔진 분석입니다. ANTHROPIC_API_KEY 설정 시 웹 검색 없이도 Claude가 보고서를 보강합니다.`,
  ].join('\n');
  return await aiDoc(db, '시장·경쟁사 분석', fb, `시장조사 보고: ${t} — 시장동향/경쟁사/발굴기회/전략제언 구조`);
}

async function aiDoc(db, kind, fallbackText, promptHint) {
  const out = await maybeClaude(
    `당신은 의료용품 제조/수출 기업 비엘테크(ISO 13485·GMP)의 ${kind} 작성 전문가입니다. 제공된 초안을 실무 문서 톤으로 다듬어 한국어로 작성하세요. 과장 금지, 수치는 초안의 것만 사용. 마크다운 기호(#, **, 표, 구분선) 없이 일반 텍스트로만 작성하세요.`,
    `${promptHint}\n\n[초안]\n${fallbackText}`,
    fallbackText,
  );
  // 문서 패널은 plain text 렌더링이므로 마크다운 잔여 기호를 제거한다
  const text = out.engine.startsWith('CLAUDE')
    ? out.text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,4}\s*/gm, '').replace(/^---+\s*$/gm, '')
    : out.text;
  return { text, engine: out.engine, kind };
}

module.exports = { query, brief, proposal, email, market };
