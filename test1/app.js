'use strict';

/* ============ 유틸 ============ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());
const dstr = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return toDateStr(d); };
const parseDate = (s) => new Date(s + 'T00:00:00');
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDate(s) {
  const d = parseDate(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}
function dday(s) {
  const diff = Math.round((parseDate(s) - parseDate(todayStr())) / 86400000);
  if (diff === 0) return { label: 'D-DAY', cls: 'due-today' };
  if (diff > 0) return { label: `D-${diff}`, cls: diff <= 3 ? 'due-soon' : 'due-normal' };
  return { label: `${-diff}일 지남`, cls: 'due-over' };
}

/* ============ 상수 ============ */
const CATS = {
  work: { label: '회사 업무', icon: '💼', chip: 'chip-work' },
  personal: { label: '개인 업무', icon: '🏡', chip: 'chip-personal' },
  growth: { label: '자기계발', icon: '🌱', chip: 'chip-growth' },
};
const PRIS = {
  high: { label: '높음', dot: 'dot-high' },
  mid: { label: '보통', dot: 'dot-mid' },
  low: { label: '낮음', dot: 'dot-low' },
};
const STATUSES = { todo: '할 일', doing: '진행 중', done: '완료' };
const STATUS_ORDER = ['todo', 'doing', 'done'];
const VIEW_TITLES = {
  dashboard: '🏠 대시보드',
  today: '🔥 오늘 할 일',
  work: '💼 회사 업무',
  personal: '🏡 개인 업무',
  growth: '🌱 자기계발',
  schedule: '📅 개인 일정',
};

/* ============ 상태 ============ */
const STORE_KEY = 'pablo_pms_v1';
let state = load() || seed();
let view = 'dashboard';
let query = '';
let selectedDate = todayStr();
let calCursor = { y: new Date().getFullYear(), m: new Date().getMonth() };
let dragId = null;

function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.tasks) && Array.isArray(d.events)) return d;
  } catch (e) { /* 손상된 데이터는 무시하고 새로 시작 */ }
  return null;
}
function seed() {
  const mk = (title, cat, pri, due, today, status, project) => ({
    id: uid(), title, cat, pri, due, today, status, project,
    note: '', createdAt: Date.now(), completedAt: status === 'done' ? todayStr() : null,
  });
  const s = {
    tasks: [
      mk('주간 업무 보고서 작성', 'work', 'high', dstr(0), true, 'doing', '운영'),
      mk('신규 프로젝트 킥오프 자료 준비', 'work', 'high', dstr(2), false, 'todo', '신규 프로젝트'),
      mk('거래처 견적서 검토 및 회신', 'work', 'mid', dstr(1), true, 'todo', '영업'),
      mk('팀 회의록 정리 & 공유', 'work', 'low', dstr(-1), false, 'done', '운영'),
      mk('월말 정산 자료 취합', 'work', 'mid', dstr(5), false, 'todo', '정산'),
      mk('자동차 보험 갱신', 'personal', 'high', dstr(3), false, 'todo', ''),
      mk('집 정리 / 분리수거', 'personal', 'low', null, false, 'todo', ''),
      mk('부모님 선물 주문', 'personal', 'mid', dstr(4), false, 'doing', ''),
      mk('영어 회화 30분', 'growth', 'mid', dstr(0), true, 'todo', '루틴'),
      mk('Claude Code 활용법 학습', 'growth', 'high', dstr(6), false, 'doing', 'AI 공부'),
      mk('독서: 경제 서적 1챕터', 'growth', 'low', null, false, 'todo', '독서'),
    ],
    events: [
      { id: uid(), title: '저녁 운동 (헬스장)', date: dstr(0), time: '19:30', note: '' },
      { id: uid(), title: '치과 정기검진', date: dstr(1), time: '10:00', note: '' },
      { id: uid(), title: '친구 저녁 약속', date: dstr(3), time: '18:30', note: '강남' },
      { id: uid(), title: '가족 모임', date: dstr(5), time: '12:00', note: '' },
    ],
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
  return s;
}

/* ============ 데이터 조작 ============ */
const priRank = { high: 0, mid: 1, low: 2 };
function byTask(a, b) {
  const d = (a.status === 'done') - (b.status === 'done');
  if (d) return d;
  const p = priRank[a.pri] - priRank[b.pri];
  if (p) return p;
  const ad = a.due || '9999-12-31', bd = b.due || '9999-12-31';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (a.createdAt || 0) - (b.createdAt || 0);
}
function byEvent(a, b) { return (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')); }
function matches(t) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [t.title, t.project, t.note].some((v) => (v || '').toLowerCase().includes(q));
}
function evMatches(e) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [e.title, e.note].some((v) => (v || '').toLowerCase().includes(q));
}
function isTodayTask(x) {
  const t = todayStr();
  return x.today || (x.due && x.due <= t && x.status !== 'done') || x.due === t;
}
function todayCount() {
  const t = todayStr();
  return state.tasks.filter((x) => x.status !== 'done' && (x.today || (x.due && x.due <= t))).length;
}

function addTask(data) {
  state.tasks.push({
    id: uid(), title: data.title,
    cat: data.cat || 'work', pri: data.pri || 'mid',
    due: data.due || null, today: !!data.today,
    status: data.status || 'todo',
    project: data.project || '', note: data.note || '',
    createdAt: Date.now(), completedAt: null,
  });
  save(); render();
}
function updateTask(id, patch) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  save(); render();
}
function setStatus(id, st) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.status = st;
  t.completedAt = st === 'done' ? todayStr() : null;
  save(); render();
}
function delTask(id) { state.tasks = state.tasks.filter((x) => x.id !== id); save(); render(); }
function addEvent(d) { state.events.push({ id: uid(), title: d.title, date: d.date, time: d.time || '', note: d.note || '' }); save(); render(); }
function delEvent(id) { state.events = state.events.filter((x) => x.id !== id); save(); render(); }

/* ============ 마크업 빌더 ============ */
function taskMeta(t) {
  const c = CATS[t.cat];
  let html = `<span class="chip ${c.chip}">${c.icon} ${c.label}</span>`;
  html += `<span class="pri"><i class="dot ${PRIS[t.pri].dot}"></i>${PRIS[t.pri].label}</span>`;
  if (t.due) {
    const d = dday(t.due);
    html += `<span class="due ${d.cls}">📅 ${fmtDate(t.due)} · ${d.label}</span>`;
  }
  if (t.project) html += `<span class="tag">#${esc(t.project)}</span>`;
  return html;
}

function taskRow(t) {
  return `<div class="task-row ${t.status === 'done' ? 'is-done' : ''}" data-id="${t.id}">
    <input type="checkbox" class="chk-done" ${t.status === 'done' ? 'checked' : ''} title="완료 처리">
    <div class="task-main" data-action="edit-task">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">${taskMeta(t)}</div>
    </div>
    <button class="status-chip st-${t.status}" data-action="cycle-status" title="클릭하면 상태가 바뀌어요">${STATUSES[t.status]}</button>
    <button class="icon-btn pin ${t.today ? 'on' : ''}" data-action="toggle-today" title="오늘 할 일로 고정/해제">📌</button>
    <button class="icon-btn" data-action="del-task" title="삭제">🗑️</button>
  </div>`;
}

function cardHtml(t) {
  const dueHtml = t.due ? (() => { const d = dday(t.due); return `<span class="due ${d.cls}">📅 ${d.label}</span>`; })() : '';
  return `<div class="card pri-border-${t.pri}" draggable="true" data-id="${t.id}">
    <div class="card-title" data-action="edit-task">${esc(t.title)}</div>
    <div class="card-meta">
      ${t.today ? '<span class="chip chip-today">📌 오늘</span>' : ''}
      <span class="pri"><i class="dot ${PRIS[t.pri].dot}"></i>${PRIS[t.pri].label}</span>
      ${dueHtml}
      ${t.project ? `<span class="tag">#${esc(t.project)}</span>` : ''}
    </div>
    <div class="card-actions">
      <button class="icon-btn pin ${t.today ? 'on' : ''}" data-action="toggle-today" title="오늘 할 일로 고정/해제">📌</button>
      <button class="icon-btn" data-action="edit-task" title="수정">✏️</button>
      <button class="icon-btn" data-action="del-task" title="삭제">🗑️</button>
    </div>
  </div>`;
}

function eventRow(ev) {
  const isToday = ev.date === todayStr();
  return `<div class="event-row ${isToday ? 'is-today' : ''}" data-id="${ev.id}">
    <div class="event-date"><b>${fmtDate(ev.date)}</b>${ev.time ? `<span>🕐 ${esc(ev.time)}</span>` : ''}</div>
    <div class="event-main">
      <div class="event-title">${esc(ev.title)}</div>
      ${ev.note ? `<div class="event-note">${esc(ev.note)}</div>` : ''}
    </div>
    ${isToday ? '<span class="chip chip-today">오늘</span>' : ''}
    <button class="icon-btn" data-action="del-event" title="삭제">🗑️</button>
  </div>`;
}

function stat(icon, num, label, cls, goto) {
  return `<div class="stat ${cls}" ${goto ? `data-goto="${goto}"` : ''}>
    <div class="stat-icon">${icon}</div>
    <div><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>
  </div>`;
}

/* ============ 뷰 렌더러 ============ */
function renderDashboard() {
  const t = todayStr();
  const now = new Date();
  const h = now.getHours();
  const greet = h < 6 ? '🌙 늦은 밤이에요' : h < 12 ? '☀️ 좋은 아침이에요' : h < 18 ? '🌤️ 좋은 오후예요' : '🌆 좋은 저녁이에요';

  const todays = state.tasks.filter(isTodayTask).sort(byTask);
  const openToday = todays.filter((x) => x.status !== 'done');
  const doing = state.tasks.filter((x) => x.status === 'doing').length;
  const doneToday = state.tasks.filter((x) => x.status === 'done' && x.completedAt === t).length;
  const upcoming = state.events.filter((e) => e.date >= t && e.date <= dstr(7)).sort(byEvent);

  const catBars = Object.entries(CATS).map(([k, c]) => {
    const all = state.tasks.filter((x) => x.cat === k);
    const done = all.filter((x) => x.status === 'done').length;
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;
    return `<div class="cat-line" data-goto="${k}">
      <span class="cat-name">${c.icon} ${c.label}</span>
      <div class="bar"><div class="bar-fill fill-${k}" style="width:${pct}%"></div></div>
      <span class="cat-pct">${done}/${all.length}</span>
    </div>`;
  }).join('');

  return `
    <div class="dash-greet">
      <h2>${greet}, Pablo님 👋</h2>
      <p>${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAYS[now.getDay()]}요일 · 오늘도 차근차근 해봐요.</p>
    </div>
    <div class="stats">
      ${stat('🔥', openToday.length, '오늘 남은 할 일', 'st-red', 'today')}
      ${stat('⚡', doing, '진행 중인 작업', 'st-blue', '')}
      ${stat('✅', doneToday, '오늘 완료', 'st-green', '')}
      ${stat('📅', upcoming.length, '7일 내 일정', 'st-amber', 'schedule')}
    </div>
    <div class="dash-grid">
      <div class="panel">
        <div class="panel-head"><h3>🔥 오늘 할 일</h3><button class="link" data-goto="today">전체 보기 →</button></div>
        ${openToday.length ? `<div class="list">${openToday.slice(0, 6).map(taskRow).join('')}</div>` : '<div class="empty">오늘 남은 할 일이 없어요 🎉</div>'}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>📅 다가오는 일정 (7일)</h3><button class="link" data-goto="schedule">전체 보기 →</button></div>
        ${upcoming.length ? upcoming.slice(0, 5).map(eventRow).join('') : '<div class="empty">7일 내 일정이 없어요</div>'}
        <div class="panel-head" style="margin-top:18px"><h3>📊 카테고리 현황</h3></div>
        <div class="cat-bars">${catBars}</div>
      </div>
    </div>`;
}

function renderToday() {
  const list = state.tasks.filter(isTodayTask).filter(matches).sort(byTask);
  const open = list.filter((t) => t.status !== 'done');
  const done = list.filter((t) => t.status === 'done');
  return `
    <div class="quick-add">
      <input id="quickAddInput" data-today="1" placeholder="🔥 오늘 꼭 해야 할 일을 입력하고 Enter">
      <select id="quickAddCat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
      <button class="primary" data-action="quick-add">추가</button>
    </div>
    ${open.length ? `<div class="list">${open.map(taskRow).join('')}</div>` : '<div class="empty">🎉 오늘 남은 할 일이 없어요!</div>'}
    ${done.length ? `<h3 class="section-sub">완료됨 (${done.length})</h3><div class="list">${done.map(taskRow).join('')}</div>` : ''}
    <p class="hint">📌 다른 카테고리의 작업도 핀(📌)을 누르면 이 목록에 모여요. 마감일이 오늘이거나 지난 작업도 자동으로 포함돼요.</p>`;
}

function renderBoard(cat) {
  const c = CATS[cat];
  const tasks = state.tasks.filter((t) => t.cat === cat).filter(matches);
  const cols = STATUS_ORDER.map((st) => {
    const list = tasks.filter((t) => t.status === st).sort(byTask);
    return `<div class="col">
      <div class="col-head col-${st}"><span>${STATUSES[st]}</span><span class="count">${list.length}</span></div>
      <div class="col-body" data-status="${st}">
        ${list.map(cardHtml).join('') || '<div class="empty-col">비어 있음</div>'}
      </div>
    </div>`;
  }).join('');
  return `
    <div class="quick-add">
      <input id="quickAddInput" data-cat="${cat}" placeholder="${c.icon} ${c.label}에 작업을 입력하고 Enter">
      <button class="primary" data-action="quick-add">추가</button>
    </div>
    <div class="board">${cols}</div>
    <p class="hint">💡 카드를 드래그해서 단계를 옮길 수 있어요. 카드 제목을 누르면 상세 수정이 가능해요.</p>`;
}

function calendarHtml() {
  const { y, m } = calCursor;
  const startDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const t = todayStr();
  const evDates = new Set(state.events.map((e) => e.date));
  let cells = '';
  for (let i = 0; i < startDay; i++) cells += '<div class="cal-cell blank"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    cells += `<div class="cal-cell day ${ds === t ? 'is-today' : ''} ${ds === selectedDate ? 'is-selected' : ''}" data-date="${ds}">
      <span>${d}</span>${evDates.has(ds) ? '<i class="ev-dot"></i>' : ''}
    </div>`;
  }
  return `<div class="calendar">
    <div class="cal-head">
      <button class="icon-btn" data-action="cal-prev">←</button>
      <b>${y}년 ${m + 1}월</b>
      <button class="icon-btn" data-action="cal-next">→</button>
    </div>
    <div class="cal-grid">
      ${WEEKDAYS.map((w) => `<div class="cal-cell wd">${w}</div>`).join('')}
      ${cells}
    </div>
  </div>`;
}

function renderSchedule() {
  const t = todayStr();
  const upcoming = state.events.filter((e) => e.date >= t).filter(evMatches).sort(byEvent);
  const selected = state.events.filter((e) => e.date === selectedDate).sort(byEvent);

  const groups = {};
  upcoming.forEach((e) => { (groups[e.date] = groups[e.date] || []).push(e); });
  const groupHtml = Object.keys(groups).sort().map((d) => `
    <div class="event-group">
      <div class="event-group-date">${fmtDate(d)} ${d === t ? '<span class="chip chip-today">오늘</span>' : ''}</div>
      ${groups[d].map(eventRow).join('')}
    </div>`).join('');

  return `<div class="schedule-grid">
    <div class="panel">
      ${calendarHtml()}
      <div class="event-form">
        <h3>＋ ${fmtDate(selectedDate)} 일정 추가</h3>
        <input id="evTitle" placeholder="일정 제목을 입력하고 Enter">
        <div class="row">
          <input id="evDate" type="date" value="${selectedDate}">
          <input id="evTime" type="time">
        </div>
        <input id="evNote" placeholder="메모 (선택)">
        <button class="primary" data-action="add-event">일정 추가</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>📅 ${fmtDate(selectedDate)}의 일정</h3></div>
      ${selected.length ? selected.map(eventRow).join('') : '<div class="empty">이 날짜에 일정이 없어요</div>'}
      <div class="panel-head" style="margin-top:18px"><h3>🗓️ 다가오는 일정 전체</h3></div>
      ${groupHtml || '<div class="empty">예정된 일정이 없어요</div>'}
    </div>
  </div>`;
}

/* ============ 모달 ============ */
function openTaskModal(taskId = null, defaults = {}) {
  const t = taskId ? state.tasks.find((x) => x.id === taskId) : null;
  const v = Object.assign(
    { title: '', cat: defaults.cat || (CATS[view] ? view : 'work'), pri: 'mid', due: '', today: !!defaults.today, project: '', note: '' },
    t || {}
  );
  $('#modalRoot').innerHTML = `
  <div class="overlay" data-action="close-modal">
    <div class="modal">
      <h3>${t ? '✏️ 작업 수정' : '＋ 새 작업'}</h3>
      <label>제목<input id="fTitle" value="${esc(v.title)}" placeholder="무엇을 해야 하나요?"></label>
      <div class="row">
        <label>카테고리<select id="fCat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${v.cat === k ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}</select></label>
        <label>우선순위<select id="fPri">${Object.entries(PRIS).map(([k, p]) => `<option value="${k}" ${v.pri === k ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
      </div>
      <div class="row">
        <label>마감일<input id="fDue" type="date" value="${v.due || ''}"></label>
        <label>프로젝트/태그<input id="fProject" value="${esc(v.project)}" placeholder="예: 신규 프로젝트"></label>
      </div>
      <label class="check"><input id="fToday" type="checkbox" ${v.today ? 'checked' : ''}> 🔥 오늘 꼭 해야 하는 일</label>
      <label>메모<textarea id="fNote" rows="3" placeholder="참고 사항">${esc(v.note)}</textarea></label>
      <div class="modal-actions">
        ${t ? `<button class="danger" data-action="modal-delete" data-id="${t.id}">삭제</button>` : '<span></span>'}
        <div>
          <button data-action="close-modal">취소</button>
          <button class="primary" data-action="modal-save" data-id="${t ? t.id : ''}">저장</button>
        </div>
      </div>
    </div>
  </div>`;
  $('#fTitle').focus();
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function saveModal(id) {
  const title = $('#fTitle').value.trim();
  if (!title) { alert('제목을 입력해 주세요.'); $('#fTitle').focus(); return; }
  const data = {
    title,
    cat: $('#fCat').value,
    pri: $('#fPri').value,
    due: $('#fDue').value || null,
    today: $('#fToday').checked,
    project: $('#fProject').value.trim(),
    note: $('#fNote').value.trim(),
  };
  if (id) updateTask(id, data); else addTask(data);
  closeModal();
}

/* ============ 렌더 ============ */
function setView(v) { view = v; render(); }
function render() {
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#viewTitle').textContent = VIEW_TITLES[view];
  const badge = $('#todayBadge');
  const n = todayCount();
  badge.textContent = n || '';
  badge.style.display = n ? '' : 'none';

  const c = $('#content');
  switch (view) {
    case 'dashboard': c.innerHTML = renderDashboard(); break;
    case 'today': c.innerHTML = renderToday(); break;
    case 'work':
    case 'personal':
    case 'growth': c.innerHTML = renderBoard(view); break;
    case 'schedule': c.innerHTML = renderSchedule(); break;
  }
}

/* ============ 동작 ============ */
function quickAdd() {
  const input = $('#quickAddInput');
  if (!input) return;
  const title = input.value.trim();
  if (!title) { input.focus(); return; }
  const cat = input.dataset.cat || ($('#quickAddCat') ? $('#quickAddCat').value : 'work');
  addTask({ title, cat, today: input.dataset.today === '1' });
  const ni = $('#quickAddInput');
  if (ni) ni.focus();
}

document.addEventListener('click', (e) => {
  // 달력 날짜 선택
  const dayCell = e.target.closest('.cal-cell.day');
  if (dayCell) { selectedDate = dayCell.dataset.date; render(); return; }

  // 뷰 이동 (내부에 액션 버튼이 없을 때만)
  const goto = e.target.closest('[data-goto]');
  if (goto && !e.target.closest('[data-action]') && goto.dataset.goto) { setView(goto.dataset.goto); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const act = el.dataset.action;
  const idHolder = el.closest('[data-id]');
  const id = (idHolder && idHolder.dataset.id) || el.dataset.id;

  switch (act) {
    case 'quick-add': quickAdd(); break;
    case 'cycle-status': {
      const t = state.tasks.find((x) => x.id === id);
      if (t) setStatus(id, STATUS_ORDER[(STATUS_ORDER.indexOf(t.status) + 1) % 3]);
      break;
    }
    case 'toggle-today': {
      const t = state.tasks.find((x) => x.id === id);
      if (t) { t.today = !t.today; save(); render(); }
      break;
    }
    case 'edit-task': openTaskModal(id); break;
    case 'del-task': if (confirm('이 작업을 삭제할까요?')) delTask(id); break;
    case 'del-event': if (confirm('이 일정을 삭제할까요?')) delEvent(id); break;
    case 'add-event': {
      const title = $('#evTitle').value.trim();
      const date = $('#evDate').value;
      if (!title || !date) { alert('제목과 날짜를 입력해 주세요.'); return; }
      selectedDate = date;
      addEvent({ title, date, time: $('#evTime').value, note: $('#evNote').value.trim() });
      break;
    }
    case 'cal-prev': calCursor.m--; if (calCursor.m < 0) { calCursor.m = 11; calCursor.y--; } render(); break;
    case 'cal-next': calCursor.m++; if (calCursor.m > 11) { calCursor.m = 0; calCursor.y++; } render(); break;
    case 'close-modal':
      if (el.classList.contains('overlay') && e.target !== el) return; // 모달 내부 클릭은 무시
      closeModal();
      break;
    case 'modal-save': saveModal(el.dataset.id); break;
    case 'modal-delete': if (confirm('이 작업을 삭제할까요?')) { delTask(el.dataset.id); closeModal(); } break;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.classList.contains('chk-done')) {
    const row = e.target.closest('[data-id]');
    if (row) setStatus(row.dataset.id, e.target.checked ? 'done' : 'todo');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'quickAddInput') quickAdd();
  if (e.key === 'Enter' && e.target.id === 'evTitle') {
    const b = $('[data-action="add-event"]');
    if (b) b.click();
  }
  if (e.key === 'Enter' && e.target.id === 'fTitle') {
    const b = $('[data-action="modal-save"]');
    if (b) saveModal(b.dataset.id);
  }
  if (e.key === 'Escape') closeModal();
});

/* 드래그 & 드롭 (칸반) */
document.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  dragId = card.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
document.addEventListener('dragend', () => {
  $$('.card.dragging').forEach((c) => c.classList.remove('dragging'));
  $$('.col-body.over').forEach((c) => c.classList.remove('over'));
  dragId = null;
});
document.addEventListener('dragover', (e) => {
  const col = e.target.closest('.col-body');
  if (col && dragId) { e.preventDefault(); col.classList.add('over'); }
});
document.addEventListener('dragleave', (e) => {
  const col = e.target.closest('.col-body');
  if (col) col.classList.remove('over');
});
document.addEventListener('drop', (e) => {
  const col = e.target.closest('.col-body');
  if (col && dragId) {
    e.preventDefault();
    setStatus(dragId, col.dataset.status);
    dragId = null;
  }
});

/* 고정 UI 바인딩 */
$$('.nav-item').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('#search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
$('#addTaskBtn').addEventListener('click', () => {
  openTaskModal(null, view === 'today' ? { today: true } : { cat: CATS[view] ? view : 'work' });
});
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pms-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.events)) throw new Error('형식 오류');
      state = d; save(); render();
      alert('가져오기 완료!');
    } catch { alert('올바른 백업 파일이 아니에요.'); }
  };
  r.readAsText(f);
  e.target.value = '';
});

render();
