// REST API 라우터 + 비즈니스 로직 — 모든 집계·판정·문서 생성이 서버단에서 수행된다.
const ai = require('./ai');

/* ───────── 공통 헬퍼 ───────── */
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const ymd = () => todayStr().slice(2).replace(/-/g, '');
const mmdd = () => todayStr().slice(5).replace(/-/g, '');
const pad2 = (n) => String(n).padStart(2, '0');
const norm = (s) => String(s || '').toLowerCase().replace(/[\s㈜()（）·.\-주식회사]/g, '');

const item = (db, code) => db.items.find((i) => i.code === code);
const raw = (db, code) => db.rawMaterials.find((m) => m.code === code);
const cust = (db, code) => db.customers.find((c) => c.code === code);
const custName = (db, code) => (cust(db, code) || {}).name || code;

function openQty(db, itemCode) {
  return db.orders.filter((o) => o.itemCode === itemCode && o.status !== '출고완료')
    .reduce((s, o) => s + o.qty, 0);
}
// 적용 안전재고 = 기본 안전재고 × (1 + 마진% / 100) — 마진은 품목/자재별로 설정 가능
const effSafety = (x) => Math.round(x.safety * (1 + (x.safetyMargin || 0) / 100));
function stockRow(db, it) {
  const open = openQty(db, it.code);
  const avail = it.onHand - open;
  const safety = effSafety(it);
  const verdict = avail < 0 ? '부족' : avail < safety ? '주의' : '정상';
  const days = it.avgOut > 0 ? Math.max(0, Math.floor(it.onHand / it.avgOut)) : 99;
  const t = new Date(); t.setDate(t.getDate() + days);
  return { code: it.code, name: it.name, unit: it.unit, onHand: it.onHand, open, avail, safetyBase: it.safety, safetyMargin: it.safetyMargin || 0, safety, verdict, depleteDate: t.toISOString().slice(0, 10), depleteDays: days };
}
function rawRow(db, m) {
  const safety = effSafety(m);
  const verdict = m.onHand < safety ? '부족' : m.onHand < safety * 1.4 ? '주의' : '정상';
  const days = m.avgUse > 0 ? Math.round((m.onHand / m.avgUse) * 10) / 10 : 99;
  const sup = db.suppliers.find((s) => s.code === m.supplier);
  const openPo = db.purchaseOrders.find((p) => p.materialCode === m.code && p.status !== '입고완료');
  return { ...m, safetyBase: m.safety, safetyMargin: m.safetyMargin || 0, safety, verdict, depleteDays: days, supplierName: sup ? sup.name : m.supplier, openPo: openPo ? openPo.no : null, openPoStatus: openPo ? openPo.status : null };
}
// 생산지시 → 일일 생산지시 자동 분할 (일일 생산능력의 70%를 기준 배치로 사용)
function genDailyPlan(it, qty) {
  const perDay = Math.max(it.minRun, Math.round(it.dailyCap * 0.7));
  const days = Math.max(1, Math.ceil(qty / perDay));
  const rows = []; let remain = qty;
  for (let i = 0; i < days; i++) {
    const q = Math.min(perDay, remain); remain -= q;
    const t = new Date(); t.setDate(t.getDate() + 1 + i);
    rows.push({ date: t.toISOString().slice(0, 10), qty: q, machine: it.line, status: '예정', actual: 0, issued: false });
  }
  return rows;
}
function act(db, who, action, ref) {
  db.activities.unshift({ time: `${todayStr()} ${nowTime()}`, who, action, ref });
  db.activities = db.activities.slice(0, 120);
}
function pushAlert(db, severity, icon, title, desc, source) {
  db.alerts.unshift({ time: nowTime(), severity, icon, title, desc, source });
  db.alerts = db.alerts.slice(0, 60);
}
function custStat(db, c) {
  const invoiced = db.invoices.filter((v) => v.customerCode === c.code && v.status === '발행').reduce((s, v) => s + v.total, 0);
  const paid2 = db.payments.filter((p) => p.customerCode === c.code).reduce((s, p) => s + p.amount, 0);
  const sales = c.baseSales + invoiced;
  const paid = c.basePaid + paid2;
  return { sales, paid, recv: sales - paid };
}
function gradePrice(it, c) { return it.gradePrices[c.grade] || it.base; }
function costOf(db, it) {
  const mats = it.bom.map(([code, q]) => { const m = raw(db, code); return { code, name: m ? m.name : code, qty: q, cost: Math.round(q * (m ? m.unitCost : 0)) }; });
  const matCost = mats.reduce((s, m) => s + m.cost, 0);
  const total = matCost + it.labor + it.oh;
  return { mats, matCost, labor: it.labor, oh: it.oh, total, price: it.base, margin: Math.round(((it.base - total) / it.base) * 1000) / 10 };
}

/* ───────── 라우팅 테이블 ───────── */
const routes = [];
function r(method, pattern, fn) {
  const keys = (pattern.match(/:[^/]+/g) || []).map((k) => k.slice(1));
  const rx = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
  routes.push({ method, rx, keys, fn });
}

/* ═══════════ META · 마스터 ═══════════ */
r('GET', '/api/meta', (db) => ({ ...db.meta, today: todayStr(), now: nowTime(), aiEngine: process.env.ANTHROPIC_API_KEY ? 'Claude API 연동' : '내장 룰 엔진' }));
r('GET', '/api/masters', (db) => ({
  items: db.items.map(({ code, name, unit, gradePrices, base, line }) => ({ code, name, unit, gradePrices, base, line })),
  rawMaterials: db.rawMaterials.map(({ code, name, unit, unitCost }) => ({ code, name, unit, unitCost })),
  customers: db.customers.map(({ code, name, country, grade }) => ({ code, name, country, grade })),
  employees: db.employees, machines: db.machines.map(({ id, name, status, sealTemp, roomTemp, humidity }) => ({ id, name, status, sealTemp, roomTemp, humidity })),
  workOrders: db.workOrders.map(({ no, customerCode, itemCode, specVer, status }) => ({ no, customerCode, itemCode, specVer, status })),
}));
r('GET', '/api/items', (db) => db.items.map((i) => ({ ...i, stock: stockRow(db, i) })));
r('GET', '/api/employees', (db) => db.employees.map((e) => {
  const logs = db.workLogs.filter((w) => w.worker === e.name).length;
  const fu = db.followUps.filter((f) => { const c = cust(db, f.customerCode); return c && c.manager === e.code && !f.done; }).length;
  return { ...e, todayLogs: logs, openFollowUps: fu };
}));

/* ═══════════ 통합 대시보드 ═══════════ */
r('GET', '/api/dashboard', (db) => {
  const today = todayStr();
  const todayLots = db.lots.filter((l) => l.date === today);
  const todayProd = todayLots.reduce((s, l) => s + l.qty, 0);
  const stocks = db.items.map((i) => stockRow(db, i));
  const short = stocks.filter((s) => s.verdict === '부족');
  const rawShort = db.rawMaterials.map((m) => rawRow(db, m)).filter((m) => m.verdict === '부족');
  const activeOrders = db.orders.filter((o) => o.status !== '출고완료');
  const pendInv = db.invoices.filter((v) => v.status === '대기');
  const shipWait = db.shipments.filter((s) => !['출고완료'].includes(s.status));
  const overdueFu = db.followUps.filter((f) => !f.done && f.date < today);
  const recvTotal = db.customers.reduce((s, c) => s + custStat(db, c).recv, 0);
  const machinesUp = db.machines.filter((m) => !['예방정비', '대기'].includes(m.status)).length;
  const exportActive = db.exportShipments.filter((e) => e.stepIndex < e.steps.length - 1).length;
  const planned = db.planPriorities.length;
  const dueRisk = activeOrders.filter((o) => o.dueDate <= today || (new Date(o.dueDate) - new Date(today)) / 864e5 <= 2).length;
  return {
    pipeline: {
      order: { n: activeOrders.length, note: '엑셀 자동분석 가동', tone: 'ok' },
      stock: { n: stocks.length - short.length, note: `부족 예측 ${short.length}품목`, tone: short.length ? 'bad' : 'ok' },
      plan: { n: planned, note: `설비 가동 ${Math.round((db.capacity.throughput.used / db.capacity.throughput.total) * 100)}%`, tone: 'warn' },
      ship: { n: shipWait.length, note: '금일 차량 배차 완료', tone: 'ok' },
      invoice: { n: pendInv.length, note: '발행 승인 대기', tone: pendInv.length ? 'warn' : 'ok' },
    },
    kpis: {
      todayProd, todayPlan: db.meta.todayPlan, planRate: Math.round((todayProd / db.meta.todayPlan) * 1000) / 10,
      defectRate: db.qcStats.defectRate, defectTrend: db.qcStats.defectTrend,
      machinesUp, machinesTotal: db.machines.length,
      stockShort: short.length + rawShort.length, dueRisk,
      recvTotal, salesTotal: db.customers.reduce((s, c) => s + custStat(db, c).sales, 0),
      salesMonth: db.invoices.filter((v) => v.status === '발행').reduce((s, v) => s + v.supply, 0),
      exportActive, overdueFu: overdueFu.length,
    },
    navBadges: {
      orders: db.orders.filter((o) => o.status === '신규').length,
      stock: short.length, quality: db.qualityRecords.filter((q) => q.verdict !== '정상').length,
      invoices: pendInv.length, followup: overdueFu.length, purchase: rawShort.filter((m) => !m.openPo).length,
    },
    alerts: db.alerts.slice(0, 6), weekTrend: db.weekTrend,
    aiComment: '월·화 수주 집중 패턴이 4주째 반복 — 주말 생산계획을 월요일 출고 물량 기준으로 선반영하면 납기 여유가 +1일 확보됩니다. 수출 선적 2건이 이번 주 ETD로 묶여 있어 실링 3라인 우선 배정을 권장합니다.',
  };
});

/* ═══════════ 영업 — 수주 ═══════════ */
r('GET', '/api/orders', (db) => db.orders.map((o) => ({
  ...o, customerName: custName(db, o.customerCode), itemName: (item(db, o.itemCode) || {}).name,
  unit: (item(db, o.itemCode) || {}).unit, amount: o.qty * o.unitPrice,
  dday: Math.ceil((new Date(o.dueDate) - new Date(todayStr())) / 864e5),
})));

r('POST', '/api/orders/upload', (db, p, body) => {
  let rows = [];
  if (body && body.csv) {
    const lines = String(body.csv).split(/\r?\n/).filter((l) => l.trim());
    const head = lines[0].split(',').map((h) => h.trim());
    const col = (kw) => head.findIndex((h) => kw.some((k) => h.includes(k)));
    const ci = { cust: col(['거래처', '고객']), item: col(['품명', '품목']), qty: col(['수량']), due: col(['납기']) };
    for (const line of lines.slice(1)) {
      const c = line.split(',').map((x) => x.trim());
      rows.push({ customer: c[ci.cust] || '', item: c[ci.item] || '', qty: parseInt(String(c[ci.qty]).replace(/[^\d]/g, ''), 10) || 0, due: c[ci.due] || '' });
    }
  } else if (body && Array.isArray(body.rows)) {
    rows = body.rows;
  } else {
    // 샘플 수주 (데모) — 서버가 생성
    const t = new Date(); const dd = (n) => { const x = new Date(t); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    rows = [
      { customer: '한빛', item: 'P-1042', qty: 6000, due: dd(7) },
      { customer: '그린팩메디칼(주)', item: '멸균 스탠드 파우치', qty: 8000, due: dd(8) },
      { customer: '사쿠라', item: 'P-0915', qty: 9000, due: dd(9) },
    ];
  }
  const created = []; const errors = [];
  const batchUsed = {};
  for (const row of rows) {
    const c = db.customers.find((x) => {
      const nIn = norm(row.customer); const nC = norm(x.name);
      return nIn && (nC.includes(nIn) || nIn.includes(nC) || (x.alias || []).some((a) => norm(a) === nIn || nIn.includes(norm(a))));
    });
    const it = db.items.find((x) => norm(x.code) === norm(row.item) || norm(x.name).includes(norm(row.item)) || norm(row.item).includes(norm(x.code)));
    if (!c || !it || !row.qty) { errors.push({ row, reason: !c ? '거래처 미매칭 — 확인 필요' : !it ? '품목 미매칭 — 확인 필요' : '수량 누락' }); continue; }
    const used = batchUsed[it.code] || 0;
    const avail = it.onHand - openQty(db, it.code) - used;
    const verdict = avail >= row.qty ? '즉시출고' : it.onHand > 0 ? '부족' : '생산필요';
    batchUsed[it.code] = used + row.qty;
    const no = `SO-${mmdd()}-${pad2(db.seq.order++)}`;
    const o = { no, date: todayStr(), customerCode: c.code, itemCode: it.code, qty: row.qty, unitPrice: gradePrice(it, c), dueDate: row.due || todayStr(), country: c.country, status: '신규', verdict };
    db.orders.unshift(o); created.push({ ...o, customerName: c.name, itemName: it.name, amount: o.qty * o.unitPrice });
  }
  act(db, '진은명', `수주 엑셀 자동분석 — ${created.length}건 등록 · 단가 자동적용 · 재고 자동비교`, 'AI PARSE');
  const summary = {
    total: created.length, ok: created.filter((x) => x.verdict === '즉시출고').length,
    prod: created.filter((x) => x.verdict !== '즉시출고').length, errors: errors.length,
    time: (rows.length * 1.4).toFixed(1) + '초', priceMatched: created.length,
  };
  return { created, errors, summary };
});

r('POST', '/api/orders/:no/assign', (db, p) => {
  const o = db.orders.find((x) => x.no === p.no);
  if (!o) return { __status: 404, error: '수주 없음' };
  const it = item(db, o.itemCode);
  if (o.verdict === '즉시출고') {
    o.status = '출고대기';
    const id = `OUT-${pad2(db.seq.out++)}`;
    db.shipments.push({ id, orderNo: o.no, customerCode: o.customerCode, itemCode: o.itemCode, qty: o.qty, transport: o.country === '한국' ? '차량 배차' : '수출 연계', status: '피킹', time: null, invoiceNo: null });
    act(db, '강민준', `출고 대기열 배정 (${id})`, o.no);
    return { ok: true, msg: `출고 대기열 배정 완료 — ${id} 피킹 지시 전송` };
  }
  o.status = '생산배정';
  const no = `WO-${mmdd()}-${pad2(db.seq.wo++)}`;
  const dailyPlan = genDailyPlan(it, o.qty);
  db.workOrders.push({ no, customerCode: o.customerCode, itemCode: o.itemCode, qty: o.qty, status: '대기', assignee: '장다슬', machine: it.line, progress: 0, specVer: '-', lastProduced: '-', spec: { 원단: '표준 사양', 포장재: '표준 포장', 라벨: '표준 라벨', 실링조건: '표준 조건', 특이사항: `수주 ${o.no} 연동 생산 · 일일 지시 ${dailyPlan.length}건 자동 분할` }, drawing: null, specChange: null, dailyPlan });
  db.planPriorities.push({ rank: db.planPriorities.length + 1, urgent: false, itemCode: o.itemCode, title: `${it.name} · ${o.qty.toLocaleString()}${it.unit}`, badge: `납기 ${o.dueDate.slice(5)}`, meta: `${custName(db, o.customerCode)} · ${it.line}`, why: '근거: 가용재고 부족 — 수주 연동 자동 배정', woNo: no });
  act(db, 'AI 스케줄러', `생산계획 자동 배정 (${no})`, o.no);
  return { ok: true, msg: `생산계획 반영 완료 — 작업지시 ${no} 생성` };
});

/* ═══════════ 영업 — 거래처 · Follow-up ═══════════ */
r('GET', '/api/customers', (db) => db.customers.map((c) => {
  const st = custStat(db, c);
  const mgr = db.employees.find((e) => e.code === c.manager);
  return { ...c, ...st, managerName: mgr ? mgr.name : '', ordersCount: db.orders.filter((o) => o.customerCode === c.code).length, claimsOpen: db.claims.filter((k) => k.customerCode === c.code && k.status === '진행중').length };
}));
r('GET', '/api/customers/:code', (db, p) => {
  const c = cust(db, p.code); if (!c) return { __status: 404, error: '거래처 없음' };
  const st = custStat(db, c);
  const mgr = db.employees.find((e) => e.code === c.manager);
  return {
    ...c, ...st, managerName: mgr ? mgr.name : '',
    orders: db.orders.filter((o) => o.customerCode === c.code).map((o) => ({ ...o, itemName: (item(db, o.itemCode) || {}).name, amount: o.qty * o.unitPrice })),
    claims: db.claims.filter((k) => k.customerCode === c.code),
    followUps: db.followUps.filter((f) => f.customerCode === c.code),
    invoices: db.invoices.filter((v) => v.customerCode === c.code).slice(0, 6),
    payments: db.payments.filter((pm) => pm.customerCode === c.code).slice(0, 6),
  };
});
r('GET', '/api/sales/followups', (db) => {
  const today = todayStr();
  return db.followUps.map((f) => ({ ...f, customerName: custName(db, f.customerCode), grade: (cust(db, f.customerCode) || {}).grade, overdue: !f.done && f.date < today })).sort((a, b) => a.date.localeCompare(b.date));
});
r('POST', '/api/sales/followups/:id/done', (db, p) => {
  const f = db.followUps.find((x) => x.id === p.id); if (!f) return { __status: 404, error: '없음' };
  f.done = true; act(db, '이서연', 'Follow-up 완료 처리', f.customerName || f.customerCode);
  return { ok: true };
});

/* ═══════════ 생산 ═══════════ */
r('GET', '/api/production/overview', (db) => {
  const today = todayStr();
  const todayLots = db.lots.filter((l) => l.date === today);
  const todayProd = todayLots.reduce((s, l) => s + l.qty, 0);
  const byItem = {};
  todayLots.forEach((l) => { byItem[l.itemCode] = (byItem[l.itemCode] || 0) + l.qty; });
  const bars = Object.entries(byItem).map(([code, qty]) => ({ code, name: (item(db, code) || {}).name, qty, unit: (item(db, code) || {}).unit }));
  const max = Math.max(1, ...bars.map((b) => b.qty));
  bars.forEach((b) => (b.pct = Math.round((b.qty / max) * 100)));
  return {
    kpis: { todayProd, todayPlan: db.meta.todayPlan, planRate: Math.round((todayProd / db.meta.todayPlan) * 1000) / 10, defectRate: db.qcStats.defectRate, defectTrend: db.qcStats.defectTrend, sealersUp: db.machines.filter((m) => m.name.startsWith('실링기') && !['예방정비'].includes(m.status)).length, sealersTotal: db.machines.filter((m) => m.name.startsWith('실링기')).length, todayLogs: db.meta.todayLogs },
    machines: db.machines, bars: bars.sort((a, b) => b.qty - a.qty), feed: db.alerts.slice(0, 4),
  };
});
r('GET', '/api/production/workorders', (db) => ({
  list: db.workOrders.map((w) => ({ ...w, customerName: w.customerCode ? custName(db, w.customerCode) : '자체 생산', itemName: (item(db, w.itemCode) || {}).name, unit: (item(db, w.itemCode) || {}).unit })),
  specLibrary: db.meta.specLibrary, specVendors: db.meta.specVendors,
}));
r('POST', '/api/production/workorders/:no/issue', (db, p) => {
  const w = db.workOrders.find((x) => x.no === p.no); if (!w) return { __status: 404, error: '없음' };
  w.status = w.status === '대기' ? '발행' : '진행';
  act(db, '차훈', `작업지시 발행 (생산팀장 결재) → 현장 태블릿 전송 (${w.status})`, w.no);
  return { ok: true, msg: `작업지시 ${w.no} 발행 — 현장 태블릿에 스펙과 함께 전송되었습니다` };
});
r('GET', '/api/production/worklogs', (db) => ({ list: db.workLogs.slice(0, 20), nextNo: `${todayStr().replace(/-/g, '')}-${pad2(db.seq.worklog)}`, todayLogs: db.meta.todayLogs }));
r('POST', '/api/production/worklogs', (db, p, body) => {
  const b = body || {};
  const mc = db.machines.find((m) => m.name === b.machine) || db.machines[0];
  const it = item(db, b.itemCode); if (!it) return { __status: 400, error: '품목코드를 확인하세요' };
  const letter = { '실링기 #1': 'A', '실링기 #2': 'B', '실링기 #3': 'C', '실링기 #4': 'D' }[mc.name] || 'E';
  const todaysSeq = db.lots.filter((l) => l.date === todayStr() && l.no.includes('-' + letter)).length + 1;
  const lotNo = `L${ymd()}-${letter}${pad2(todaysSeq)}`;
  const qty = parseInt(String(b.qty).replace(/[^\d]/g, ''), 10) || 0;
  const weight = parseFloat(b.weight) || 0;
  const log = { id: `WL-${pad2(db.seq.worklog)}`, no: `${todayStr().replace(/-/g, '')}-${pad2(db.seq.worklog++)}`, time: nowTime(), woNo: b.woNo || null, worker: b.worker || '장다슬', machine: mc.name, sealTemp: mc.sealTemp, roomTemp: mc.roomTemp, humidity: mc.humidity, itemCode: it.code, lotNo, qty, remain: parseInt(b.remain, 10) || 0, coating: b.coating || '-', weight, resin: b.resin || '-', catalyst: b.catalyst || '-', mixDate: b.mixDate || todayStr(), bubbleTest: b.bubbleTest || '합격' };
  db.workLogs.unshift(log);
  db.lots.unshift({ no: lotNo, itemCode: it.code, qty, remain: log.remain, coating: log.coating, machine: mc.name, status: log.remain > 0 ? '진행 중' : '완료', date: todayStr(), worker: log.worker, woNo: log.woNo });
  it.onHand += qty;
  db.movements.unshift({ time: `${todayStr()} ${nowTime()}`, type: '생산입고', code: it.code, name: it.name, qty: `+${qty.toLocaleString()}${it.unit}`, ref: lotNo, zone: 'B 완제품' });
  mc.lot = lotNo;
  db.meta.todayLogs += 1;
  // 품질 판정 (서버 기준값 검사)
  let verdict = '정상';
  const anomalies = [];
  if (weight && (weight < 245 || weight > 255)) { verdict = '기준 이탈'; anomalies.push(`제품 무게 ${weight}g — 기준(245–255g) 이탈`); }
  if (mc.sealTemp >= 198) { verdict = '기준 이탈'; anomalies.push(`실링 온도 ${mc.sealTemp}℃ — 상한 198℃ 초과`); }
  else if (mc.sealTemp >= 195 && verdict === '정상') { verdict = '주의'; anomalies.push(`실링 온도 ${mc.sealTemp}℃ — 상한 근접`); }
  if (mc.humidity > 50 && verdict === '정상') { verdict = '주의'; anomalies.push(`실내 습도 ${mc.humidity}% — 기포 불량 상관 구간`); }
  if (b.bubbleTest === '불합격') { verdict = '기준 이탈'; anomalies.push('기포테스트 불합격 — LOT 격리 필요'); }
  db.qualityRecords.unshift({ time: nowTime(), lotNo, sealTemp: mc.sealTemp, room: `${mc.roomTemp}℃/${mc.humidity}%`, weight: weight || '-', bubble: b.bubbleTest || '합격', verdict });
  anomalies.forEach((a) => pushAlert(db, verdict === '기준 이탈' ? 'bad' : 'warn', '⚠', `LOT ${lotNo} ${a.split(' — ')[0]}`, a, 'AI 이상감지 · 공정일지 입력 검증'));
  if (log.woNo) {
    const w = db.workOrders.find((x) => x.no === log.woNo);
    if (w && w.qty) w.progress = Math.min(100, Math.round(((w.progress / 100 * w.qty + qty) / w.qty) * 100));
    const dRow = w && (w.dailyPlan || []).find((x) => x.date === todayStr());
    if (dRow) { dRow.actual += qty; dRow.issued = true; dRow.status = dRow.actual >= dRow.qty ? '완료' : '진행'; }
  }
  act(db, log.worker, '공정일지 작성 · 자동 저장 → 실적 자동 집계 · ERP 등록', lotNo);
  return { ok: true, log, lotNo, verdict, anomalies, msg: `일지 저장 완료 — LOT ${lotNo} 자동 채번 · 실적 ERP 등록${anomalies.length ? ` · AI 이상감지 ${anomalies.length}건` : ''}` };
});
r('GET', '/api/production/lots', (db) => db.lots.map((l) => ({ ...l, itemName: (item(db, l.itemCode) || {}).name, unit: (item(db, l.itemCode) || {}).unit })));
r('GET', '/api/production/quality', (db) => ({ stats: db.qcStats, records: db.qualityRecords.slice(0, 20) }));
r('GET', '/api/production/materials', (db) => ({
  batches: db.materialBatches,
  raws: db.rawMaterials.map((m) => rawRow(db, m)),
  suggestions: db.rawMaterials.map((m) => rawRow(db, m)).filter((m) => m.verdict !== '정상' && !m.openPo).map((m) => ({ code: m.code, name: m.name, onHand: m.onHand, unit: m.unit, depleteDays: m.depleteDays, leadDays: m.leadDays, supplierName: m.supplierName, msg: `${m.name} 잔량 ${m.onHand}${m.unit} — 소비 속도 기준 ${m.depleteDays}일 내 소진 예상. 리드타임 ${m.leadDays}일 고려 시 금일 발주 권장.` })),
}));
r('GET', '/api/production/workers', (db) => {
  const today = todayStr();
  const byWorker = {};
  db.lots.filter((l) => l.date === today).forEach((l) => { byWorker[l.worker] = (byWorker[l.worker] || 0) + l.qty; });
  const max = Math.max(1, ...Object.values(byWorker));
  return {
    workers: Object.entries(byWorker).map(([name, qty]) => ({ name, qty, pct: Math.round((qty / max) * 100), logs: db.workLogs.filter((w) => w.worker === name).length })).sort((a, b) => b.qty - a.qty),
    trail: db.activities.slice(0, 12),
  };
});
r('GET', '/api/production/plan', (db) => ({
  capacity: db.capacity, priorities: db.planPriorities, weekBoard: db.weekBoard,
  todayDirectives: db.workOrders.flatMap((w) => (w.dailyPlan || []).filter((x) => x.date === todayStr()).map((x) => ({ woNo: w.no, customerName: w.customerCode ? custName(db, w.customerCode) : '자체 생산', itemName: (item(db, w.itemCode) || {}).name, unit: (item(db, w.itemCode) || {}).unit, ...x }))),
}));
// 일일 생산지시 발행 — 해당 일자 지시를 현장 태블릿에 전송
r('POST', '/api/production/workorders/:no/daily/:date/issue', (db, p) => {
  const w = db.workOrders.find((x) => x.no === p.no); if (!w) return { __status: 404, error: '작업지시 없음' };
  const row = (w.dailyPlan || []).find((x) => x.date === p.date);
  if (!row) return { __status: 404, error: '해당 일자의 일일 지시가 없습니다' };
  if (row.issued) return { ok: true, msg: '이미 발행된 일일 지시입니다' };
  row.issued = true; if (row.status === '예정') row.status = '지시발행';
  if (w.status === '대기') w.status = '발행';
  act(db, '차훈', `일일 생산지시 발행 (${p.date} · ${row.qty.toLocaleString()}) → 현장 태블릿 전송`, w.no);
  return { ok: true, msg: `${w.no} · ${p.date} 일일 지시 ${row.qty.toLocaleString()} 발행 — 현장 태블릿 전송 완료` };
});
r('POST', '/api/production/plan/:rank/issue', (db, p) => {
  const pr = db.planPriorities.find((x) => String(x.rank) === p.rank); if (!pr) return { __status: 404, error: '없음' };
  if (pr.woNo) return { ok: true, msg: `이미 작업지시 ${pr.woNo} 발행됨` };
  const it = item(db, pr.itemCode);
  const qtyM = pr.title.match(/([\d,]+)\s*(EA|m)/);
  const qty = qtyM ? parseInt(qtyM[1].replace(/,/g, ''), 10) : it.minRun;
  const no = `WO-${mmdd()}-${pad2(db.seq.wo++)}`;
  const dailyPlan = genDailyPlan(it, qty);
  db.workOrders.push({ no, customerCode: null, itemCode: pr.itemCode, qty, status: '발행', assignee: '장다슬', machine: it.line, progress: 0, specVer: '-', lastProduced: '-', spec: { 원단: '표준 사양', 포장재: '표준 포장', 라벨: '표준 라벨', 실링조건: '표준 조건', 특이사항: `생산계획 ${pr.rank}순위 — ${pr.badge} · 일일 지시 ${dailyPlan.length}건 자동 분할` }, drawing: null, specChange: null, dailyPlan });
  pr.woNo = no;
  act(db, 'AI 스케줄러', `작업지시 ${no} 발행 (생산팀장 차훈 승인) — 현장 태블릿 전송`, pr.title);
  return { ok: true, msg: `작업지시서 ${no} 발행 — 현장 태블릿에 전송되었습니다` };
});

/* ═══════════ 구매 ═══════════ */
r('GET', '/api/purchase/orders', (db) => db.purchaseOrders.map((po) => ({ ...po, supplierName: (db.suppliers.find((s) => s.code === po.supplierCode) || {}).name, materialName: (raw(db, po.materialCode) || {}).name })));
r('POST', '/api/purchase/orders', (db, p, body) => {
  const m = raw(db, (body || {}).materialCode); if (!m) return { __status: 400, error: '자재 코드를 확인하세요' };
  const qty = parseInt((body || {}).qty, 10) || Math.max(Math.ceil(m.safety * 1.5 - m.onHand), m.safety);
  const no = `PO-${todayStr().slice(2, 7).replace('-', '')}-${pad2(db.seq.po++)}`;
  const t = new Date(); t.setDate(t.getDate() + m.leadDays);
  const po = { no, supplierCode: m.supplier, materialCode: m.code, qty, unit: m.unit, unitCost: m.unitCost, amount: qty * m.unitCost, orderDate: todayStr(), dueDate: t.toISOString().slice(0, 10), status: '발주완료' };
  db.purchaseOrders.unshift(po);
  act(db, '한도윤', `발주서 생성 · 송부 (${no} · ${m.name} ${qty}${m.unit})`, (db.suppliers.find((s) => s.code === m.supplier) || {}).name);
  return { ok: true, po, msg: `발주서 ${no} 생성 — ${(db.suppliers.find((s) => s.code === m.supplier) || {}).name}로 송부, 입고 예정 ${po.dueDate}` };
});
r('POST', '/api/purchase/orders/:no/receive', (db, p) => {
  const po = db.purchaseOrders.find((x) => x.no === p.no); if (!po) return { __status: 404, error: '없음' };
  if (po.status === '입고완료') return { ok: true, msg: '이미 입고 처리됨' };
  po.status = '입고완료'; po.receivedAt = `${todayStr()} ${nowTime()}`;
  const m = raw(db, po.materialCode); if (m) m.onHand += po.qty;
  db.movements.unshift({ time: po.receivedAt, type: '입고', code: po.materialCode, name: m ? m.name : po.materialCode, qty: `+${po.qty.toLocaleString()}${po.unit}`, ref: `${po.no} · ${(db.suppliers.find((s) => s.code === po.supplierCode) || {}).name}`, zone: 'A 원자재' });
  act(db, '강민준', `구매 입고 처리 (${po.no})`, po.materialCode);
  return { ok: true, msg: `입고 완료 — ${m ? m.name : ''} ${po.qty.toLocaleString()}${po.unit} 원자재 창고 반영` };
});
r('GET', '/api/purchase/suppliers', (db) => db.suppliers.map((s) => ({ ...s, openPos: db.purchaseOrders.filter((p) => p.supplierCode === s.code && p.status !== '입고완료').length, totalPos: db.purchaseOrders.filter((p) => p.supplierCode === s.code).length })));

/* ═══════════ 재고 · 물류 ═══════════ */
r('GET', '/api/stock', (db) => {
  const finished = db.items.map((i) => stockRow(db, i));
  const raws = db.rawMaterials.map((m) => rawRow(db, m));
  return {
    finished, raws,
    summary: { skus: finished.length + raws.length, short: finished.filter((s) => s.verdict === '부족').length + raws.filter((s) => s.verdict === '부족').length, warn: finished.filter((s) => s.verdict === '주의').length + raws.filter((s) => s.verdict === '주의').length, deplete7: finished.filter((s) => s.depleteDays <= 7).length },
  };
});
r('GET', '/api/logistics/movements', (db) => ({ movements: db.movements.slice(0, 30), zones: db.zones }));
// 안전재고 마진 설정 — 품목/원자재 공통, 적용 안전재고와 판정이 서버에서 즉시 재계산된다
r('POST', '/api/stock/margin-all', (db, p, body) => {
  const margin = Math.max(0, Math.min(100, parseFloat((body || {}).margin)));
  if (Number.isNaN(margin)) return { __status: 400, error: '마진(%)을 입력하세요' };
  db.items.forEach((i) => (i.safetyMargin = margin));
  db.rawMaterials.forEach((m) => (m.safetyMargin = margin));
  act(db, '강민준', `안전재고 마진 일괄 적용 ${margin}% — 전 품목 판정 재계산`, 'STOCK');
  return { ok: true, msg: `전 품목(완제품+원자재) 안전재고 마진 ${margin}% 적용 — 가용재고 판정 재계산 완료` };
});
r('POST', '/api/stock/:code/safety', (db, p, body) => {
  const b = body || {};
  const target = item(db, p.code) || raw(db, p.code);
  if (!target) return { __status: 404, error: '품목/자재를 찾을 수 없습니다' };
  if (b.margin !== undefined) {
    const margin = Math.max(0, Math.min(100, parseFloat(b.margin)));
    if (Number.isNaN(margin)) return { __status: 400, error: '마진(%)을 확인하세요' };
    target.safetyMargin = margin;
  }
  if (b.base !== undefined) {
    const base = parseInt(String(b.base).replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(base) && base >= 0) target.safety = base;
  }
  const applied = effSafety(target);
  act(db, '강민준', `안전재고 설정 — 기본 ${target.safety.toLocaleString()} · 마진 ${target.safetyMargin}% → 적용 ${applied.toLocaleString()}`, p.code);
  return { ok: true, applied, msg: `${target.name} — 마진 ${target.safetyMargin}% · 적용 안전재고 ${applied.toLocaleString()}${target.unit}, 판정 재계산됨` };
});

/* ═══════════ 유통 · 배송 · 수출 ═══════════ */
r('GET', '/api/shipping', (db) => ({
  board: db.shipments.map((s) => ({ ...s, customerName: custName(db, s.customerCode), itemName: (item(db, s.itemCode) || {}).name, unit: (item(db, s.itemCode) || {}).unit })),
  kpi: { today: db.shipments.length, done: db.shipments.filter((s) => s.status === '출고완료').length, pending: db.shipments.filter((s) => s.status !== '출고완료').length },
}));
r('POST', '/api/shipping/:id/advance', (db, p) => {
  const s = db.shipments.find((x) => x.id === p.id); if (!s) return { __status: 404, error: '없음' };
  if (s.blocked) return { __status: 400, error: '생산 완료 후 출고 가능합니다 (현재 생산 진행 중)' };
  const flow = { '피킹': '상차', '상차': '출고완료', '보세창고 이동': '출고완료' };
  const next = flow[s.status];
  if (!next) return { ok: true, msg: '이미 출고 완료된 건입니다' };
  s.status = next;
  if (next !== '출고완료') { act(db, '강민준', `출고 ${next} 처리`, s.id); return { ok: true, msg: `${s.id} ${next} 처리 완료` }; }
  // ── 출고 확정: 재고 차감 → 명세서 자동생성 → 배송 시작 → 수주 마감 ──
  s.time = nowTime();
  const it = item(db, s.itemCode); const c = cust(db, s.customerCode);
  if (it) {
    it.onHand -= s.qty;
    db.movements.unshift({ time: `${todayStr()} ${nowTime()}`, type: '출고', code: it.code, name: it.name, qty: `−${s.qty.toLocaleString()}${it.unit}`, ref: `${s.id} · ${c ? c.name : ''}`, zone: 'D 출하장' });
  }
  const o = db.orders.find((x) => x.no === s.orderNo); if (o) o.status = '출고완료';
  let invMsg = '';
  if (s.exportId) {
    invMsg = '수출 건 — Commercial Invoice 연계 (거래명세서 생략)';
    const ex = db.exportShipments.find((e) => e.id === s.exportId);
    if (ex && ex.stepIndex < 2) ex.stepIndex = 2;
  } else {
    const price = o ? o.unitPrice : it ? gradePrice(it, c) : 0;
    const supply = s.qty * price;
    const isExportCust = c && c.country !== '한국';
    const vat = isExportCust ? 0 : Math.round(supply * 0.1);
    const no = `IV-${ymd()}-${pad2(db.seq.invoice++)}`;
    db.invoices.unshift({ no, customerCode: s.customerCode, orderNos: [s.orderNo], items: [{ code: s.itemCode, qty: s.qty, price }], supply, vat, total: supply + vat, type: isExportCust ? '수출(영세율)' : '내수', status: '대기', source: `출고 자동생성 ${nowTime()}` });
    s.invoiceNo = no;
    invMsg = `거래명세서 ${no} 자동 생성 → 발행 큐 등록`;
  }
  const dlv = db.deliveries.find((x) => x.ref === s.id);
  if (dlv) { dlv.stepIndex = Math.max(dlv.stepIndex, 1); dlv.times[0] = dlv.times[0] || `${todayStr()} ${nowTime()}`; dlv.times[1] = `${todayStr()} ${nowTime()}`; }
  else db.deliveries.unshift({ id: `DLV-${pad2(db.seq.dlv++)}`, ref: s.id, customerCode: s.customerCode, carrier: s.transport.includes('택배') ? 'CJ대한통운' : '자사 차량', tno: s.transport.includes('택배') ? `61${Math.floor(10000000 + Math.random() * 89999999)}` : 'BL-TRK-0' + db.seq.dlv, steps: ['출고', '상차', '배송중', '배달완료'], stepIndex: 1, eta: todayStr(), dest: c ? c.address : '', times: [`${todayStr()} ${nowTime()}`, `${todayStr()} ${nowTime()}`, null, null] });
  act(db, '강민준', `출고 확정 → ${invMsg}`, s.id);
  return { ok: true, msg: `출고 확정 — ${invMsg}` };
});
r('GET', '/api/delivery', (db) => ({
  list: db.deliveries.map((x) => ({ ...x, customerName: custName(db, x.customerCode) })),
  kpi: { done: db.deliveries.filter((x) => x.stepIndex >= x.steps.length - 1).length, moving: db.deliveries.filter((x) => x.stepIndex > 0 && x.stepIndex < x.steps.length - 1).length, waiting: db.deliveries.filter((x) => x.stepIndex === 0).length },
}));
r('POST', '/api/delivery/:id/advance', (db, p) => {
  const x = db.deliveries.find((v) => v.id === p.id); if (!x) return { __status: 404, error: '없음' };
  if (x.stepIndex >= x.steps.length - 1) return { ok: true, msg: '이미 배달 완료' };
  x.stepIndex += 1; x.times[x.stepIndex] = `${todayStr()} ${nowTime()}`;
  act(db, '강민준', `배송 상태 갱신 → ${x.steps[x.stepIndex]}`, x.id);
  return { ok: true, msg: `${x.id} → ${x.steps[x.stepIndex]}` };
});
r('GET', '/api/export', (db) => {
  const list = db.exportShipments.map((e) => ({
    ...e, customerName: custName(db, e.customerCode),
    itemsView: e.items.map((x) => ({ ...x, name: (item(db, x.itemCode) || {}).name, unit: (item(db, x.itemCode) || {}).unit, amountUsd: Math.round(x.qty * x.priceUsd * 100) / 100 })),
    totalUsd: Math.round(e.items.reduce((s, x) => s + x.qty * x.priceUsd, 0) * 100) / 100,
  }));
  return { list, kpi: { active: list.filter((e) => e.stepIndex < e.steps.length - 1).length, monthUsd: Math.round(list.reduce((s, e) => s + e.totalUsd, 0)), nextEtd: list.filter((e) => e.etd >= todayStr()).sort((a, b) => a.etd.localeCompare(b.etd))[0] || null } };
});
r('POST', '/api/export/:id/advance', (db, p) => {
  const e = db.exportShipments.find((x) => x.id === p.id); if (!e) return { __status: 404, error: '없음' };
  if (e.stepIndex >= e.steps.length - 1) return { ok: true, msg: '이미 인도 완료' };
  e.stepIndex += 1;
  if (e.steps[e.stepIndex] === '선적' && e.blNo === '발급 예정') e.blNo = `${e.carrier.toUpperCase().slice(0, 4)}-${ymd()}-${pad2(Math.floor(Math.random() * 90) + 10)}`;
  act(db, '박지훈', `수출 진행 단계 갱신 → ${e.steps[e.stepIndex]}`, e.id);
  return { ok: true, msg: `${e.id} → ${e.steps[e.stepIndex]}${e.steps[e.stepIndex] === '선적' ? ` · B/L ${e.blNo} 발급` : ''}` };
});

/* ═══════════ 원가 ═══════════ */
r('GET', '/api/cost', (db) => {
  const rows = db.items.map((i) => ({ code: i.code, name: i.name, unit: i.unit, ...costOf(db, i) }));
  const al = raw(db, 'M-0040');
  const impacted = db.items.filter((i) => i.bom.some(([c]) => c === 'M-0040')).map((i) => {
    const q = i.bom.find(([c]) => c === 'M-0040')[1];
    return { code: i.code, name: i.name, delta: Math.round(q * al.unitCost * 0.09 * 10) / 10 };
  });
  return {
    rows, avgMargin: Math.round(rows.reduce((s, x) => s + x.margin, 0) / rows.length * 10) / 10,
    alert: { material: 'AL 호일 7㎛', change: '+9%', impacted, note: '대한알루미늄 6월 단가 인상 통보 — 영향 품목 단가 개정 검토 필요' },
  };
});

/* ═══════════ 회계 — 거래명세서 · 채권 ═══════════ */
r('GET', '/api/invoices', (db) => {
  const enrich = (v) => ({ ...v, customerName: custName(db, v.customerCode), itemsView: v.items.map((x) => ({ ...x, name: (item(db, x.code) || {}).name, unit: (item(db, x.code) || {}).unit, supply: x.qty * x.price })) });
  return { pending: db.invoices.filter((v) => v.status === '대기').map(enrich), issued: db.invoices.filter((v) => v.status === '발행').map(enrich) };
});
r('POST', '/api/invoices/:no/issue', (db, p) => {
  const v = db.invoices.find((x) => x.no === p.no); if (!v) return { __status: 404, error: '없음' };
  if (v.status === '발행') return { ok: true, msg: '이미 발행됨' };
  v.status = '발행'; v.issuedAt = `${todayStr()} ${nowTime()}`;
  act(db, '윤지혜', '거래명세서 발행 — RPA가 ERP에 자동 입력 (11초)', v.no);
  return { ok: true, msg: `거래명세서 ${v.no} 발행 완료 — 매출 원장 자동 반영` };
});
r('GET', '/api/finance/receivables', (db) => {
  const today = todayStr();
  const rows = db.customers.map((c) => {
    const st = custStat(db, c);
    const overdueFu = db.followUps.find((f) => f.customerCode === c.code && !f.done && f.date < today);
    const openClaim = db.claims.find((k) => k.customerCode === c.code && k.status === '진행중');
    const risks = [c.agingNote, overdueFu ? 'Follow-up 지연' : null, openClaim ? `클레임 진행중(${openClaim.type})` : null].filter(Boolean);
    return { code: c.code, name: c.name, grade: c.grade, country: c.country, ...st, collectRate: st.sales ? Math.round((st.paid / st.sales) * 1000) / 10 : 100, risks };
  }).sort((a, b) => b.recv - a.recv);
  const totalSales = rows.reduce((s, x) => s + x.sales, 0);
  const totalRecv = rows.reduce((s, x) => s + x.recv, 0);
  return {
    rows, totalSales, totalRecv, collectRate: Math.round(((totalSales - totalRecv) / totalSales) * 1000) / 10,
    priorities: rows.filter((x) => x.recv > 0).slice(0, 3).map((x, i) => ({ rank: i + 1, name: x.name, recv: x.recv, why: x.risks.length ? x.risks.join(' · ') : '미수 금액 상위 — 정기 회수 대상' })),
    recentPayments: db.payments.slice(-8).reverse().map((pm) => ({ ...pm, customerName: custName(db, pm.customerCode) })),
  };
});
r('POST', '/api/finance/payments', (db, p, body) => {
  const b = body || {};
  const c = cust(db, b.customerCode); if (!c) return { __status: 400, error: '거래처를 확인하세요' };
  const amount = parseInt(String(b.amount).replace(/[^\d]/g, ''), 10);
  if (!amount) return { __status: 400, error: '입금액을 입력하세요' };
  db.payments.push({ id: `PM-${pad2(db.seq.payment++)}`, customerCode: c.code, amount, date: todayStr(), method: b.method || '계좌이체' });
  act(db, '윤지혜', `입금 등록 ₩${amount.toLocaleString()} — 미수금 자동 재계산`, c.name);
  return { ok: true, msg: `${c.name} 입금 ₩${amount.toLocaleString()} 등록 — 미수금 자동 차감` };
});

/* ═══════════ 활동 로그 ═══════════ */
r('GET', '/api/activities', (db) => db.activities.slice(0, 30));

/* ═══════════ AI ═══════════ */
r('POST', '/api/ai/query', async (db, p, body) => ai.query(db, (body || {}).q || ''));
r('POST', '/api/ai/brief', async (db, p, body) => ai.brief(db, (body || {}).customerCode));
r('POST', '/api/ai/proposal', async (db, p, body) => ai.proposal(db, body || {}));
r('POST', '/api/ai/email', async (db, p, body) => ai.email(db, (body || {}).customerCode));
r('POST', '/api/ai/market', async (db, p, body) => ai.market(db, (body || {}).topic || ''));

/* ───────── 디스패처 ───────── */
async function handleApi(db, method, pathname, body) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = pathname.match(route.rx);
    if (!m) continue;
    const params = {};
    route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const result = await route.fn(db, params, body);
    const mutated = method !== 'GET';
    return { result, mutated };
  }
  return { result: { __status: 404, error: `API 없음: ${method} ${pathname}` }, mutated: false };
}

module.exports = { handleApi, helpers: { custStat, stockRow, rawRow, openQty, item, cust, custName, costOf } };
