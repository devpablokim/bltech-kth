/* ═══════════════════════════════════════════════════════════
   BL-tech MediERP — 프론트엔드 SPA
   모든 데이터·판정·문서생성은 서버 REST API에서 수행되고,
   이 파일은 서버 응답을 화면에 그리는 역할만 한다.
═══════════════════════════════════════════════════════════ */
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');
const won = (n) => '₩' + fmt(n);
const wonShort = (n) => Math.abs(n) >= 1e8 ? '₩' + (Math.round(n / 1e7) / 10).toLocaleString('ko-KR') + '억' : won(n);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function api(path, body) {
  const opt = body !== undefined ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined;
  const r = await fetch('/api' + path, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || '요청 실패 (' + r.status + ')');
  return j;
}

const S = { view: 'dash', custSel: null, lastUpload: null, worklogPrefill: null, chat: [], bubble: '합격' };
const M = { meta: null, masters: null, badges: {} };

/* ── 공통 UI 헬퍼 ── */
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.className = err ? 'err show' : 'show';
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 3200);
}
const PILL = { '정상': 'ok', '완료': 'ok', '출고완료': 'ok', '입고완료': 'ok', '종결': 'ok', '합격': 'ok', '발행': 'ok', '적용 중': 'ok', '사용 중': 'ok',
  '주의': 'warn', '온도 주의': 'warn', '잔량 부족': 'warn', '대기': 'warn', '발행 대기': 'warn', '진행중': 'warn', '운송중': 'warn', '발주완료': 'info', '예정': 'gray', '지시발행': 'info',
  '부족': 'bad', '기준 이탈': 'bad', '소진': 'bad', '불합격': 'bad', '생산필요': 'warn', '즉시출고': 'ok',
  '진행': 'info', '진행 중': 'info', '신규': 'info', '피킹': 'info', '상차': 'info', '생산배정': 'info', '출고대기': 'info', '출고진행': 'info', '보세창고 이동': 'med' };
const pill = (txt, cls) => `<span class="pill ${cls || PILL[txt] || 'gray'}">${esc(txt)}</span>`;
const kpi = (label, val, unit, delta, cls) => `<div class="card kpi"><div class="label">${label}</div><div class="val">${val}<span class="unit">${unit || ''}</span></div>${delta ? `<span class="delta ${cls || 'flat'}">${delta}</span>` : ''}</div>`;
const GRADE_COLOR = { 'A+': '#B3362B', 'A': '#1B4DD8', 'B': '#2F7D5B', 'C': '#7A828C' };
const gchip = (g) => `<span class="grade-chip" style="color:${GRADE_COLOR[g] || '#555'};border-color:${GRADE_COLOR[g] || '#999'}">${g}</span>`;
const tbl = (heads, rows) => `<div class="tbl-wrap"><table><thead><tr>${heads.map((h) => `<th${/수량|금액|단가|재고|잔량|합계|매출|미수|입금|원가|마진/.test(h) ? ' class="t-right"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="' + heads.length + '" class="muted">데이터 없음</td></tr>'}</tbody></table></div>`;
const feed = (a) => `<div class="feed-item"><div class="feed-ic ${a.severity}">${a.icon}</div><div><div class="a-t">${esc(a.title)}</div><div class="a-d">${esc(a.desc)}</div><div class="a-src">${a.time} · ${esc(a.source)}</div></div></div>`;
const aiBox = (id) => `<div class="ai-box loading" id="${id}">AI가 작성 중입니다…</div>`;
function showAi(id, res) { const el = $('#' + id); if (!el) return; el.classList.remove('loading'); el.innerHTML = esc(res.text).replace(/\n/g, '<br>') + `<div class="ai-engine">ENGINE: ${res.engine}</div>`; }
const dday = (n) => n <= 0 ? `<span class="pill bad">D-day</span>` : n <= 2 ? `<span class="pill bad">D-${n}</span>` : n <= 4 ? `<span class="pill warn">D-${n}</span>` : `<span class="mono muted">D-${n}</span>`;

/* ── 내비게이션 정의 (좌측 탭 — 자료의 모든 모듈 포함) ── */
const GROUPS = [
  ['OVERVIEW', [['dash', '◧', '통합 현황']]],
  ['영업 · 판매', [['orders', '⬇', '수주 관리', 'orders'], ['customers', '◈', '거래처 관리 (CRM)'], ['proposal', '✎', 'AI 제안서'], ['market', '🔭', '시장·경쟁 분석'], ['followup', '◷', 'Follow-up', 'followup']]],
  ['생산', [['proddash', '⚙', '생산 현황'], ['workorders', '📋', '작업지시 · OEM 스펙'], ['worklog', '✍', '공정일지 입력'], ['lots', '▣', '생산 LOT'], ['quality', '✓', '품질 관리', 'quality'], ['materials', '🧪', '원재료 · 배합'], ['plan', '🗓', '생산계획'], ['workers', '👤', '작업자']]],
  ['구매', [['purchase', '🛒', '구매 발주', 'purchase'], ['suppliers', '🏭', '공급처']]],
  ['물류 · 재고', [['stock', '▦', '재고 현황', 'stock'], ['warehouse', '🏬', '창고 · 입출고']]],
  ['유통 · 배송', [['shipping', '⬈', '출고 관리'], ['delivery', '🚚', '배송 추적'], ['export', '⛴', '수출 선적']]],
  ['원가 · 회계', [['cost', '🧮', '원가 관리'], ['invoices', '≡', '거래명세서', 'invoices'], ['receivables', '💳', '매출 · 미수금']]],
  ['기준정보', [['items', '◇', '품목 · 단가 마스터'], ['employees', '🪪', '사원 · 조직']]],
  ['AI', [['ai', '✦', 'AI 통합 비서']]],
];
const TITLES = {}; GROUPS.forEach(([, items]) => items.forEach(([k, , t]) => (TITLES[k] = t)));

function buildNav() {
  $('#nav').innerHTML = GROUPS.map(([label, items]) => `
    <div class="nav-label">${label}</div>
    ${items.map(([k, ic, t, badge]) => `<button class="nav-btn${S.view === k ? ' active' : ''}" data-view="${k}" onclick="A.nav('${k}')"><span class="ic">${ic}</span><span class="lbl">${t}</span>${badge ? `<span class="cnt" id="cnt-${badge}" style="display:none"></span>` : ''}</button>`).join('')}
  `).join('');
  applyBadges();
}
function applyBadges() {
  Object.entries(M.badges || {}).forEach(([k, v]) => {
    const el = $('#cnt-' + k); if (!el) return;
    el.textContent = v; el.style.display = v > 0 ? '' : 'none';
    if (k === 'orders' || k === 'invoices') el.classList.add('blue');
  });
}
async function refreshBadges() {
  try { const d = await api('/dashboard'); M.badges = d.navBadges; applyBadges(); } catch {}
}

/* ═══════════ 화면 렌더러 ═══════════ */
const VIEWS = {

  /* ── 통합 현황 ── */
  async dash() {
    const d = await api('/dashboard');
    const k = d.kpis;
    const stages = [
      ['수주', 'orders', d.pipeline.order], ['재고확인', 'stock', d.pipeline.stock], ['생산계획', 'plan', d.pipeline.plan], ['출고', 'shipping', d.pipeline.ship], ['거래명세서', 'invoices', d.pipeline.invoice],
    ];
    const maxT = Math.max(...d.weekTrend.map((w) => Math.max(w.inAmt, w.outAmt)), 1);
    return `
    <div class="pipeline">
      <div class="pl-head"><div class="pl-title">ORDER → STOCK → PLAN → SHIP → INVOICE · 비엘테크 통합 프로세스 라인</div><div class="pl-live"><span class="dot"></span>LIVE · SERVER</div></div>
      <div class="pl-flow">${stages.map(([name, view, st], i) => `
        ${i ? '<div class="pl-arrow">▶</div>' : ''}
        <div class="stage" onclick="A.nav('${view}')"><div class="s-step">STEP ${i + 1}</div><div class="s-name">${name}</div><div class="s-num">${st.n}<span>건</span></div><div class="s-alert ${st.tone}">${st.note}</div></div>`).join('')}
      </div>
    </div>
    <div class="grid g4">
      ${kpi('오늘 생산수량', fmt(k.todayProd), ' EA', `계획 ${fmt(k.todayPlan)} · 달성률 ${k.planRate}%`, k.planRate >= 90 ? 'good' : 'warn')}
      ${kpi('불량률', k.defectRate, ' %', `▲ ${k.defectTrend}%p — AI 원인 분석 완료`, 'bad')}
      ${kpi('재고 부족 품목', k.stockShort, ' 건', '완제품+원자재 · 수주잔량 반영', k.stockShort ? 'bad' : 'good')}
      ${kpi('납기 임박 수주', k.dueRisk, ' 건', 'D-2 이내 · 생산 우선순위 자동 상향', k.dueRisk ? 'warn' : 'good')}
    </div>
    <div class="grid g4 mt">
      ${kpi('매출 누계 (연)', wonShort(k.salesTotal), '', `이달 ${wonShort(k.salesMonth)} · 매출·미수금 탭과 동일 집계`, 'good')}
      ${kpi('총 미수금', wonShort(k.recvTotal), '', `지연 Follow-up ${k.overdueFu}건 연계`, k.recvTotal > 0 ? 'warn' : 'good')}
      ${kpi('수출 진행', k.exportActive, ' 건', '선적·통관 단계 추적 중', 'flat')}
      ${kpi('설비 가동', `${k.machinesUp} / ${k.machinesTotal}`, ' 대', '실링기 #4 예방정비', 'warn')}
    </div>
    <div class="grid g2-13 mt">
      <div class="card"><h3>오늘의 AI 사전 예측 <span class="tag">PREDICT · SERVER</span></h3>${d.alerts.map(feed).join('')}</div>
      <div class="card"><h3>주간 수주 · 출고 추이 <span class="tag">7 DAYS</span></h3>
        <div class="bars">${d.weekTrend.map((w) => `<div class="bar-g"><div class="bar-pair"><div class="bar in" style="height:${Math.round((w.inAmt / maxT) * 100)}%"></div><div class="bar out" style="height:${Math.round((w.outAmt / maxT) * 100)}%"></div></div><div class="bl">${w.label}</div></div>`).join('')}</div>
        <div class="legend"><span><i style="background:var(--med)"></i>수주 접수</span><span><i style="background:#BFE0DC"></i>출고 완료</span></div>
        <div class="hint"><b>AI 코멘트</b> — ${d.aiComment}</div>
      </div>
    </div>`;
  },

  /* ── 수주 관리 ── */
  async orders() {
    const list = await api('/orders');
    const up = S.lastUpload;
    return `
    <p class="section-note">기존 주문 엑셀을 그대로 업로드하면 <b>서버가 거래처 별칭 매칭 → 단가등급 자동 적용 → 재고 자동 비교</b>까지 수행합니다. 수기 입력(건당 평균 9분)이 0분이 됩니다.</p>
    <div class="grid g2-13">
      <div class="card"><h3>수주 엑셀 업로드 <span class="tag">SERVER AUTO PARSE</span></h3>
        <div class="upzone" onclick="document.getElementById('csvFile').click()">
          <div class="u-ic">⬆</div><div class="u-t">주문 엑셀(CSV)을 그대로 올리세요</div>
          <div class="u-d">양식 변경 없이 — 서버가 열 구조·거래처 별칭·품목코드를 자동 인식합니다</div>
          <div class="u-fmt">.CSV 업로드 · 또는 아래 샘플 버튼으로 서버 파서 시연</div>
        </div>
        <input type="file" id="csvFile" accept=".csv,text/csv" style="display:none" onchange="A.uploadCsv(this)">
        <div class="steps">
          <div class="step-chip done"><span class="n">1</span>파일 인식</div>
          <div class="step-chip done"><span class="n">2</span>거래처·품목 매칭</div>
          <div class="step-chip done"><span class="n">3</span>단가등급 적용</div>
          <div class="step-chip done"><span class="n">4</span>재고 자동 비교</div>
          <div class="step-chip"><span class="n">5</span>생산계획 반영</div>
        </div>
        <div class="submit-bar"><button class="btn primary" onclick="A.uploadSample()">샘플 수주 3건 업로드 (서버 파싱)</button></div>
        <div class="hint"><b>자동 매칭</b> — "한빛", "한빛메디칼(주)" 같은 표기 차이도 거래처 마스터 별칭으로 통일됩니다. 미등록 품목은 <b>확인 필요</b>로 분리되어 누락되지 않습니다.</div>
      </div>
      <div class="card"><h3>AI 분석 요약 — 최근 업로드</h3>
        ${up ? `
        <div class="grid g3" style="gap:10px;margin-bottom:12px">
          <div style="background:var(--ok-bg);border-radius:10px;padding:11px 13px"><div style="color:var(--ok);font-weight:700;font-size:11px">즉시 출고 가능</div><div style="font-size:21px;font-weight:800;color:var(--ok)">${up.summary.ok}건</div></div>
          <div style="background:var(--warn-bg);border-radius:10px;padding:11px 13px"><div style="color:var(--warn);font-weight:700;font-size:11px">생산 필요</div><div style="font-size:21px;font-weight:800;color:var(--warn)">${up.summary.prod}건</div></div>
          <div style="background:var(--bad-bg);border-radius:10px;padding:11px 13px"><div style="color:var(--bad);font-weight:700;font-size:11px">확인 필요</div><div style="font-size:21px;font-weight:800;color:var(--bad)">${up.summary.errors}건</div></div>
        </div>
        <div class="muted">수주 ${up.summary.total}건 분석 완료 · 처리 ${up.summary.time} · 단가 자동 적용 ${up.summary.priceMatched}/${up.summary.total}</div>
        ${up.errors.length ? `<div class="hint" style="border-color:var(--bad)"><b>확인 필요</b> — ${up.errors.map((e) => `${esc(e.row.customer || e.row.item)}: ${e.reason}`).join(' · ')}</div>` : ''}`
        : '<div class="empty">아직 업로드 이력이 없습니다.<br>좌측에서 CSV를 올리거나 샘플 버튼을 눌러보세요.</div>'}
        <div class="hint"><b>도입 전</b> 수주 엑셀 → ERP 수기 입력 + 재고 수기 대조 <b>건당 9분</b> → 현재 <b>0분 (서버 자동)</b></div>
      </div>
    </div>
    <div class="card mt"><h3>수주 현황 <span class="tag">${list.length}건 · 단가등급 자동 적용</span></h3>
      ${tbl(['수주번호', '거래처', '품목', '수량', '단가', '금액', '납기', '재고 판정', '상태', ''],
        list.map((o) => `<tr${o.dday <= 1 && o.status !== '출고완료' ? ' class="row-hl"' : ''}>
          <td class="mono">${o.no}</td><td><b>${esc(o.customerName)}</b><span class="muted" style="margin-left:5px">${o.country}</span></td>
          <td>${esc(o.itemName)}<div class="mono muted">${o.itemCode}</div></td>
          <td class="mono t-right">${fmt(o.qty)}${o.unit}</td><td class="mono t-right">₩${fmt(o.unitPrice)}</td><td class="mono t-right">${won(o.amount)}</td>
          <td class="mono">${o.dueDate.slice(5)} ${o.status !== '출고완료' ? dday(o.dday) : ''}</td>
          <td>${pill(o.verdict)}</td><td>${pill(o.status)}</td>
          <td>${o.status === '신규' ? `<button class="btn sm" onclick="A.assign('${o.no}')">${o.verdict === '즉시출고' ? '출고 배정' : '생산 배정'}</button>` : ''}</td>
        </tr>`).join(''))}
      <div class="hint"><b>거래처별 단가</b>가 서버에서 자동 적용됩니다 — 같은 품목이라도 단가등급(A+/A/B/C)에 따라 다른 단가가 매겨지며, 단가 마스터 한 곳만 바꾸면 전체 프로세스에 반영됩니다.</div>
    </div>`;
  },

  /* ── 거래처 관리 (CRM) ── */
  async customers() {
    const list = await api('/customers');
    const sel = S.custSel || list[0].code;
    S.custSel = sel;
    const c = await api('/customers/' + sel);
    return `
    <p class="section-note">거래처 마스터 · 주문 이력 · 클레임 · 미수금을 한 화면에서 — <b>AI 브리핑</b>이 서버 데이터를 분석해 리스크와 다음 액션을 제안합니다.</p>
    <div class="split">
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><h3 style="margin:0">거래처 마스터 <span class="tag">${list.length}개사</span></h3><input class="search" placeholder="거래처·국가 검색" oninput="A.filterCust(this.value)"></div>
        ${tbl(['코드', '거래처명', '국가', '등급', '미수금'], list.map((x) => `
          <tr class="rowlink${x.code === sel ? ' sel' : ''}" data-cname="${esc(x.name)}${x.country}" onclick="A.selCust('${x.code}')">
            <td class="mono">${x.code}</td><td><b>${esc(x.name)}</b>${x.oem ? ' <span class="pill med">OEM</span>' : ''}</td><td>${x.country}</td><td>${gchip(x.grade)}</td>
            <td class="mono t-right${x.recv > 0 ? ' warn-t' : ''}">${fmt(x.recv)}</td></tr>`).join(''))}
      </div>
      <div class="card">
        <div class="d-head"><div><h2>${esc(c.name)} ${gchip(c.grade)}</h2><div class="d-sub">${c.code} · ${c.bizNo} · ${c.country}</div></div>
        <button class="btn med sm" onclick="A.brief('${c.code}')">AI 브리핑</button></div>
        <div class="d-meta">
          <div><span>대표자</span>${esc(c.ceo)}</div><div><span>영업 담당</span>${esc(c.managerName)}</div>
          <div><span>거래처 담당</span>${esc(c.contact.name)} · ${esc(c.contact.phone)}</div><div><span>출고지</span>${esc(c.address)}</div>
          <div style="grid-column:1/-1"><span>매출/입금/미수</span><b class="mono">${fmt(c.sales)} / ${fmt(c.paid)} / <i class="warn-t">${fmt(c.recv)}</i></b></div>
        </div>
        <div id="briefBox"></div>
        <h3 style="margin:14px 0 8px">주문 이력</h3>
        ${tbl(['주문번호', '일자', '품목', '수량', '금액', '상태'], c.orders.map((o) => `<tr><td class="mono">${o.no}</td><td class="mono">${o.date.slice(5)}</td><td>${esc(o.itemName)}</td><td class="mono t-right">${fmt(o.qty)}</td><td class="mono t-right">${fmt(o.amount)}</td><td>${pill(o.status)}</td></tr>`).join(''))}
        <h3 style="margin:14px 0 8px">클레임 이력</h3>
        ${c.claims.length ? c.claims.map((k) => `<div class="fu-row"><span class="fu-date">${k.date.slice(5)}</span><span class="fu-name">${k.type}</span><span class="fu-note">${esc(k.desc)}</span>${pill(k.status)}</div>`).join('') : '<div class="muted">클레임 이력이 없습니다.</div>'}
      </div>
    </div>`;
  },

  /* ── AI 제안서 ── */
  async proposal() {
    const cs = M.masters.customers;
    return `
    <p class="section-note">거래처의 주문 이력 · 단가등급 · 클레임 데이터를 <b>서버가 직접 분석해</b> 제안서 초안을 생성합니다.</p>
    <div class="split">
      <div class="card"><h3>고객 맞춤형 제안서 생성</h3>
        <div class="field"><label>대상 거래처</label><select id="pp-cust">${cs.map((c) => `<option value="${c.code}">${c.code} · ${esc(c.name)} (${c.grade})</option>`).join('')}</select></div>
        <div class="field mt"><label>제안 품목</label><input id="pp-item" value="진단키트 파우치 50㎖ (신제품)"></div>
        <div class="field mt"><label>제안 목적</label><input id="pp-goal" value="신제품 도입 제안"></div>
        <div class="submit-bar"><button class="btn primary" onclick="A.runProposal()">제안서 초안 생성</button></div>
        <div class="hint"><b>ISO 13485 · GMP</b> 인증과 LOT 추적 체계가 제안 근거로 자동 포함됩니다. ANTHROPIC_API_KEY 설정 시 Claude가 문장을 다듬습니다.</div>
      </div>
      <div class="card"><h3>제안서 초안 <span class="tag">SERVER GENERATED</span></h3><div id="pp-out"><div class="empty">왼쪽에서 거래처와 제안 내용을 입력한 뒤 생성을 누르세요.</div></div></div>
    </div>`;
  },

  /* ── 시장 분석 ── */
  async market() {
    return `
    <p class="section-note">시장 동향 / 경쟁 구도 / 신규 거래처 발굴 기회 / 영업전략 제언 — 서버가 자사 수출국·품목 데이터와 결합해 보고서를 생성합니다.</p>
    <div class="split">
      <div class="card"><h3>시장 · 경쟁사 분석</h3>
        <div class="field"><label>조사 주제</label><textarea id="mk-q" rows="4" placeholder="예: 베트남 의료용 멸균 포장재 B2B 시장 동향과 주요 바이어">동남아 의료용 멸균 포장재 시장 동향과 신규 바이어 발굴</textarea></div>
        <div class="submit-bar"><button class="btn primary" onclick="A.runMarket()">분석 시작</button></div>
      </div>
      <div class="card"><h3>분석 결과 <span class="tag">MARKET INTELLIGENCE</span></h3><div id="mk-out"><div class="empty">조사 주제를 입력하면 시장 동향 / 경쟁사 / 발굴 기회 / 전략 제언 순으로 보고서가 생성됩니다.</div></div></div>
    </div>`;
  },

  /* ── Follow-up ── */
  async followup() {
    const list = await api('/sales/followups');
    return `
    <p class="section-note">예정일이 지난 항목은 붉게 표시됩니다. 각 항목에서 <b>AI 이메일 초안</b>을 서버가 바로 생성합니다 (해외 거래처는 영문 제목 병기).</p>
    <div class="card"><h3>Follow-up 일정 <span class="tag">지연 ${list.filter((f) => f.overdue).length}건</span></h3>
      ${list.map((f) => `
        <div class="fu-row${f.overdue ? ' late' : ''}">
          <span class="fu-date">${f.date}</span>
          <span class="fu-name">${esc(f.customerName)} ${gchip(f.grade)}</span>
          <span class="fu-note">${esc(f.note)}</span>
          ${f.overdue ? '<span class="pill bad">지연</span>' : ''}${f.done ? pill('완료', 'ok') : ''}
          ${!f.done ? `<button class="btn sm" onclick="A.fuMail('${f.id}','${f.customerCode}')">이메일 초안</button><button class="btn sm" onclick="A.fuDone('${f.id}')">완료</button>` : ''}
        </div>
        <div id="fu-mail-${f.id}"></div>`).join('')}
    </div>`;
  },

  /* ── 생산 현황 ── */
  async proddash() {
    const d = await api('/production/overview');
    const k = d.kpis;
    const sealers = d.machines.filter((m) => m.name.startsWith('실링기'));
    const others = d.machines.filter((m) => !m.name.startsWith('실링기'));
    return `
    <div class="grid g4">
      ${kpi('오늘 생산수량', fmt(k.todayProd), ' EA', `▲ 계획 대비 ${k.planRate}%`, k.planRate >= 90 ? 'good' : 'warn')}
      ${kpi('계획 달성률', k.planRate, ' %', `목표 ${fmt(k.todayPlan)} EA`, 'good')}
      ${kpi('불량률', k.defectRate, ' %', `▲ ${k.defectTrend}%p — AI 원인 분석 완료`, 'bad')}
      ${kpi('가동 실링기', `${k.sealersUp} / ${k.sealersTotal}`, '', `오늘 일지 입력 ${k.todayLogs}건`, 'warn')}
    </div>
    <div class="grid g3 mt">
      ${sealers.slice(0, 3).map((m) => {
        const pct = m.tempMax ? Math.min(100, Math.round((m.sealTemp / m.tempMax) * 100)) : 0;
        const tone = m.status === '정상' ? 'var(--ok)' : m.status.includes('주의') ? 'var(--warn)' : '#B6BFCB';
        return `<div class="machine"><div class="head"><b>${m.name}</b>${pill(m.status)}</div>
          <div class="m-row"><span>실링 온도</span><span class="mono"${m.status.includes('주의') ? ' style="color:var(--warn)"' : ''}>${m.sealTemp} ℃</span></div>
          <div class="gauge"><i style="width:${pct}%;background:${tone}"></i></div>
          <div class="m-row"><span>기계 내부 온습도</span><span class="mono">${m.roomTemp}℃ / ${m.humidity}%</span></div>
          <div class="m-row"><span>현재 LOT</span><span class="mono">${m.lot}</span></div></div>`;
      }).join('')}
    </div>
    <div class="grid g3 mt" style="grid-template-columns:repeat(3,1fr)">
      ${sealers.slice(3).concat(others).map((m) => `<div class="machine"><div class="head"><b>${m.name}</b>${pill(m.status)}</div><div class="m-row"><span>현재 작업</span><span class="mono">${m.lot}</span></div><div class="m-row"><span>내부 온습도</span><span class="mono">${m.roomTemp}℃ / ${m.humidity}%</span></div></div>`).join('')}
    </div>
    <div class="grid g2 mt">
      <div class="card"><h3>품목별 생산실적 <span class="tag">TODAY · 서버 자동 집계</span></h3>
        ${d.bars.map((b) => `<div class="bar-row"><span class="bname">${esc(b.name)}</span><div class="bar-track"><i style="width:${b.pct}%"></i></div><span class="bval">${fmt(b.qty)} ${b.unit}</span></div>`).join('') || '<div class="muted">오늘 생산 기록 없음</div>'}
      </div>
      <div class="card"><h3>AI 이상감지 알림 <span class="tag">REAL-TIME</span></h3>${d.feed.map(feed).join('')}</div>
    </div>`;
  },

  /* ── 작업지시 · OEM 스펙 ── */
  async workorders() {
    const d = await api('/production/workorders');
    const w = d.list.find((x) => x.no === S.woSel) || d.list.find((x) => x.status === '진행') || d.list[0];
    return `
    <p class="section-note">OEM 제품은 1년에 한 번 오는 발주도 많습니다 — <b>작업지시서에 설계도 · 포장재/라벨 · 원단 스펙을 묶어</b> 작업자 태블릿에 그대로 전달하면, 묻지 않아도 정확한 스펙으로 작업이 시작됩니다.</p>
    <div class="grid g3">
      ${kpi('오늘 작업지시', d.list.length + ' 건', '', `진행 ${d.list.filter((x) => x.status === '진행').length} · 대기 ${d.list.filter((x) => x.status === '대기').length}`, 'good')}
      ${kpi('OEM 스펙 라이브러리', d.specLibrary + ' 개', '', `거래처 ${d.specVendors}곳 · 전 이력 보존`, 'good')}
      ${kpi('스펙 확인 오류', '0 건', '', '도입 전 월평균 4.2건', 'good')}
    </div>
    <div class="card mt"><h3>생산지시 목록 <span class="tag">WORK ORDERS · 행 선택 시 스펙·일일 지시 표시</span></h3>
      ${tbl(['지시번호', '거래처', '품목', '수량', '스펙', '일일 지시', '담당', '진행률', '상태', ''],
        d.list.map((x) => `<tr class="rowlink${x.no === w.no ? ' sel' : ''}" onclick="A.selWo('${x.no}')">
          <td class="mono">${x.no}</td><td><b>${esc(x.customerName)}</b></td><td>${esc(x.itemName)}</td><td class="mono t-right">${fmt(x.qty)}</td>
          <td><span class="pill info">스펙 ${x.specVer}</span></td><td class="mono t-center">${(x.dailyPlan || []).length}일 분할</td><td>${x.assignee}</td>
          <td class="mono">${x.progress}%</td><td>${pill(x.status)}</td>
          <td>${x.status === '대기' ? `<button class="btn sm" onclick="event.stopPropagation();A.issueWo('${x.no}')">발행</button>` : ''}</td></tr>`).join(''))}
    </div>
    ${w ? `<div class="card mt" style="border:1.5px solid var(--med)">
      <h3>${w.no} · ${esc(w.customerName)} 스펙 상세 <span class="tag">작업자 태블릿 동일 화면</span></h3>
      <div class="grid g2" style="gap:18px">
        <div>
          <div style="border:1px dashed var(--line);border-radius:10px;padding:16px;background:#FBFBF9;text-align:center">
            <div style="font-size:34px;margin-bottom:5px">📐</div><b style="font-size:13px">설계도면 · ${w.drawing || '표준 도면'}</b>
            <div style="font-size:11.5px;color:var(--steel);margin-top:4px">${esc(w.spec.실링조건)}</div>
          </div>
          ${w.specChange ? `<div class="feed-item" style="border:none;padding:10px 0 0"><div class="feed-ic blue">🕘</div><div><div class="a-t">스펙 이력 자동 비교</div><div class="a-d">${esc(w.specChange)}</div></div></div>` : ''}
        </div>
        <div>
          ${tbl(['작업 스펙 시트', ''], Object.entries(w.spec).map(([k, v]) => `<tr><td style="width:90px;color:var(--steel);font-weight:600">${k}</td><td>${esc(v)}${k === '라벨' && String(v).includes('v3') ? ' <span class="pill warn">v2 사용 금지</span>' : ''}${k === '원단' ? ' <span class="pill ok">재고 확인됨</span>' : ''}</td></tr>`).join(''))}
          <div class="submit-bar"><button class="btn primary" onclick="A.startLog('${w.no}','${w.itemCode}')">이 스펙으로 공정일지 시작</button><span class="save-note">✓ 작업자 스펙 확인 완료</span></div>
        </div>
      </div>
      ${(w.dailyPlan || []).length ? `
      <h3 style="margin:16px 0 8px">일일 생산지시 — ${w.no} <span class="tag" style="margin-left:0">DAILY DIRECTIVES · ${w.dailyPlan.length}일 분할</span></h3>
      ${tbl(['일자', '지시 수량', '라인', '실적', '달성률', '상태', ''],
        w.dailyPlan.map((r) => {
          const rate = r.qty ? Math.round((r.actual / r.qty) * 100) : 0;
          return `<tr${r.date === M.meta.today ? ' style="background:#F4FBFA"' : ''}>
            <td class="mono">${r.date}${r.date === M.meta.today ? ' <span class="pill med">오늘</span>' : ''}</td>
            <td class="mono t-right">${fmt(r.qty)}</td><td>${r.machine}</td>
            <td class="mono t-right">${fmt(r.actual)}</td>
            <td class="mono t-right"${rate >= 100 ? ' style="color:var(--ok);font-weight:700"' : ''}>${rate}%</td>
            <td>${pill(r.status)}</td>
            <td>${!r.issued ? `<button class="btn sm primary" onclick="A.issueDaily('${w.no}','${r.date}')">지시 발행</button>` : '<span class="save-note" style="margin:0">✓ 태블릿 전송됨</span>'}</td></tr>`;
        }).join(''))}
      <div class="hint"><b>일일 지시 → 공정일지 연동</b> — 공정일지를 이 작업지시로 저장하면 해당 일자의 일일 지시 실적이 서버에서 자동 누적되고 상태가 진행/완료로 갱신됩니다.</div>` : ''}
    </div>` : ''}`;
  },

  /* ── 공정일지 입력 ── */
  async worklog() {
    const d = await api('/production/worklogs');
    const ms = M.masters;
    const pre = S.worklogPrefill || {};
    const sealers = ms.machines.filter((m) => m.name.startsWith('실링기') && m.status !== '예방정비');
    const defaultMc = pre.machine || sealers[0].name;
    const workers = ms.employees.filter((e) => e.dept.includes('생산'));
    S.worklogPrefill = null;
    return `
    <p class="section-note">태블릿 화면 그대로의 입력 폼입니다. <b>저장 즉시 서버가 LOT 자동 채번 → 실적 집계 → 품질 판정(AI 이상감지) → ERP 등록</b>까지 수행합니다 — 종이 작성 · 엑셀 재입력 · ERP 등록의 3중 반복 업무가 이 화면 하나로 끝납니다.</p>
    <div class="card"><h3>생산공정일지 · 신규 작성 <span class="tag">NO. ${d.nextNo}</span></h3>
      <div class="form-grid">
        <div class="field"><label>작업지시 <span class="auto">● 스펙 자동 연동</span></label><select id="wl-wo">${ms.workOrders.map((w) => `<option value="${w.no}" data-item="${w.itemCode}"${pre.woNo === w.no ? ' selected' : ''}>${w.no} · ${esc((ms.customers.find((c) => c.code === w.customerCode) || { name: '자체 생산' }).name)} (스펙 ${w.specVer})</option>`).join('')}<option value="">지시 없음 (자체 생산)</option></select></div>
        <div class="field"><label>생산자</label><select id="wl-worker">${workers.map((e) => `<option>${e.name}</option>`).join('')}</select></div>
        <div class="field"><label>실링기</label><select id="wl-machine" onchange="A.syncSensor()">${sealers.map((m) => `<option${m.name === defaultMc ? ' selected' : ''}>${m.name}</option>`).join('')}</select></div>
        <div class="field"><label>실링 온도 <span class="auto">● 센서 자동입력</span></label><input class="mono-in" id="wl-temp" readonly></div>
        <div class="field"><label>실내 온습도 <span class="auto">● 센서 자동입력</span></label><input class="mono-in" id="wl-room" readonly></div>
        <div class="field"><label>제품코드</label><select id="wl-item">${ms.items.map((i) => `<option value="${i.code}"${pre.itemCode === i.code ? ' selected' : ''}>${i.code} · ${esc(i.name)}</option>`).join('')}</select></div>
        <div class="field"><label>LOT 번호 <span class="auto">● 저장 시 서버 자동 채번</span></label><input class="mono-in" value="자동 채번" readonly></div>
        <div class="field"><label>생산수량</label><input class="mono-in" id="wl-qty" value="1200"></div>
        <div class="field"><label>잔량</label><input class="mono-in" id="wl-remain" value="0"></div>
        <div class="field"><label>코팅량</label><input class="mono-in" id="wl-coating" value="3.2kg"></div>
        <div class="field"><label>제품 무게 (g · 기준 245–255)</label><input class="mono-in" id="wl-weight" value="249.2"></div>
        <div class="field"><label>수지명 · 컬러</label><input id="wl-resin" value="EP-700 · 클리어"></div>
        <div class="field"><label>촉매</label><input class="mono-in" id="wl-cat" value="CAT-12"></div>
        <div class="field"><label>배합일</label><input class="mono-in" id="wl-mix" type="date" value="${new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)}"></div>
        <div class="field"><label>기포테스트</label><div class="seg" id="wl-bubble">
          <button class="on" onclick="A.segSel(this,'합격')">합격</button><button onclick="A.segSel(this,'재검 → 합격')">재검</button><button onclick="A.segSel(this,'불합격')">불합격</button></div></div>
      </div>
      <div class="submit-bar">
        <button class="btn primary" onclick="A.saveLog()">일지 저장 → LOT 채번 · 실적 자동 등록</button>
        <span class="save-note" id="wl-note">서버 자동 저장 대기</span>
      </div>
    </div>
    <div class="card mt"><h3>오늘 입력된 공정일지 <span class="tag">${d.todayLogs}건 · ERP SYNCED</span></h3>
      ${tbl(['시각', 'LOT', '품목', '생산자', '실링기', '수량', '무게', '기포테스트'],
        d.list.slice(0, 8).map((w) => `<tr><td class="mono">${w.time}</td><td class="mono">${w.lotNo}</td><td class="mono">${w.itemCode}</td><td>${w.worker}</td><td>${w.machine}</td><td class="mono t-right">${fmt(w.qty)}</td><td class="mono">${w.weight}g</td><td>${pill(w.bubbleTest.includes('불') ? '불합격' : '합격')}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── 생산 LOT ── */
  async lots() {
    const list = await api('/production/lots');
    return `
    <p class="section-note">제품코드 · LOT번호 · 생산수량 · 잔량 · 코팅량을 LOT 단위로 추적합니다. 모든 행은 <b>공정일지 입력과 동시에 서버에서 생성</b>되며 품질 이슈 시 원재료까지 즉시 역추적됩니다.</p>
    <div class="card"><h3>생산 LOT 추적 <span class="tag">${list.length} LOTS · ERP SYNCED</span></h3>
      ${tbl(['LOT 번호', '제품코드', '품명', '생산일', '생산수량', '잔량', '코팅량', '실링기', '생산자', '상태'],
        list.map((l) => `<tr><td class="mono">${l.no}</td><td class="mono">${l.itemCode}</td><td>${esc(l.itemName)}</td><td class="mono">${l.date.slice(5)}</td><td class="mono t-right">${fmt(l.qty)}</td><td class="mono t-right">${fmt(l.remain)}</td><td class="mono">${l.coating}</td><td>${l.machine.replace('실링기 ', '')}</td><td>${l.worker}</td><td>${pill(l.status)}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── 품질 관리 ── */
  async quality() {
    const d = await api('/production/quality');
    const s = d.stats;
    return `
    <p class="section-note">실링기 온도 · 실내/기계 내부 온습도 · 제품 무게 · 기포테스트 결과를 기준값과 함께 관리합니다. 기준 초과 시 <b>서버 AI 이상감지가 즉시 알림</b>을 발송합니다. (GMP/ISO 13485 문서화 지원)</p>
    <div class="grid g3">
      ${kpi('기포테스트 합격률', s.bubblePassRate, ' %', `최근 7일 평균 ${s.bubblePass7d}%`, 'good')}
      ${kpi('무게 기준 이탈', s.weightOut, ' 건', '습도 상관 분석 완료', 'warn')}
      ${kpi('온도 기준 초과', s.tempOver, ' 건', '실링기 #2 · 점검 권장', 'bad')}
    </div>
    <div class="card mt"><h3>품질 측정 기록 <span class="tag">기준 초과 자동 하이라이트</span></h3>
      ${tbl(['시각', 'LOT', '실링 온도 (기준 175–198℃)', '실내 온습도', '제품 무게 (기준 245–255g)', '기포테스트', '판정'],
        d.records.map((q) => {
          const tBad = q.sealTemp >= 195; const wBad = q.weight !== '-' && (q.weight < 245 || q.weight > 255);
          return `<tr><td class="mono">${q.time}</td><td class="mono">${q.lotNo}</td>
            <td class="mono"${tBad ? ' style="color:var(--warn);font-weight:600"' : ''}>${q.sealTemp} ℃</td>
            <td class="mono">${q.room}</td>
            <td class="mono"${wBad ? ' style="color:var(--bad);font-weight:600"' : ''}>${q.weight} g</td>
            <td>${q.bubble}</td><td>${pill(q.verdict)}</td></tr>`;
        }).join(''))}
      <div class="hint"><b>AI 불량분석</b> — 기포 불량 증가는 실내 습도 상승(${s.humidityRange})과 상관도 ${s.humidityCorr}. 습도 50% 이하 유지 시 기존 수준 회복 예상.</div>
    </div>`;
  },

  /* ── 원재료 · 배합 ── */
  async materials() {
    const d = await api('/production/materials');
    return `
    <p class="section-note">수지명 · 컬러 · 촉매 · 합성일 · 배합일을 LOT와 연결해 관리합니다. 서버가 소비 속도와 리드타임을 계산해 <b>AI 발주 제안</b>을 생성합니다.</p>
    <div class="card"><h3>원재료 배합 현황 <span class="tag">LOT TRACEABILITY</span></h3>
      ${tbl(['수지명', '컬러', '촉매', '합성일', '배합일', '사용 LOT', '잔여 수량', '상태'],
        d.batches.map((b) => `<tr><td class="mono">${b.resin}</td><td>${b.color}</td><td class="mono">${b.catalyst}</td><td class="mono">${b.synthDate}</td><td class="mono">${b.mixDate}</td><td class="mono">${b.lots}</td><td class="mono t-right">${b.remainKg} kg</td><td>${pill(b.status)}</td></tr>`).join(''))}
    </div>
    <div class="card mt"><h3>원자재 재고 <span class="tag">안전재고 자동 비교</span></h3>
      ${tbl(['코드', '자재명', '현재고', '안전재고', '소진 예측', '공급처 (리드타임)', '판정', ''],
        d.raws.map((m) => `<tr${m.verdict === '부족' ? ' class="row-hl"' : ''}>
          <td class="mono">${m.code}</td><td>${esc(m.name)}${m.priceChange ? ` <span class="pill warn">단가 +${m.priceChange}%</span>` : ''}</td>
          <td class="mono t-right">${fmt(m.onHand)}${m.unit}</td><td class="mono t-right">${fmt(m.safety)}${m.unit}</td>
          <td class="mono">${m.depleteDays >= 99 ? '—' : 'D-' + m.depleteDays}</td><td>${esc(m.supplierName)} (${m.leadDays}일)</td><td>${pill(m.verdict)}</td>
          <td>${m.openPo ? `<span class="pill info">${m.openPo} ${m.openPoStatus}</span>` : m.verdict !== '정상' ? `<button class="btn sm" onclick="A.createPO('${m.code}')">발주서 생성</button>` : ''}</td></tr>`).join(''))}
    </div>
    <div class="card mt"><h3>AI 발주 제안 <span class="tag">PREDICTIVE · SERVER</span></h3>
      ${d.suggestions.length ? d.suggestions.map((s) => `<div class="feed-item"><div class="feed-ic blue">📦</div><div><div class="a-t">${esc(s.name)}</div><div class="a-d">${esc(s.msg)}</div><div class="a-src">AI 발주 제안 · 소비 추세 × 리드타임</div></div><button class="btn sm" style="margin-left:auto;flex:none" onclick="A.createPO('${s.code}')">발주</button></div>`).join('') : '<div class="muted">현재 발주가 필요한 원재료가 없습니다. (발주 진행 중 자재는 구매 발주 탭 참고)</div>'}
    </div>`;
  },

  /* ── 생산계획 ── */
  async plan() {
    const d = await api('/production/plan');
    const c = d.capacity;
    const pct = (a, b) => Math.round((a / b) * 100);
    return `
    <p class="section-note">가용인원 · 설비 · 품목별 생산량 · 셋업 시간을 반영해 <b>서버가 "오늘 실제로 만들 수 있는 양"을 산출</b>하고 우선순위를 자동 수립합니다. 도입 전 2시간 → 12분.</p>
    <div class="grid g2-13">
      <div class="card"><h3>오늘의 생산능력 <span class="tag">CAPACITY</span></h3>
        <div class="cap-row"><span class="cl">가용 인원</span><span class="cv">${c.people.avail} / ${c.people.total}명</span></div>
        <div class="meter"><i class="m-cob" style="width:${pct(c.people.avail, c.people.total)}%"></i></div>
        <div class="cap-row"><span class="cl">설비 가동</span><span class="cv">${c.machines.avail} / ${c.machines.total}대 (${c.machines.note})</span></div>
        <div class="meter"><i class="m-warn" style="width:${pct(c.machines.avail, c.machines.total)}%"></i></div>
        <div class="cap-row"><span class="cl">일 생산능력 사용률</span><span class="cv">${fmt(c.throughput.used)} / ${fmt(c.throughput.total)} EA환산</span></div>
        <div class="meter"><i class="m-ok" style="width:${pct(c.throughput.used, c.throughput.total)}%"></i></div>
        <div class="hint"><b>AI 반영 항목</b> — 인원 출근 현황, 설비 점검 일정, 품목별 시간당 생산량, 라인 전환(셋업) 시간, 수출 선적 ETD까지 계산합니다.</div>
      </div>
      <div class="card"><h3>AI 생산 우선순위 — 자동 수립 <span class="tag">SERVER SCHEDULER</span></h3>
        ${d.priorities.map((p) => `<div class="prio${p.urgent ? ' urgent' : ''}">
          <div class="p-rank">${p.rank}</div>
          <div style="flex:1"><div class="p-t">${esc(p.title)} <span class="pill ${p.urgent ? 'bad' : 'gray'}">${p.badge}</span></div>
          <div class="p-meta">${esc(p.meta)}</div><div class="p-why">${esc(p.why)}</div></div>
          ${p.woNo ? `<span class="pill ok">발행 ${p.woNo}</span>` : `<button class="btn sm primary" onclick="A.issuePlan(${p.rank})">작업지시 발행</button>`}
        </div>`).join('')}
      </div>
    </div>
    <div class="card mt"><h3>금일 일일 생산지시 <span class="tag">${(d.todayDirectives || []).length}건 · 생산지시 연동</span></h3>
      ${(d.todayDirectives || []).length ? tbl(['작업지시', '거래처', '품목', '지시 수량', '실적', '달성률', '라인', '상태', ''],
        d.todayDirectives.map((r) => {
          const rate = r.qty ? Math.round((r.actual / r.qty) * 100) : 0;
          return `<tr><td class="mono">${r.woNo}</td><td><b>${esc(r.customerName)}</b></td><td>${esc(r.itemName)}</td>
            <td class="mono t-right">${fmt(r.qty)}${r.unit}</td><td class="mono t-right">${fmt(r.actual)}</td>
            <td class="mono t-right"${rate >= 100 ? ' style="color:var(--ok);font-weight:700"' : ''}>${rate}%</td>
            <td>${r.machine}</td><td>${pill(r.status)}</td>
            <td>${!r.issued ? `<button class="btn sm primary" onclick="A.issueDaily('${r.woNo}','${r.date}')">지시 발행</button>` : '<span class="save-note" style="margin:0">✓ 발행됨</span>'}</td></tr>`;
        }).join('')) : '<div class="muted">오늘 예정된 일일 지시가 없습니다 — 작업지시·OEM 스펙 탭에서 생산지시를 발행하면 일일 분할이 자동 생성됩니다.</div>'}
      <div class="hint"><b>생산지시 → 일일 지시</b> — 생산지시(WO)를 발행하면 서버가 일일 생산능력 기준으로 자동 분할합니다. 공정일지 저장 시 해당 일자 실적이 자동 누적됩니다.</div>
    </div>
    <div class="card mt"><h3>주간 생산계획 보드 <span class="tag">AUTO RESCHEDULE</span></h3>
      <div class="week">${d.weekBoard.map((day) => `
        <div class="day${day.today ? ' today' : ''}"><div class="d-h"><span>${day.label}</span><span class="d-load">${day.load}%</span></div>
        ${day.jobs.map((j) => `<div class="job ${j.state}"><b>${esc(j.name)}</b><span class="j-qty">${esc(j.qty)}</span></div>`).join('')}</div>`).join('')}
      </div>
      <div class="hint"><b>최적화 로직</b> — 납기 임박 → 재고 부족 → 수출 ETD → 셋업 최소화(동일 품목 묶음) → 선행 생산 순으로 배치하고, 마지막 날은 긴급 수주 버퍼로 비워둡니다.</div>
    </div>`;
  },

  /* ── 작업자 ── */
  async workers() {
    const d = await api('/production/workers');
    return `
    <p class="section-note">생산자별 생산량과 생산실적을 조회하고, 모든 작업 이력을 LOT 단위로 추적합니다 (AUDIT TRAIL).</p>
    <div class="card"><h3>생산자별 실적 <span class="tag">TODAY · 서버 집계</span></h3>
      ${d.workers.map((w) => `<div class="bar-row"><span class="bname">${w.name}</span><div class="bar-track"><i style="width:${w.pct}%;background:linear-gradient(90deg,var(--ok),#3FB592)"></i></div><span class="bval">${fmt(w.qty)} EA</span></div>`).join('') || '<div class="muted">오늘 실적 없음</div>'}
    </div>
    <div class="card mt"><h3>작업 이력 추적 <span class="tag">AUDIT TRAIL</span></h3>
      ${tbl(['시각', '담당', '작업', '참조'], d.trail.map((a) => `<tr><td class="mono">${a.time.slice(5)}</td><td>${a.who}</td><td>${esc(a.action)}</td><td class="mono">${esc(a.ref)}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── 구매 발주 ── */
  async purchase() {
    const list = await api('/purchase/orders');
    const raws = M.masters.rawMaterials;
    const open = list.filter((p) => p.status !== '입고완료');
    return `
    <p class="section-note">AI 발주 제안(원재료 탭)과 연동된 구매 모듈입니다. 발주 → 운송 → <b>입고 처리 시 서버가 원자재 재고에 자동 반영</b>하고 창고 입출고 이력을 남깁니다.</p>
    <div class="grid g3">
      ${kpi('진행 중 발주', open.length, ' 건', '운송중·발주완료', 'flat')}
      ${kpi('이달 발주 금액', won(list.reduce((s, p) => s + p.amount, 0)), '', `${list.length}건 누적`, 'flat')}
      ${kpi('평균 리드타임', '4.2', ' 일', '공급처 5개사', 'good')}
    </div>
    <div class="card mt"><h3>신규 발주 <span class="tag">PURCHASE ORDER</span></h3>
      <div class="form-grid">
        <div class="field"><label>자재</label><select id="po-mat">${raws.map((m) => `<option value="${m.code}">${m.code} · ${esc(m.name)} (₩${fmt(m.unitCost)}/${m.unit})</option>`).join('')}</select></div>
        <div class="field"><label>수량 (비우면 안전재고 기준 자동 산정)</label><input class="mono-in" id="po-qty" placeholder="자동 산정"></div>
        <div class="field" style="display:flex;align-items:flex-end"><button class="btn primary" style="width:100%" onclick="A.createPOForm()">발주서 생성 · 송부</button></div>
      </div>
    </div>
    <div class="card mt"><h3>발주 현황 <span class="tag">${list.length}건</span></h3>
      ${tbl(['발주번호', '공급처', '자재', '수량', '단가', '금액', '발주일', '입고 예정', '상태', ''],
        list.map((p) => `<tr><td class="mono">${p.no}</td><td><b>${esc(p.supplierName)}</b></td><td>${esc(p.materialName)}</td>
          <td class="mono t-right">${fmt(p.qty)}${p.unit}</td><td class="mono t-right">₩${fmt(p.unitCost)}</td><td class="mono t-right">${won(p.amount)}</td>
          <td class="mono">${p.orderDate.slice(5)}</td><td class="mono">${p.dueDate.slice(5)}${p.receivedAt ? `<div class="muted mono">입고 ${p.receivedAt.slice(5)}</div>` : ''}</td>
          <td>${pill(p.status)}</td><td>${p.status !== '입고완료' ? `<button class="btn sm" onclick="A.receivePO('${p.no}')">입고 처리</button>` : ''}</td></tr>`).join(''))}
      ${list.some((p) => p.note) ? `<div class="hint"><b>리스크</b> — ${list.filter((p) => p.note).map((p) => `${p.no}: ${p.note}`).join(' · ')}</div>` : ''}
    </div>`;
  },

  /* ── 공급처 ── */
  async suppliers() {
    const list = await api('/purchase/suppliers');
    return `
    <p class="section-note">의료용 자재 공급처 마스터 — 생체적합성(ISO 10993)·USP Class VI 등급 자재 공급처를 평가 등급과 함께 관리합니다.</p>
    <div class="card"><h3>공급처 마스터 <span class="tag">${list.length}개사</span></h3>
      ${tbl(['코드', '공급처', '공급 품목', '리드타임', '담당', '평가', '진행 발주', '비고'],
        list.map((s) => `<tr><td class="mono">${s.code}</td><td><b>${esc(s.name)}</b></td><td>${esc(s.items)}</td><td class="mono">${s.leadDays}일</td><td>${esc(s.contact)}</td><td>${gchip(s.rating)}</td><td class="mono t-center">${s.openPos} / ${s.totalPos}</td><td class="muted">${esc(s.note) || '—'}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── 재고 현황 ── */
  async stock() {
    const d = await api('/stock');
    return `
    <p class="section-note"><b>가용재고 = 현재고 − 수주잔량.</b> 창고에 물건이 있어 보여도 이미 팔린 물량을 빼면 마이너스인 경우가 "재고 펑크"의 원인입니다. 이 판정은 수주 접수 즉시 서버에서 자동 갱신됩니다.</p>
    <div class="grid g3">
      ${kpi('관리 품목', d.summary.skus, ' SKU', '완제품 + 원자재 · 안전재고 전수 설정', 'flat')}
      ${kpi('안전재고 미달', d.summary.short, ' 품목', '수주잔량 반영 기준', d.summary.short ? 'bad' : 'good')}
      ${kpi('7일 내 소진 예측', d.summary.deplete7, ' 품목', 'AI 출고 추세 분석', 'warn')}
    </div>
    <div class="card mt">
      <h3>완제품 — 현재고 × 안전재고 자동 비교 <span class="tag">REAL-TIME</span></h3>
      <div class="ftabs" style="align-items:center">
        <button class="ftab active" onclick="A.filterStock(this,'all')">전체 <span class="c">${d.finished.length}</span></button>
        <button class="ftab" onclick="A.filterStock(this,'부족')">부족 <span class="c">${d.finished.filter((s) => s.verdict === '부족').length}</span></button>
        <button class="ftab" onclick="A.filterStock(this,'주의')">주의 <span class="c">${d.finished.filter((s) => s.verdict === '주의').length}</span></button>
        <button class="ftab" onclick="A.filterStock(this,'정상')">정상 <span class="c">${d.finished.filter((s) => s.verdict === '정상').length}</span></button>
        <span style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--steel);font-weight:600">안전재고 마진 일괄
          <input class="mg-in" id="bulk-margin" placeholder="%" value="">
          <button class="btn sm" onclick="A.setMarginAll()">전체 적용</button>
        </span>
      </div>
      <div class="tbl-wrap"><table><thead><tr><th>품목코드</th><th>품목명</th><th class="t-right">현재고</th><th class="t-right">수주잔량</th><th class="t-right">가용재고</th><th class="t-right">기본 안전재고</th><th>마진 %</th><th class="t-right">적용 안전재고</th><th>판정</th><th>소진 예측</th></tr></thead>
      <tbody id="stock-body">${d.finished.map((s) => `<tr data-st="${s.verdict}"${s.verdict === '부족' ? ' class="row-hl"' : ''}>
        <td class="mono">${s.code}</td><td><b>${esc(s.name)}</b></td>
        <td class="mono t-right">${fmt(s.onHand)}${s.unit}</td><td class="mono t-right">−${fmt(s.open)}${s.unit}</td>
        <td class="mono t-right"${s.avail < 0 ? ' style="color:var(--bad);font-weight:700"' : ''}>${fmt(s.avail)}${s.unit}</td>
        <td class="mono t-right">${fmt(s.safetyBase)}${s.unit}</td>
        <td><input class="mg-in" value="${s.safetyMargin}" onchange="A.setMargin('${s.code}',this.value)">%</td>
        <td class="mono t-right"><b>${fmt(s.safety)}</b>${s.unit}</td><td>${pill(s.verdict)}</td>
        <td class="mono">${s.depleteDays >= 99 ? '—' : s.depleteDate.slice(5) + ' (D-' + s.depleteDays + ')'}</td></tr>`).join('')}</tbody></table></div>
      <div class="hint"><b>안전재고 마진</b> — 적용 안전재고 = 기본 안전재고 × (1 + 마진%). 마진을 바꾸면 서버가 즉시 가용재고 판정·소진 예측·AI 발주 제안까지 재계산합니다.</div>
    </div>
    <div class="card mt"><h3>원자재 재고 <span class="tag">구매 연동 · 마진 설정</span></h3>
      ${tbl(['코드', '자재명', '현재고', '기본 안전재고', '마진 %', '적용 안전재고', '판정', '발주 상태'],
        d.raws.map((m) => `<tr><td class="mono">${m.code}</td><td>${esc(m.name)}</td><td class="mono t-right">${fmt(m.onHand)}${m.unit}</td><td class="mono t-right">${fmt(m.safetyBase)}${m.unit}</td>
        <td><input class="mg-in" value="${m.safetyMargin}" onchange="A.setMargin('${m.code}',this.value)">%</td>
        <td class="mono t-right"><b>${fmt(m.safety)}</b>${m.unit}</td><td>${pill(m.verdict)}</td><td>${m.openPo ? `<span class="pill info">${m.openPo} ${m.openPoStatus}</span>` : '<span class="muted">—</span>'}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── 창고 · 입출고 ── */
  async warehouse() {
    const d = await api('/logistics/movements');
    return `
    <p class="section-note">구매 입고 · 생산입고 · 출고 · 재고실사 조정이 모두 서버 트랜잭션으로 기록되어 <b>창고별 점유율과 입출고 이력</b>이 실시간 갱신됩니다.</p>
    <div class="grid g4">
      ${d.zones.map((z) => `<div class="card"><div class="cap-row"><span class="cl">${z.id} · ${z.name}</span><span class="cv">${z.usage}%</span></div><div class="meter"><i class="${z.usage > 70 ? 'm-warn' : 'm-med'}" style="width:${z.usage}%"></i></div><div class="muted">${esc(z.note)}</div></div>`).join('')}
    </div>
    <div class="card mt"><h3>입출고 이력 <span class="tag">MOVEMENTS · 서버 트랜잭션</span></h3>
      ${tbl(['시각', '유형', '코드', '품명', '수량', '참조', '구역'],
        d.movements.map((m) => `<tr><td class="mono">${m.time.slice(5)}</td><td>${pill(m.type, m.type === '입고' || m.type === '생산입고' ? 'ok' : m.type === '출고' ? 'info' : 'warn')}</td><td class="mono">${m.code}</td><td>${esc(m.name)}</td><td class="mono">${m.qty}</td><td class="mono">${esc(m.ref)}</td><td>${m.zone}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── 출고 관리 ── */
  async shipping() {
    const d = await api('/shipping');
    const NEXT = { '피킹': '상차 처리', '상차': '출고 확정', '보세창고 이동': '출고 확정' };
    return `
    <p class="section-note"><b>출고 확정 = 명세서 트리거.</b> 출고 확정 순간 서버가 재고 차감 → 거래명세서 자동 작성 → 배송 추적 시작까지 한 번에 처리합니다.</p>
    <div class="grid g3">
      ${kpi('금일 출고 보드', d.kpi.today, ' 건', '차량 2회전 + 택배 + 수출 연계', 'flat')}
      ${kpi('출고 완료', d.kpi.done, ' 건', '명세서 자동 발행 연동', 'good')}
      ${kpi('출고 대기', d.kpi.pending, ' 건', '피킹·상차·생산 진행 포함', 'warn')}
    </div>
    <div class="card mt"><h3>금일 출고 보드 <span class="tag">SHIP BOARD</span></h3>
      ${tbl(['수주번호', '거래처', '품목', '수량', '운송', '출고 상태', '거래명세서', ''],
        d.board.map((s) => `<tr${s.blocked ? ' class="row-hl"' : ''}>
          <td class="mono">${s.orderNo}</td><td><b>${esc(s.customerName)}</b></td><td>${esc(s.itemName)}</td><td class="mono t-right">${fmt(s.qty)}${s.unit}</td>
          <td>${s.transport}${s.exportId ? ` <span class="pill med">수출 ${s.exportId}</span>` : ''}</td>
          <td>${pill(s.status)}${s.time ? `<span class="mono muted" style="margin-left:5px">${s.time}</span>` : ''}</td>
          <td>${s.invoiceNo ? `<span class="pill ok">자동생성 ${s.invoiceNo}</span>` : s.exportId ? '<span class="pill med">C/I 연계</span>' : s.blocked ? '<span class="pill gray">생산 완료 시 자동생성</span>' : '<span class="pill warn">출고 확정 시 생성</span>'}</td>
          <td>${!s.blocked && NEXT[s.status] ? `<button class="btn sm${NEXT[s.status] === '출고 확정' ? ' primary' : ''}" onclick="A.advShip('${s.id}')">${NEXT[s.status]}</button>` : ''}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── 배송 추적 ── */
  async delivery() {
    const d = await api('/delivery');
    return `
    <p class="section-note">자사 차량 · 택배 · 수출 연계 배송을 단계별로 추적합니다. 상태 갱신은 서버 트랜잭션으로 기록됩니다.</p>
    <div class="grid g3">
      ${kpi('배달 완료', d.kpi.done, ' 건', '금일 기준', 'good')}
      ${kpi('배송 중', d.kpi.moving, ' 건', '실시간 추적', 'flat')}
      ${kpi('출고 대기', d.kpi.waiting, ' 건', '출고 확정 시 자동 시작', 'warn')}
    </div>
    <div class="grid g2 mt">
      ${d.list.map((x) => `<div class="card">
        <h3>${esc(x.customerName)} <span class="tag">${x.carrier} · ${x.tno}</span></h3>
        <div class="muted">참조 ${x.ref} · 도착지 ${esc(x.dest)} · ETA ${x.eta}</div>
        <div class="track">${x.steps.map((st, i) => `<div class="tstep${i < x.stepIndex ? ' done' : i === x.stepIndex ? ' cur' : ''}"><div class="t-dot"></div><div class="t-lb">${st}</div><div class="t-tm">${x.times && x.times[i] ? String(x.times[i]).slice(-5) : ''}</div></div>`).join('')}</div>
        ${x.stepIndex < x.steps.length - 1 ? `<div class="submit-bar"><button class="btn sm" onclick="A.advDelivery('${x.id}')">다음 단계 → ${x.steps[x.stepIndex + 1]}</button></div>` : '<div class="save-note" style="margin-top:8px">✓ 배달 완료</div>'}
      </div>`).join('')}
    </div>`;
  },

  /* ── 수출 선적 ── */
  async export() {
    const d = await api('/export');
    const active = d.list.find((e) => e.stepIndex < e.steps.length - 1);
    return `
    <p class="section-note">수출 선적 — Commercial Invoice · Packing List · B/L · HS코드 · 인코텀즈를 선적 단위로 관리하고, <b>통관 단계가 생산계획·출고와 연동</b>됩니다.</p>
    <div class="grid g3">
      ${kpi('진행 중 선적', d.kpi.active, ' 건', '서류·통관·운송 추적', 'flat')}
      ${kpi('수출 금액 (진행분)', '$' + fmt(d.kpi.monthUsd), '', '영세율 매출 자동 집계', 'good')}
      ${kpi('다음 ETD', d.kpi.nextEtd ? d.kpi.nextEtd.etd.slice(5) : '—', '', d.kpi.nextEtd ? `${d.kpi.nextEtd.customerName} · ${d.kpi.nextEtd.portFrom}` : '', 'warn')}
    </div>
    <div class="grid g2 mt">
      <div>
      ${d.list.map((e) => `<div class="card" style="margin-bottom:14px">
        <h3>${e.id} · ${esc(e.customerName)} <span class="tag">${e.mode} · ${e.incoterms}</span></h3>
        <div class="muted">${e.portFrom} → ${e.portTo} (${e.country}) · ${e.carrier} · ETD ${e.etd} / ETA ${e.eta}</div>
        <div class="track">${e.steps.map((st, i) => `<div class="tstep${i < e.stepIndex ? ' done' : i === e.stepIndex ? ' cur' : ''}"><div class="t-dot"></div><div class="t-lb">${st}</div></div>`).join('')}</div>
        ${tbl(['품목', '수량', '단가(USD)', '금액(USD)'], e.itemsView.map((x) => `<tr><td>${esc(x.name)}</td><td class="mono t-right">${fmt(x.qty)}${x.unit}</td><td class="mono t-right">$${x.priceUsd}</td><td class="mono t-right">$${fmt(x.amountUsd)}</td></tr>`).join(''))}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          <span class="pill info">C/I ${e.ciNo}</span><span class="pill info">P/L ${e.plNo}</span><span class="pill ${e.blNo === '발급 예정' ? 'gray' : 'med'}">B/L ${e.blNo}</span><span class="pill gray">HS ${e.hsCode}</span>
        </div>
        <div class="muted" style="margin-top:7px">${esc(e.note)}</div>
        ${e.stepIndex < e.steps.length - 1 ? `<div class="submit-bar"><button class="btn sm primary" onclick="A.advExport('${e.id}')">다음 단계 → ${e.steps[e.stepIndex + 1]}</button></div>` : '<div class="save-note" style="margin-top:8px">✓ 인도 완료</div>'}
      </div>`).join('')}
      </div>
      <div>${active ? `<div class="card"><h3>Commercial Invoice 미리보기 <span class="tag">AUTO</span></h3>
        <div class="doc">
          <div class="doc-title">COMMERCIAL INVOICE</div>
          <div class="doc-meta"><div><b>Shipper</b> BL-tech Co., Ltd.<br>ISO 13485 · GMP Certified</div>
          <div style="text-align:right"><b>Invoice No.</b> <span class="mono">${active.ciNo}</span><br><b>Incoterms</b> ${active.incoterms}</div></div>
          <div class="doc-meta"><div><b>Consignee</b> ${esc(active.customerName)}<br>${active.portTo}, ${active.country}</div>
          <div style="text-align:right"><b>ETD</b> ${active.etd}<br><b>HS Code</b> ${active.hsCode}</div></div>
          <table><thead><tr><th>Description</th><th>Q'ty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>
            ${active.itemsView.map((x) => `<tr><td>${esc(x.name)}</td><td class="mono t-center">${fmt(x.qty)}</td><td class="mono t-right">$${x.priceUsd}</td><td class="mono t-right">$${fmt(x.amountUsd)}</td></tr>`).join('')}
            <tr class="doc-sum"><td colspan="3" class="t-right">TOTAL (${active.currency})</td><td class="mono t-right">$${fmt(active.totalUsd)}</td></tr>
            <tr class="doc-sum"><td colspan="3" class="t-right">원화 환산 (₩${fmt(active.fx)}/$)</td><td class="mono t-right">${won(Math.round(active.totalUsd * active.fx))}</td></tr>
          </tbody></table>
          <div class="doc-stamp"><span class="auto-tag">AUTO-FILLED · 수출 마스터 × 단가 데이터</span><span class="muted">BL-tech (인)</span></div>
        </div>
        <div class="hint"><b>영세율 연계</b> — 수출 매출은 부가세 0%로 매출 원장에 자동 집계되고, 미수금은 T/T 입금 등록 시 자동 차감됩니다.</div>
      </div>` : ''}</div>
    </div>`;
  },

  /* ── 원가 관리 ── */
  async cost() {
    const d = await api('/cost');
    return `
    <p class="section-note">BOM(원재료 소요량) × 자재 단가 + 노무비 + 제조경비로 <b>품목별 원가를 서버가 자동 계산</b>합니다. 자재 단가가 바뀌면 전 품목 원가·마진이 즉시 재계산됩니다.</p>
    <div class="grid g3">
      ${kpi('평균 마진율', d.avgMargin, ' %', '기준단가 대비', d.avgMargin >= 30 ? 'good' : 'warn')}
      ${kpi('단가 개정 검토', d.alert.impacted.length, ' 건', `${d.alert.material} ${d.alert.change}`, 'warn')}
      ${kpi('원가 산정 품목', d.rows.length, ' 품목', 'BOM 전수 등록', 'good')}
    </div>
    <div class="card mt"><h3>품목별 원가 구성 <span class="tag">BOM COSTING · SERVER</span></h3>
      ${tbl(['품목', '재료비', '노무비', '제조경비', '총원가', '기준단가', '마진율', '주요 자재'],
        d.rows.map((x) => `<tr><td><b>${esc(x.name)}</b><div class="mono muted">${x.code}</div></td>
          <td class="mono t-right">₩${fmt(x.matCost)}</td><td class="mono t-right">₩${fmt(x.labor)}</td><td class="mono t-right">₩${fmt(x.oh)}</td>
          <td class="mono t-right"><b>₩${fmt(x.total)}</b></td><td class="mono t-right">₩${fmt(x.price)}</td>
          <td class="t-right">${pill(x.margin + '%', x.margin >= 30 ? 'ok' : x.margin >= 18 ? 'warn' : 'bad')}</td>
          <td class="muted" style="font-size:11px">${x.mats.slice(0, 2).map((m) => `${esc(m.name)} ₩${fmt(m.cost)}`).join(' · ')}</td></tr>`).join(''))}
    </div>
    <div class="card mt"><h3>원자재 단가 변동 영향 <span class="tag">COST ALERT</span></h3>
      <div class="feed-item"><div class="feed-ic warn">📈</div><div><div class="a-t">${d.alert.material} 단가 ${d.alert.change} 인상</div><div class="a-d">${esc(d.alert.note)}</div>
      <div class="a-d" style="margin-top:5px">${d.alert.impacted.map((i) => `<b>${esc(i.name)}</b> 원가 +₩${i.delta}`).join(' · ')}</div>
      <div class="a-src">BOM 원가 자동 재계산 · 거래처 단가 개정 검토 대상</div></div></div>
    </div>`;
  },

  /* ── 거래명세서 ── */
  async invoices() {
    const d = await api('/invoices');
    const pv = d.pending[0];
    return `
    <p class="section-note">출고 확정 시 서버가 거래명세서를 자동 작성해 발행 큐에 올립니다. <b>발행 승인 → 매출 원장 자동 반영 → 2단계(매출·입금·미수금)의 시작점</b>이 됩니다.</p>
    <div class="grid g2">
      <div>
        <div class="card"><h3>발행 대기 큐 <span class="tag">${d.pending.length}건</span></h3>
          ${tbl(['번호', '거래처', '구분', '합계금액', '생성 방식', ''],
            d.pending.map((v) => `<tr><td class="mono">${v.no}</td><td><b>${esc(v.customerName)}</b></td><td>${pill(v.type, v.type.includes('수출') ? 'med' : 'gray')}</td><td class="mono t-right">${won(v.total)}</td><td><span class="pill info">${esc(v.source)}</span></td>
            <td><button class="btn sm primary" onclick="A.issueInv('${v.no}')">발행</button></td></tr>`).join(''))}
        </div>
        <div class="card mt"><h3>발행 완료 <span class="tag">매출 원장 반영</span></h3>
          ${tbl(['번호', '거래처', '구분', '공급가', 'VAT', '합계', '발행'],
            d.issued.slice(0, 8).map((v) => `<tr><td class="mono">${v.no}</td><td>${esc(v.customerName)}</td><td>${pill(v.type, v.type.includes('수출') ? 'med' : 'gray')}</td><td class="mono t-right">${fmt(v.supply)}</td><td class="mono t-right">${fmt(v.vat)}</td><td class="mono t-right"><b>${fmt(v.total)}</b></td><td class="mono">${(v.issuedAt || '').slice(5, 16)}</td></tr>`).join(''))}
        </div>
        <div class="card mt"><h3>자동입력 필요 데이터 — 매핑 상태</h3>
          <div class="chk done"><div class="c-box">✓</div>거래처명 마스터 <span class="c-sub">10개사 · 별칭 매핑</span></div>
          <div class="chk done"><div class="c-box">✓</div>품목코드 체계 <span class="c-sub">10 SKU + 원자재 10</span></div>
          <div class="chk done"><div class="c-box">✓</div>거래처별 단가표 (A+/A/B/C) <span class="c-sub">서버 자동 적용</span></div>
          <div class="chk done"><div class="c-box">✓</div>수출 영세율 구분 <span class="c-sub">국가 기준 자동</span></div>
          <div class="chk todo"><div class="c-box"></div>외부 ERP API 인증키 <span class="c-sub">벤더 회신 대기 — 현재 RPA</span></div>
        </div>
      </div>
      <div>${pv ? `<div class="card"><h3>발행 미리보기 — ${esc(pv.customerName)} <span class="tag">AUTO</span></h3>
        <div class="doc">
          <div class="doc-title">거래명세서</div>
          <div class="doc-meta"><div><b>공급받는자</b> ${esc(pv.customerName)}<br>거래처코드 ${pv.customerCode}</div>
          <div style="text-align:right"><b>발행번호</b> <span class="mono">${pv.no}</span><br><b>구분</b> ${pv.type}</div></div>
          <table><thead><tr><th>품목코드</th><th>품목명</th><th>수량</th><th>단가</th><th>공급가액</th></tr></thead><tbody>
            ${pv.itemsView.map((x) => `<tr><td class="mono t-center">${x.code}</td><td>${esc(x.name)}</td><td class="mono t-center">${fmt(x.qty)} ${x.unit}</td><td class="mono t-right">₩${fmt(x.price)}</td><td class="mono t-right">₩${fmt(x.supply)}</td></tr>`).join('')}
            <tr class="doc-sum"><td colspan="4" class="t-right">부가세${pv.type.includes('수출') ? ' (영세율)' : ''}</td><td class="mono t-right">₩${fmt(pv.vat)}</td></tr>
            <tr class="doc-sum"><td colspan="4" class="t-right">합계금액</td><td class="mono t-right">₩${fmt(pv.total)}</td></tr>
          </tbody></table>
          <div class="doc-stamp"><span class="auto-tag">AUTO-FILLED · ${esc(pv.source)}</span><span class="muted">공급자 비엘테크 (인)</span></div>
        </div>
        <div class="submit-bar"><button class="btn primary" onclick="A.issueInv('${pv.no}')">이 명세서 발행 → 매출 반영</button></div>
      </div>` : '<div class="card"><div class="empty">발행 대기 중인 명세서가 없습니다.<br>출고 관리에서 출고 확정 시 자동 생성됩니다.</div></div>'}
      <div class="card mt"><h3>ERP 연계 방식</h3>
        <div class="grid g2" style="gap:10px">
          <div style="border:1.5px solid var(--line);border-radius:12px;padding:13px"><b>API 연동</b><div class="muted" style="margin:4px 0 8px">외부 ERP가 API 제공 시</div><div class="muted">· 실시간 무인 입력<br>· 오류율 0%<br>· 인증키 발급 대기</div></div>
          <div style="border:1.5px solid var(--med);border-radius:12px;padding:13px;background:#FBFFFE"><b>웹 자동입력 (RPA)</b> <span class="pill med">현재 운영</span><div class="muted" style="margin:4px 0 8px">화면 자동 입력</div><div class="muted">· 입력 1건당 11초<br>· 야간 일괄처리<br>· API 개통 시 무중단 전환</div></div>
        </div>
      </div></div>
    </div>`;
  },

  /* ── 매출 · 미수금 ── */
  async receivables() {
    const d = await api('/finance/receivables');
    return `
    <p class="section-note">거래명세서 → 매출 → 입금 → 미수금 → 채권관리 (2단계). <b>입금 등록 시 서버가 미수금을 자동 재계산</b>하고, 리스크(장기채권·클레임·Follow-up 지연)를 결합해 회수 우선순위를 제안합니다.</p>
    <div class="grid g4">
      ${kpi('매출 누계', wonShort(d.totalSales), '', '대시보드와 동일 집계 (단일 원장)', 'good')}
      ${kpi('총 미수금', wonShort(d.totalRecv), '', '실시간 재계산', d.totalRecv ? 'bad' : 'good')}
      ${kpi('회수율', d.collectRate, ' %', '입금 ÷ 매출', d.collectRate >= 85 ? 'good' : 'warn')}
      ${kpi('회수 우선 대상', d.priorities.length, ' 개사', 'AI 리스크 결합', 'warn')}
    </div>
    <div class="grid g2-13 mt">
      <div class="card"><h3>AI 회수 우선순위 <span class="tag">RISK ENGINE</span></h3>
        ${d.priorities.map((p) => `<div class="prio${p.rank === 1 ? ' urgent' : ''}"><div class="p-rank">${p.rank}</div>
          <div style="flex:1"><div class="p-t">${esc(p.name)} · <span class="mono">${won(p.recv)}</span></div><div class="p-why">${esc(p.why)}</div></div></div>`).join('')}
        <h3 style="margin:14px 0 8px">최근 입금</h3>
        ${tbl(['일자', '거래처', '금액', '방식'], d.recentPayments.map((p) => `<tr><td class="mono">${p.date.slice(5)}</td><td>${esc(p.customerName)}</td><td class="mono t-right">${won(p.amount)}</td><td>${p.method}</td></tr>`).join(''))}
      </div>
      <div class="card"><h3>거래처별 매출 · 입금 · 미수금 <span class="tag">LEDGER</span></h3>
        ${tbl(['거래처', '등급', '매출', '입금', '미수금', '회수율', '리스크', ''],
          d.rows.map((x) => `<tr><td><b>${esc(x.name)}</b><span class="muted" style="margin-left:5px">${x.country}</span></td><td>${gchip(x.grade)}</td>
            <td class="mono t-right">${fmt(x.sales)}</td><td class="mono t-right">${fmt(x.paid)}</td>
            <td class="mono t-right${x.recv > 0 ? ' warn-t' : ''}"><b>${fmt(x.recv)}</b></td>
            <td class="mono t-right">${x.collectRate}%</td>
            <td style="font-size:11px;color:var(--steel)">${x.risks.length ? x.risks.map(esc).join('<br>') : '—'}</td>
            <td>${x.recv > 0 ? `<button class="btn sm" onclick="A.pay('${x.code}','${esc(x.name)}',${x.recv})">입금 등록</button>` : ''}</td></tr>`).join(''))}
      </div>
    </div>`;
  },

  /* ── 품목 · 단가 마스터 ── */
  async items() {
    const list = await api('/items');
    return `
    <p class="section-note"><b>이 표가 자동화의 심장입니다.</b> 품목코드 · 단가등급별 단가(A+/A/B/C) · 안전재고 — 여기 한 곳만 바꾸면 수주 단가 적용 → 명세서 발행 → 원가·마진 계산 전체에 반영됩니다.</p>
    <div class="card"><h3>품목 마스터 · 단가등급표 <span class="tag">MASTER · ${list.length} SKU</span></h3>
      ${tbl(['코드', '품목명', '단위', 'A+ 단가', 'A 단가', 'B 단가', 'C 단가', '안전재고 (기본·마진→적용)', '현재고', '생산 라인'],
        list.map((i) => `<tr><td class="mono">${i.code}</td><td><b>${esc(i.name)}</b></td><td>${i.unit}</td>
          ${['A+', 'A', 'B', 'C'].map((g) => `<td class="mono t-right">₩${fmt(i.gradePrices[g])}</td>`).join('')}
          <td class="mono t-right">${fmt(i.stock.safetyBase)} · ${i.stock.safetyMargin}% → <b>${fmt(i.stock.safety)}</b></td><td class="mono t-right${i.stock.verdict === '부족' ? ' warn-t' : ''}">${fmt(i.onHand)}</td><td>${i.line}</td></tr>`).join(''))}
      <div class="hint"><b>단가등급</b> — 거래처 마스터의 등급(A+/A/B/C)에 따라 수주 시 서버가 자동으로 해당 단가를 적용합니다. 같은 품목이라도 거래처마다 단가가 다른 이유입니다.</div>
    </div>`;
  },

  /* ── 사원 · 조직 ── */
  async employees() {
    const list = await api('/employees');
    return `
    <p class="section-note">부서 · 역할 · 오늘의 활동(공정일지 입력 / 미결 Follow-up)을 함께 보여주는 조직 마스터입니다.</p>
    <div class="card"><h3>사원 · 조직 <span class="tag">${list.length}명</span></h3>
      ${tbl(['사번', '이름', '부서', '역할', '오늘 공정일지', '미결 Follow-up'],
        list.map((e) => `<tr><td class="mono">${e.code}</td><td><b>${e.name}</b></td><td>${e.dept}</td><td>${e.role}</td><td class="mono t-center">${e.todayLogs || '—'}</td><td class="mono t-center">${e.openFollowUps || '—'}</td></tr>`).join(''))}
    </div>`;
  },

  /* ── AI 통합 비서 ── */
  async ai() {
    return `
    <p class="section-note">질문하면 서버가 수주·생산·재고·품질·수출·채권 데이터를 직접 조회해 답합니다. ${M.meta.aiEngine === 'Claude API 연동' ? '<b>Claude API 연동 중</b>' : 'ANTHROPIC_API_KEY 설정 시 Claude가 답변을 보강합니다.'}</p>
    <div class="card"><h3>AI 통합 비서 <span class="tag">NATURAL LANGUAGE · ${M.meta.aiEngine}</span></h3>
      <div class="chat" id="chat">${S.chat.map((m) => m.html).join('') || '<div class="empty">무엇이든 물어보세요 — 서버 데이터 기반으로 답합니다.</div>'}</div>
      <div class="quick">
        <button onclick="A.ask(this.textContent)">오늘 생산량은?</button>
        <button onclick="A.ask(this.textContent)">재고 부족 품목 알려줘</button>
        <button onclick="A.ask(this.textContent)">미수금 현황은?</button>
        <button onclick="A.ask(this.textContent)">납기 위험 수주는?</button>
        <button onclick="A.ask(this.textContent)">수출 선적 진행 상황</button>
        <button onclick="A.ask(this.textContent)">발주 필요한 원재료는?</button>
        <button onclick="A.ask(this.textContent)">바움바이오 작년 스펙 알려줘</button>
      </div>
      <div class="chat-input">
        <input id="ai-q" placeholder="수주·생산·재고·품질·수출·채권에 대해 무엇이든 물어보세요…" onkeydown="if(event.key==='Enter')A.ask(this.value)">
        <button class="btn primary" onclick="A.ask(document.getElementById('ai-q').value)">질문</button>
      </div>
    </div>`;
  },
};

/* ═══════════ 액션 핸들러 (전부 서버 API 호출) ═══════════ */
const A = {
  nav(view) { S.view = view; location.hash = view; render(); },

  async _do(p, body, after) {
    try { const r = await api(p, body || {}); toast(r.msg || '처리 완료'); refreshBadges(); if (after !== false) render(); return r; }
    catch (e) { toast(e.message, true); }
  },

  /* 수주 */
  async uploadSample() { try { const r = await api('/orders/upload', {}); S.lastUpload = r; toast(`수주 ${r.summary.total}건 서버 자동분석 완료 — 단가 매칭 · 재고 비교`); refreshBadges(); render(); } catch (e) { toast(e.message, true); } },
  uploadCsv(input) {
    const f = input.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => { try { const r = await api('/orders/upload', { csv: rd.result }); S.lastUpload = r; toast(`${f.name} 분석 완료 — ${r.summary.total}건 등록, 확인 필요 ${r.summary.errors}건`); refreshBadges(); render(); } catch (e) { toast(e.message, true); } };
    rd.readAsText(f);
  },
  assign(no) { this._do(`/orders/${no}/assign`); },

  /* 거래처 */
  selCust(code) { S.custSel = code; render(); },
  filterCust(q) { document.querySelectorAll('[data-cname]').forEach((tr) => { tr.style.display = tr.dataset.cname.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'; }); },
  async brief(code) {
    $('#briefBox').innerHTML = aiBox('briefAi');
    try { const r = await api('/ai/brief', { customerCode: code }); showAi('briefAi', r); } catch (e) { toast(e.message, true); }
  },
  async runProposal() {
    $('#pp-out').innerHTML = aiBox('ppAi');
    try { const r = await api('/ai/proposal', { customerCode: $('#pp-cust').value, item: $('#pp-item').value, goal: $('#pp-goal').value }); showAi('ppAi', r); } catch (e) { toast(e.message, true); }
  },
  async runMarket() {
    $('#mk-out').innerHTML = aiBox('mkAi');
    try { const r = await api('/ai/market', { topic: $('#mk-q').value }); showAi('mkAi', r); } catch (e) { toast(e.message, true); }
  },
  async fuMail(id, code) {
    $('#fu-mail-' + id).innerHTML = aiBox('fuAi-' + id);
    try { const r = await api('/ai/email', { customerCode: code }); showAi('fuAi-' + id, r); } catch (e) { toast(e.message, true); }
  },
  fuDone(id) { this._do(`/sales/followups/${id}/done`); },

  /* 생산 */
  issueWo(no) { this._do(`/production/workorders/${no}/issue`); },
  selWo(no) { S.woSel = no; render(); },
  issueDaily(no, date) { this._do(`/production/workorders/${no}/daily/${date}/issue`); },
  issuePlan(rank) { this._do(`/production/plan/${rank}/issue`); },
  startLog(woNo, itemCode) { S.worklogPrefill = { woNo, itemCode }; this.nav('worklog'); },
  syncSensor() {
    const name = $('#wl-machine').value;
    const m = (M.masters.machines || []).find((x) => x.name === name) || {};
    $('#wl-temp').value = (m.sealTemp || 0) + ' ℃';
    $('#wl-room').value = `${m.roomTemp || '-'}℃ / ${m.humidity || '-'}%`;
  },
  segSel(btn, val) { S.bubble = val; btn.parentElement.querySelectorAll('button').forEach((b) => b.classList.remove('on')); btn.classList.add('on'); },
  async saveLog() {
    const body = {
      woNo: $('#wl-wo').value || null, worker: $('#wl-worker').value, machine: $('#wl-machine').value,
      itemCode: $('#wl-item').value, qty: $('#wl-qty').value, remain: $('#wl-remain').value, coating: $('#wl-coating').value,
      weight: $('#wl-weight').value, resin: $('#wl-resin').value, catalyst: $('#wl-cat').value, mixDate: $('#wl-mix').value, bubbleTest: S.bubble,
    };
    try {
      const r = await api('/production/worklogs', body);
      toast(r.msg + (r.anomalies.length ? ` — ${r.anomalies[0]}` : ''), r.verdict === '기준 이탈');
      refreshBadges(); render();
    } catch (e) { toast(e.message, true); }
  },

  /* 구매 · 물류 · 유통 */
  createPO(code) { this._do('/purchase/orders', { materialCode: code }); },
  createPOForm() { this._do('/purchase/orders', { materialCode: $('#po-mat').value, qty: $('#po-qty').value || undefined }); },
  receivePO(no) { this._do(`/purchase/orders/${no}/receive`); },
  setMargin(code, v) { this._do(`/stock/${code}/safety`, { margin: v }); },
  setMarginAll() { const v = $('#bulk-margin').value; if (!String(v).trim()) return toast('마진(%)을 입력하세요', true); this._do('/stock/margin-all', { margin: v }); },
  filterStock(tab, st) {
    document.querySelectorAll('.ftab').forEach((t) => t.classList.remove('active')); tab.classList.add('active');
    document.querySelectorAll('#stock-body tr').forEach((r2) => { r2.style.display = st === 'all' || r2.dataset.st === st ? '' : 'none'; });
  },
  advShip(id) { this._do(`/shipping/${id}/advance`); },
  advDelivery(id) { this._do(`/delivery/${id}/advance`); },
  advExport(id) { this._do(`/export/${id}/advance`); },

  /* 회계 */
  issueInv(no) { this._do(`/invoices/${no}/issue`); },
  pay(code, name, recv) {
    const amt = prompt(`${name} 입금액을 입력하세요 (현재 미수금 ₩${fmt(recv)})`, recv);
    if (amt == null || !String(amt).trim()) return;
    this._do('/finance/payments', { customerCode: code, amount: amt });
  },

  /* AI */
  async ask(q) {
    q = (q || '').trim(); if (!q) return;
    const inp = $('#ai-q'); if (inp) inp.value = '';
    const chat = $('#chat');
    if (S.chat.length === 0) chat.innerHTML = '';
    const uHtml = `<div class="msg user">${esc(q)}</div>`;
    S.chat.push({ html: uHtml }); chat.insertAdjacentHTML('beforeend', uHtml);
    const loadId = 'ai-l-' + Date.now();
    chat.insertAdjacentHTML('beforeend', `<div class="msg ai" id="${loadId}">서버 데이터 조회 중…</div>`);
    chat.scrollTop = chat.scrollHeight;
    try {
      const r = await api('/ai/query', { q });
      const aHtml = `<div class="msg ai">${r.answer}<div class="src">SOURCE: ${esc(r.source)} · ${r.engine}</div></div>`;
      S.chat.push({ html: aHtml });
      const el = document.getElementById(loadId); if (el) el.outerHTML = aHtml;
      chat.scrollTop = chat.scrollHeight;
    } catch (e) { const el = document.getElementById(loadId); if (el) el.textContent = '오류: ' + e.message; }
  },
};
window.A = A;

/* ═══════════ 라우터 · 초기화 ═══════════ */
async function render() {
  buildNav();
  $('#pageTitle').textContent = TITLES[S.view] || '';
  const c = $('#content');
  c.innerHTML = '<div class="empty">서버에서 불러오는 중…</div>';
  try {
    const html = await VIEWS[S.view]();
    c.innerHTML = `<div class="view-fade">${html}</div>`;
    if (S.view === 'worklog') A.syncSensor();
  } catch (e) {
    c.innerHTML = `<div class="empty">화면을 불러오지 못했습니다.<br><span class="mono">${esc(e.message)}</span><br><br><button class="btn" onclick="render()">다시 시도</button></div>`;
  }
  window.scrollTo({ top: 0 });
}
window.render = render;

async function init() {
  setInterval(() => { const d = new Date(); $('#clock').textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); }, 1000);
  try {
    const [meta, masters, dash] = await Promise.all([api('/meta'), api('/masters'), api('/dashboard')]);
    M.meta = meta; M.masters = masters; M.badges = dash.navBadges;
    $('#chip-server').textContent = '● ERP 서버 연결 정상';
    $('#chip-ai').textContent = 'AI: ' + meta.aiEngine;
    $('#crumb').textContent = `${meta.today} · ${meta.company} · ${meta.industry}`;
    $('#u-name').textContent = meta.user.name; $('#u-role').textContent = meta.user.role; $('#u-avatar').textContent = meta.user.avatar;
    const hash = location.hash.replace('#', '');
    if (hash && VIEWS[hash]) S.view = hash;
    render();
  } catch (e) {
    $('#chip-server').textContent = '● 서버 연결 실패';
    $('#content').innerHTML = `<div class="empty">서버에 연결할 수 없습니다.<br><span class="mono">${esc(e.message)}</span></div>`;
  }
}
window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (VIEWS[h] && h !== S.view) { S.view = h; render(); } });
init();
