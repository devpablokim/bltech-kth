// 비엘테크(BL-tech) 통합 ERP 시드 데이터
// 의료용 멸균 포장재·의료용품(수액세트/주사기/진단키트) 제조/수출 기업 — 연 매출 460억 규모.
// 날짜는 서버 기동 시점 기준 상대값으로 생성되어 언제 실행해도 "오늘"이 살아있는 데이터가 된다.

function buildSeed() {
  const now = new Date();
  const d = (off) => { const t = new Date(now); t.setDate(t.getDate() + off); return t.toISOString().slice(0, 10); };
  const wd = (off) => { const t = new Date(now); t.setDate(t.getDate() + off); return t.toLocaleDateString('ko-KR', { weekday: 'short' }); };
  const today = d(0);
  const ymd = today.slice(2).replace(/-/g, '');     // 260611
  const mmdd = today.slice(5).replace(/-/g, '');    // 0611
  const yymm = today.slice(2, 7).replace(/-/g, ''); // 2606
  const L = (suffix) => `L${ymd}-${suffix}`;
  const Ly = (suffix) => `L${d(-1).slice(2).replace(/-/g, '')}-${suffix}`;

  /* ───────── 품목 마스터 (완제품 — 의료용) ─────────
     safety = 기본 안전재고, safetyMargin = 마진(%) → 적용 안전재고 = safety × (1 + margin/100) */
  const items = [
    // 의료기기 완제품 (고단가 주력 — 매출의 중심)
    { code: 'P-5001', name: '수액세트 20drop (IV Set)', unit: 'EA', gradePrices: { 'A+': 2100, 'A': 2200, 'B': 2300, 'C': 2400 }, base: 2400, onHand: 180000, safety: 60000, safetyMargin: 15, avgOut: 21000, dailyCap: 26000, line: '조립 1라인', minRun: 10000, leadDays: 2, bom: [['M-0070', 0.045], ['M-0071', 1], ['M-0021', 0.012], ['B-204', 0.02], ['C-031', 0.005]], labor: 680, oh: 420 },
    { code: 'P-5002', name: '안전 주사기 1mL (Safety Syringe)', unit: 'EA', gradePrices: { 'A+': 740, 'A': 775, 'B': 810, 'C': 850 }, base: 850, onHand: 820000, safety: 250000, safetyMargin: 10, avgOut: 95000, dailyCap: 120000, line: '조립 2라인', minRun: 50000, leadDays: 1, bom: [['M-0070', 0.008], ['M-0071', 1], ['M-0021', 0.004]], labor: 220, oh: 140 },
    { code: 'P-5003', name: '신속진단키트 콤보 (Flu/COVID Ag)', unit: 'EA', gradePrices: { 'A+': 3950, 'A': 4130, 'B': 4310, 'C': 4500 }, base: 4500, onHand: 95000, safety: 40000, safetyMargin: 20, avgOut: 28000, dailyCap: 32000, line: '키트 포장 라인', minRun: 10000, leadDays: 2, bom: [['M-0072', 2], ['M-0033', 0.008], ['M-0040', 0.002], ['M-0055', 0.0005], ['B-204', 0.05], ['C-031', 0.0125]], labor: 950, oh: 620 },
    { code: 'P-5004', name: '멸균 점보 롤 600㎜×200m', unit: 'ROLL', gradePrices: { 'A+': 75500, 'A': 79000, 'B': 82500, 'C': 86000 }, base: 86000, onHand: 1850, safety: 600, safetyMargin: 25, avgOut: 140, dailyCap: 220, line: '점보 슬리터', minRun: 100, leadDays: 3, bom: [['M-0033', 2.8], ['M-0021', 4.8], ['M-0040', 1.4]], labor: 9500, oh: 6800 },
    // 멸균 포장재 (기존 라인)
    { code: 'P-1042', name: '멸균 파우치 250×400 (EO)', unit: 'EA', gradePrices: { 'A+': 332, 'A': 348, 'B': 362, 'C': 380 }, base: 380, onHand: 34500, safety: 20000, safetyMargin: 10, avgOut: 4200, dailyCap: 13000, line: '실링 1라인', minRun: 5000, leadDays: 2, bom: [['M-0021', 0.018], ['M-0033', 0.006], ['M-0040', 0.003], ['M-0055', 0.001], ['B-204', 0.02], ['C-031', 0.005]], labor: 45, oh: 28 },
    { code: 'P-2210', name: '멸균 스틱 파우치 30㎜', unit: 'EA', gradePrices: { 'A+': 254, 'A': 266, 'B': 277, 'C': 290 }, base: 290, onHand: 18800, safety: 8000, safetyMargin: 10, avgOut: 2600, dailyCap: 9000, line: '실링 2라인', minRun: 3000, leadDays: 2, bom: [['M-0021', 0.010], ['M-0033', 0.004], ['M-0055', 0.0008], ['B-204', 0.02], ['C-031', 0.005]], labor: 38, oh: 22 },
    { code: 'P-3088', name: '수액백 1L (Non-PVC)', unit: 'EA', gradePrices: { 'A+': 490, 'A': 512, 'B': 534, 'C': 560 }, base: 560, onHand: 12100, safety: 6000, safetyMargin: 10, avgOut: 1500, dailyCap: 6000, line: '실링 3라인', minRun: 2000, leadDays: 3, bom: [['M-0021', 0.035], ['M-0033', 0.010], ['M-0055', 0.001], ['B-204', 0.04], ['C-031', 0.01]], labor: 88, oh: 52 },
    { code: 'P-1077', name: '진단키트 파우치 50㎖', unit: 'EA', gradePrices: { 'A+': 210, 'A': 220, 'B': 230, 'C': 240 }, base: 240, onHand: 6800, safety: 3000, safetyMargin: 10, avgOut: 700, dailyCap: 8000, line: '실링 1라인', minRun: 2000, leadDays: 2, bom: [['M-0021', 0.006], ['M-0033', 0.003], ['M-0040', 0.002], ['B-204', 0.02], ['C-031', 0.005]], labor: 30, oh: 18 },
    { code: 'P-1250', name: '의료용 PE 보호필름 1250㎜', unit: 'm', gradePrices: { 'A+': 352, 'A': 368, 'B': 382, 'C': 400 }, base: 400, onHand: 3700, safety: 2000, safetyMargin: 10, avgOut: 950, dailyCap: 7500, line: '압출 1라인', minRun: 1500, leadDays: 1, bom: [['M-0021', 0.082]], labor: 40, oh: 30 },
    { code: 'P-0915', name: '알루미늄 멸균 파우치 (대)', unit: 'EA', gradePrices: { 'A+': 110, 'A': 115, 'B': 118, 'C': 125 }, base: 125, onHand: 4200, safety: 5000, safetyMargin: 10, avgOut: 1800, dailyCap: 15000, line: '제대 2호기', minRun: 5000, leadDays: 2, bom: [['M-0021', 0.008], ['M-0040', 0.004]], labor: 24, oh: 14 },
    { code: 'P-0732', name: '멸균 롤 3중합지 PET12/AL7/PE80', unit: 'm', gradePrices: { 'A+': 510, 'A': 532, 'B': 554, 'C': 580 }, base: 580, onHand: 5100, safety: 2500, safetyMargin: 10, avgOut: 600, dailyCap: 4000, line: '합지 1라인', minRun: 1000, leadDays: 2, bom: [['M-0033', 0.014], ['M-0040', 0.007], ['M-0021', 0.060]], labor: 55, oh: 40 },
    { code: 'P-0488', name: '멸균 지퍼백 (중)', unit: 'EA', gradePrices: { 'A+': 39, 'A': 41, 'B': 42, 'C': 45 }, base: 45, onHand: 62000, safety: 25000, safetyMargin: 10, avgOut: 9500, dailyCap: 40000, line: '제대 1호기', minRun: 10000, leadDays: 1, bom: [['M-0021', 0.006]], labor: 8, oh: 5 },
    { code: 'P-0331', name: '멸균 스탠드 파우치 (소)', unit: 'EA', gradePrices: { 'A+': 84, 'A': 88, 'B': 92, 'C': 96 }, base: 96, onHand: 48500, safety: 15000, safetyMargin: 10, avgOut: 5200, dailyCap: 25000, line: '제대 2호기', minRun: 8000, leadDays: 1, bom: [['M-0021', 0.008], ['M-0033', 0.003]], labor: 18, oh: 11 },
    { code: 'P-0207', name: '멸균 인디케이터 테이프 48㎜', unit: 'EA', gradePrices: { 'A+': 370, 'A': 386, 'B': 400, 'C': 420 }, base: 420, onHand: 9200, safety: 3000, safetyMargin: 10, avgOut: 300, dailyCap: 5000, line: '코팅 라인', minRun: 1000, leadDays: 2, bom: [['M-0033', 0.020], ['M-0055', 0.004]], labor: 95, oh: 60 },
  ];

  /* ───────── 원재료 마스터 ───────── */
  const rawMaterials = [
    { code: 'M-0021', name: 'PE 원단 (의료용 LDPE)', unit: 'kg', unitCost: 2800, onHand: 820, safety: 1200, safetyMargin: 10, supplier: 'V-001', leadDays: 3, avgUse: 260 },
    { code: 'M-0033', name: 'PET 필름 12㎛', unit: 'kg', unitCost: 3600, onHand: 2400, safety: 900, safetyMargin: 10, supplier: 'V-002', leadDays: 5, avgUse: 110 },
    { code: 'M-0040', name: 'AL 호일 7㎛', unit: 'kg', unitCost: 9800, onHand: 640, safety: 400, safetyMargin: 15, supplier: 'V-003', leadDays: 7, avgUse: 60, priceChange: +9 },
    { code: 'M-0055', name: '의료용 그레이드 잉크', unit: 'kg', unitCost: 12000, onHand: 96, safety: 40, safetyMargin: 10, supplier: 'V-004', leadDays: 4, avgUse: 6 },
    { code: 'M-0070', name: '의료용 튜브 컴파운드 (PVC-free)', unit: 'kg', unitCost: 4200, onHand: 5800, safety: 2000, safetyMargin: 15, supplier: 'V-004', leadDays: 4, avgUse: 920 },
    { code: 'M-0071', name: '니들·허브 부품 세트', unit: 'EA', unitCost: 95, onHand: 480000, safety: 150000, safetyMargin: 20, supplier: 'V-006', leadDays: 6, avgUse: 130000 },
    { code: 'M-0072', name: '진단 스트립 (Ag 콤보)', unit: 'EA', unitCost: 520, onHand: 310000, safety: 100000, safetyMargin: 20, supplier: 'V-007', leadDays: 8, avgUse: 60000 },
    { code: 'R-EP700', name: '수지 EP-700', unit: 'kg', unitCost: 6500, onHand: 37, safety: 30, safetyMargin: 10, supplier: 'V-004', leadDays: 4, avgUse: 6.2 },
    { code: 'R-SR340', name: '수지 SR-340', unit: 'kg', unitCost: 7200, onHand: 8.4, safety: 20, safetyMargin: 10, supplier: 'V-004', leadDays: 4, avgUse: 4.6 },
    { code: 'C-CAT12', name: '촉매 CAT-12', unit: 'kg', unitCost: 18000, onHand: 12, safety: 8, safetyMargin: 10, supplier: 'V-004', leadDays: 4, avgUse: 0.8 },
    { code: 'C-CAT07', name: '촉매 CAT-07', unit: 'kg', unitCost: 17500, onHand: 5.5, safety: 6, safetyMargin: 10, supplier: 'V-004', leadDays: 4, avgUse: 0.6 },
    { code: 'B-204', name: '멸균 내박스 50입', unit: 'EA', unitCost: 420, onHand: 3400, safety: 1500, safetyMargin: 10, supplier: 'V-005', leadDays: 2, avgUse: 240 },
    { code: 'C-031', name: '수출용 외박스', unit: 'EA', unitCost: 980, onHand: 1280, safety: 800, safetyMargin: 10, supplier: 'V-005', leadDays: 2, avgUse: 70 },
  ];

  /* ───────── 거래처 마스터 (단가등급 A+/A/B/C · 연 매출 428억 누계) ───────── */
  const customers = [
    { code: 'C-001', name: '㈜한빛메디칼', alias: ['한빛', '한빛메디칼(주)'], bizNo: '123-86-00451', ceo: '김한빛', country: '한국', grade: 'A+', manager: 'E-05', contact: { name: '이정훈 과장', email: 'jh.lee@hanbitmed.co.kr', phone: '010-2345-1101' }, address: '경기 화성시 동탄산단로 12', baseSales: 10240000000, basePaid: 9480000000, agingNote: null },
    { code: 'C-002', name: 'Pacific Medical Inc.', alias: ['Pacific', 'PMI', '퍼시픽'], bizNo: 'US-84-2231907', ceo: 'D. Marquez', country: '미국', grade: 'A', manager: 'E-06', contact: { name: 'S. Reyes', email: 'orders@pacificmed.com', phone: '+1-213-555-0173' }, address: '920 S Hill St, Los Angeles, CA', baseSales: 8650000000, basePaid: 7420000000, agingNote: '60일 경과 채권 포함' },
    { code: 'C-003', name: '사쿠라메디컬', alias: ['사쿠라', 'Sakura'], bizNo: 'JP-7010401-0556', ceo: '佐藤健', country: '일본', grade: 'A', manager: 'E-07', contact: { name: '田中課長', email: 'tanaka@sakuramed.jp', phone: '+81-3-5550-2241' }, address: '東京都 港区 芝 2-3-1', baseSales: 5860000000, basePaid: 5860000000, agingNote: null },
    { code: 'C-004', name: 'VinaMed Trading', alias: ['비나메드', 'VinaMed'], bizNo: 'VN-0312-887541', ceo: 'Nguyen Thao', country: '베트남', grade: 'B', manager: 'E-08', contact: { name: 'Linh', email: 'linh@vinamed.vn', phone: '+84-28-555-7732' }, address: 'Ho Chi Minh, Dist.7, Tan Thuan', baseSales: 3180000000, basePaid: 2740000000, agingNote: '30일 경과' },
    { code: 'C-005', name: '동성메디텍', alias: ['동성', '동성메디텍(주)'], bizNo: '214-81-33012', ceo: '박동성', country: '한국', grade: 'B', manager: 'E-05', contact: { name: '오민석 대리', email: 'ms.oh@dsmeditech.kr', phone: '010-9931-4420' }, address: '인천 남동구 논현고잔로 88', baseSales: 2460000000, basePaid: 2460000000, agingNote: null },
    { code: 'C-006', name: 'GlobalMed GmbH', alias: ['GlobalMed', '글로벌메드'], bizNo: 'DE-HRB-220914', ceo: 'K. Fischer', country: '독일', grade: 'C', manager: 'E-06', contact: { name: 'M. Weber', email: 'weber@globalmed.de', phone: '+49-69-5550-118' }, address: 'Frankfurt am Main, Hanauer 52', baseSales: 1280000000, basePaid: 910000000, agingNote: '90일 경과 — 독촉 2차' },
    { code: 'C-007', name: '㈜바움바이오', alias: ['바움', 'BAUM'], bizNo: '305-87-11202', ceo: '박바움', country: '한국', grade: 'A', manager: 'E-05', contact: { name: '서지우 주임', email: 'jw.seo@baumbio.kr', phone: '010-7741-2204' }, address: '대전 유성구 테크노4로 17', baseSales: 4520000000, basePaid: 4350000000, agingNote: null, oem: true },
    { code: 'C-008', name: '그린팩메디칼', alias: ['그린팩', 'GreenPack'], bizNo: '129-86-55017', ceo: '최그린', country: '한국', grade: 'B', manager: 'E-08', contact: { name: '박과장', email: 'pk@greenpackmed.kr', phone: '010-5520-9911' }, address: '경기 김포시 양촌읍 황금로 117', baseSales: 1890000000, basePaid: 1820000000, agingNote: null },
    { code: 'C-009', name: '모리메디컬', alias: ['모리', 'Mori'], bizNo: 'JP-5011101-0233', ceo: '森田一', country: '일본', grade: 'B', manager: 'E-07', contact: { name: '森田', email: 'morita@morimed.jp', phone: '+81-6-4400-7720' }, address: '大阪市 北区 梅田 1-8-17', baseSales: 1640000000, basePaid: 1560000000, agingNote: null },
    { code: 'C-010', name: '한솔헬스케어', alias: ['한솔', '한솔헬스케어(주)'], bizNo: '120-81-77441', ceo: '한지민', country: '한국', grade: 'A', manager: 'E-05', contact: { name: '구매팀 임수빈', email: 'sb.lim@hansolhc.kr', phone: '010-3302-8814' }, address: '서울 송파구 법원로 128', baseSales: 3120000000, basePaid: 2980000000, agingNote: null },
  ];

  /* ───────── 공급처 (구매) ───────── */
  const suppliers = [
    { code: 'V-001', name: '동방케미칼', items: 'PE 원단 (의료용 LDPE)', leadDays: 3, contact: '구판수 부장 · 010-8841-2210', rating: 'A', note: 'ISO 10993 생체적합성 인증 자재' },
    { code: 'V-002', name: '한솔필름', items: 'PET 필름 12㎛', leadDays: 5, contact: '이선영 과장 · 010-2204-6633', rating: 'A', note: '' },
    { code: 'V-003', name: '대한알루미늄', items: 'AL 호일 7㎛', leadDays: 7, contact: '최강수 차장 · 010-9907-1145', rating: 'B', note: '6월 단가 +9% 인상 통보' },
    { code: 'V-004', name: '신성화학', items: '수지·촉매·잉크·튜브 컴파운드', leadDays: 4, contact: '한미래 대리 · 010-3320-5571', rating: 'A', note: 'USP Class VI 등급' },
    { code: 'V-005', name: '대성패키지', items: '내박스 · 수출용 외박스', leadDays: 2, contact: '윤대성 대표 · 010-5210-0098', rating: 'B', note: '' },
    { code: 'V-006', name: '메디파츠코리아', items: '니들·허브 부품 세트', leadDays: 6, contact: '정현규 차장 · 010-6611-3041', rating: 'A', note: '클린룸 Class 8 사출' },
    { code: 'V-007', name: '진단소재텍', items: '진단 스트립 (Ag 콤보)', leadDays: 8, contact: '김보라 과장 · 010-2280-7754', rating: 'A', note: '식약처 GMP 원자재 적합' },
  ];

  /* ───────── 사원 (조직도: 대표 배진우 / 영업 매니저 진은명 / 생산팀장 차훈 / 생산 매니저 장다슬) ───────── */
  const employees = [
    { code: 'E-01', name: '배진우', dept: '경영', role: '대표이사' },
    { code: 'E-02', name: '진은명', dept: '영업팀', role: '매니저 · 영업 총괄' },
    { code: 'E-03', name: '차훈', dept: '생산팀', role: '팀장 · 생산 총괄' },
    { code: 'E-04', name: '장다슬', dept: '생산팀', role: '매니저 · 생산관리' },
    { code: 'E-05', name: '이서연', dept: '영업팀', role: '국내 영업' },
    { code: 'E-06', name: '박지훈', dept: '해외영업팀', role: '미주·유럽' },
    { code: 'E-07', name: '최민아', dept: '해외영업팀', role: '일본' },
    { code: 'E-08', name: '정우성', dept: '영업팀', role: '동남아·신규' },
    { code: 'E-09', name: '김현우', dept: '생산팀', role: '실링 2라인' },
    { code: 'E-10', name: '박소연', dept: '생산팀', role: '실링 3라인' },
    { code: 'E-11', name: '서준호', dept: '생산팀', role: '조립 1·2라인' },
    { code: 'E-12', name: '문가영', dept: '생산팀', role: '키트 포장 라인' },
    { code: 'E-13', name: '강민준', dept: '물류팀', role: '창고·배송' },
    { code: 'E-14', name: '윤지혜', dept: '재무회계팀', role: '채권·자금' },
    { code: 'E-15', name: '한도윤', dept: '구매팀', role: '자재 구매' },
  ];

  /* ───────── 설비 ───────── */
  const machines = [
    { id: 'MC-1', name: '실링기 #1', status: '정상', sealTemp: 182.4, roomTemp: 26.1, humidity: 41, lot: L('A03'), tempMax: 198 },
    { id: 'MC-2', name: '실링기 #2', status: '온도 주의', sealTemp: 196.8, roomTemp: 27.9, humidity: 44, lot: L('B01'), tempMax: 198 },
    { id: 'MC-3', name: '실링기 #3', status: '정상', sealTemp: 179.2, roomTemp: 25.7, humidity: 39, lot: L('C02'), tempMax: 198 },
    { id: 'MC-4', name: '실링기 #4', status: '예방정비', sealTemp: 0, roomTemp: 24.0, humidity: 40, lot: '-', tempMax: 198 },
    { id: 'MC-5', name: '압출기 #1', status: '가동', sealTemp: 0, roomTemp: 31.2, humidity: 38, lot: 'P-1250 진행 42%', tempMax: 0 },
    { id: 'MC-6', name: '제대기 #2', status: '대기', sealTemp: 0, roomTemp: 24.8, humidity: 41, lot: '-', tempMax: 0 },
    { id: 'MC-7', name: '조립 1라인', status: '가동', sealTemp: 0, roomTemp: 23.4, humidity: 40, lot: 'P-5001 진행 58%', tempMax: 0 },
    { id: 'MC-8', name: '조립 2라인', status: '가동', sealTemp: 0, roomTemp: 23.1, humidity: 39, lot: 'P-5002 진행 71%', tempMax: 0 },
    { id: 'MC-9', name: '키트 포장 라인', status: '가동', sealTemp: 0, roomTemp: 22.8, humidity: 38, lot: 'P-5003 진행 44%', tempMax: 0 },
    { id: 'MC-10', name: '점보 슬리터', status: '대기', sealTemp: 0, roomTemp: 24.2, humidity: 40, lot: '-', tempMax: 0 },
  ];

  /* ───────── 수주 ───────── */
  const dayN = (off) => `SO-${today.slice(5, 7)}${String(Math.max(1, +today.slice(8, 10) + off)).padStart(2, '0')}`;
  const orders = [
    { no: `SO-${mmdd}-05`, date: d(0), customerCode: 'C-001', itemCode: 'P-5003', qty: 80000, unitPrice: 3950, dueDate: d(6), country: '한국', status: '생산배정', verdict: '생산필요' },
    { no: `SO-${mmdd}-04`, date: d(0), customerCode: 'C-001', itemCode: 'P-1250', qty: 4000, unitPrice: 352, dueDate: d(1), country: '한국', status: '생산배정', verdict: '부족' },
    { no: `SO-${mmdd}-03`, date: d(0), customerCode: 'C-009', itemCode: 'P-0915', qty: 12000, unitPrice: 118, dueDate: d(2), country: '일본', status: '생산배정', verdict: '부족' },
    { no: `SO-${mmdd}-02`, date: d(0), customerCode: 'C-007', itemCode: 'P-0732', qty: 2400, unitPrice: 532, dueDate: d(4), country: '한국', status: '출고진행', verdict: '즉시출고' },
    { no: `SO-${mmdd}-01`, date: d(0), customerCode: 'C-010', itemCode: 'P-0488', qty: 30000, unitPrice: 41, dueDate: d(5), country: '한국', status: '출고진행', verdict: '즉시출고' },
    { no: `${dayN(-1)}-12`, date: d(-1), customerCode: 'C-005', itemCode: 'P-5002', qty: 500000, unitPrice: 810, dueDate: d(9), country: '한국', status: '출고대기', verdict: '즉시출고' },
    { no: `${dayN(-1)}-11`, date: d(-1), customerCode: 'C-008', itemCode: 'P-1250', qty: 1500, unitPrice: 382, dueDate: d(6), country: '한국', status: '생산배정', verdict: '부족' },
    { no: `${dayN(-1)}-07`, date: d(-1), customerCode: 'C-003', itemCode: 'P-2210', qty: 3600, unitPrice: 266, dueDate: d(8), country: '일본', status: '출고대기', verdict: '즉시출고', exportId: 'EXP-2606-02' },
    { no: `${dayN(-1)}-02`, date: d(-1), customerCode: 'C-004', itemCode: 'P-3088', qty: 2400, unitPrice: 534, dueDate: d(12), country: '베트남', status: '출고완료', verdict: '즉시출고', exportId: 'EXP-2605-12' },
    { no: `${dayN(-2)}-09`, date: d(-2), customerCode: 'C-008', itemCode: 'P-0207', qty: 400, unitPrice: 400, dueDate: d(0), country: '한국', status: '출고진행', verdict: '즉시출고' },
    { no: `${dayN(-2)}-05`, date: d(-2), customerCode: 'C-002', itemCode: 'P-5001', qty: 240000, unitPrice: 2200, dueDate: d(17), country: '미국', status: '생산배정', verdict: '부족', exportId: 'EXP-2606-01' },
    { no: `${dayN(-2)}-11`, date: d(-2), customerCode: 'C-009', itemCode: 'P-0331', qty: 6000, unitPrice: 92, dueDate: d(1), country: '일본', status: '출고진행', verdict: '즉시출고' },
    { no: `${dayN(-3)}-02`, date: d(-3), customerCode: 'C-010', itemCode: 'P-0488', qty: 12000, unitPrice: 41, dueDate: d(-1), country: '한국', status: '출고완료', verdict: '즉시출고' },
    { no: `${dayN(-3)}-05`, date: d(-3), customerCode: 'C-005', itemCode: 'P-1077', qty: 1200, unitPrice: 230, dueDate: d(-1), country: '한국', status: '출고완료', verdict: '즉시출고' },
  ];

  /* ───────── 작업지시 (생산지시 + 일일 생산지시) ─────────
     dailyPlan: 생산지시를 일자별로 분할한 일일 지시 — 공정일지 입력 시 실적(actual)이 자동 누적된다. */
  const workOrders = [
    {
      no: `WO-${mmdd}-01`, customerCode: 'C-007', itemCode: 'P-1042', qty: 4800, status: '진행', assignee: '장다슬', machine: '실링 1라인', progress: 64, specVer: 'v3', lastProduced: '2025-06 (1년 전)',
      spec: { 원단: 'PET12 / AL7 / PE80 3중 합지 · 폭 480㎜', 포장재: '내박스 50입 (B-204) · 외박스 4입 (C-031)', 라벨: 'v3 (2026 개정) · 후면 좌측 부착 · 멸균일/유효기한 잉크젯 하단', 실링조건: '180–186℃ · 0.4MPa · 1.2초', 특이사항: '로고 인쇄면 스크래치 주의 · 출고 전 거래처 라벨 사진 송부 · ISO 11607 적합' },
      drawing: 'baum_pouch250_v3.pdf', specChange: '작년 동일 발주(WO-0612-02) 대비 변경점 1건: 라벨 v2 → v3 (의료기기 표시기재 개정)',
      dailyPlan: [
        { date: d(-1), qty: 1600, machine: '실링 1라인', status: '완료', actual: 1600, issued: true },
        { date: d(0), qty: 1600, machine: '실링 1라인', status: '진행', actual: 1080, issued: true },
        { date: d(1), qty: 1600, machine: '실링 1라인', status: '예정', actual: 0, issued: false },
      ],
    },
    {
      no: `WO-${mmdd}-02`, customerCode: 'C-003', itemCode: 'P-2210', qty: 3600, status: '진행', assignee: '김현우', machine: '실링 2라인', progress: 41, specVer: 'v1', lastProduced: d(-90).slice(0, 7),
      spec: { 원단: 'PET12 / PE70 2중 합지 · 폭 320㎜', 포장재: '내박스 100입 · 외박스 6입', 라벨: '일문 라벨 v1 · 수출용 PMDA 표기', 실링조건: '176–182℃ · 0.35MPa · 1.0초', 특이사항: '수출 선적분 — 보세창고 직송' },
      drawing: 'sakura_stick30_v1.pdf', specChange: null,
      dailyPlan: [
        { date: d(0), qty: 1800, machine: '실링 2라인', status: '진행', actual: 1200, issued: true },
        { date: d(1), qty: 1800, machine: '실링 2라인', status: '예정', actual: 0, issued: false },
      ],
    },
    {
      no: `WO-${mmdd}-03`, customerCode: 'C-004', itemCode: 'P-3088', qty: 2400, status: '대기', assignee: '박소연', machine: '실링 3라인', progress: 0, specVer: 'v2', lastProduced: d(-35).slice(0, 7),
      spec: { 원단: 'Non-PVC 다층 필름 · 폭 540㎜', 포장재: '내박스 20입 · 외박스 4입', 라벨: '베트남어 라벨 — 시안 승인 대기', 실링조건: '184–190℃ · 0.45MPa · 1.4초', 특이사항: '차기 출고분 — 라벨 승인 후 착수' },
      drawing: 'vinamed_ivbag_v2.pdf', specChange: '라벨 시안 승인 대기 (D-2 경과)',
      dailyPlan: [{ date: d(1), qty: 2400, machine: '실링 3라인', status: '예정', actual: 0, issued: false }],
    },
    {
      no: `WO-${mmdd}-04`, customerCode: 'C-002', itemCode: 'P-5001', qty: 240000, status: '대기', assignee: '서준호', machine: '조립 1라인', progress: 0, specVer: 'v4', lastProduced: d(-60).slice(0, 7),
      spec: { 구성: '스파이크·드립챔버·롤러클램프·니들허브 (DEHP-free)', 포장재: 'FDA 기준 수출 포장 · 외박스 4입', 라벨: '영문 라벨 v4 · FDA 21 CFR 표기', 멸균: 'EO 멸균 · 에어레이션 7일', 특이사항: '수출 선적 ETD 연동 — 일일 60,000EA 분할, 금일 착수 필수' },
      drawing: 'pacific_ivset_v4.pdf', specChange: null,
      dailyPlan: [
        { date: d(1), qty: 60000, machine: '조립 1라인', status: '예정', actual: 0, issued: false },
        { date: d(2), qty: 65000, machine: '조립 1라인', status: '예정', actual: 0, issued: false },
        { date: d(3), qty: 65000, machine: '조립 1라인', status: '예정', actual: 0, issued: false },
        { date: d(4), qty: 50000, machine: '조립 1라인', status: '예정', actual: 0, issued: false },
      ],
    },
    {
      no: `WO-${mmdd}-05`, customerCode: 'C-001', itemCode: 'P-5003', qty: 80000, status: '진행', assignee: '문가영', machine: '키트 포장 라인', progress: 15, specVer: 'v2', lastProduced: d(-22).slice(0, 7),
      spec: { 구성: 'Flu A/B + COVID Ag 콤보 · 스트립 2매', 포장재: '개별 알루미늄 파우치 + 내박스 20입', 라벨: '식약처 허가 표기 v2 · 로트/유효기한 잉크젯', 멸균: '해당 없음 (클린룸 조립)', 특이사항: '습도 45% 이하 유지 — 스트립 변질 주의' },
      drawing: 'hanbit_kit_combo_v2.pdf', specChange: null,
      dailyPlan: [
        { date: d(0), qty: 26000, machine: '키트 포장 라인', status: '진행', actual: 11800, issued: true },
        { date: d(1), qty: 27000, machine: '키트 포장 라인', status: '예정', actual: 0, issued: false },
        { date: d(2), qty: 27000, machine: '키트 포장 라인', status: '예정', actual: 0, issued: false },
      ],
    },
  ];

  /* ───────── 공정일지 (오늘 입력분) ───────── */
  const workLogs = [
    { id: 'WL-047', no: `${today.replace(/-/g, '')}-047`, time: '14:31', woNo: `WO-${mmdd}-02`, worker: '김현우', machine: '실링기 #2', sealTemp: 196.8, roomTemp: 24.2, humidity: 53, itemCode: 'P-2210', lotNo: L('B01'), qty: 1200, remain: 80, coating: '3.2kg', weight: 248.1, resin: 'EP-700 · 클리어', catalyst: 'CAT-12', mixDate: d(-3), bubbleTest: '합격' },
    { id: 'WL-046', no: `${today.replace(/-/g, '')}-046`, time: '14:02', woNo: `WO-${mmdd}-01`, worker: '장다슬', machine: '실링기 #1', sealTemp: 182.4, roomTemp: 24.0, humidity: 52, itemCode: 'P-1042', lotNo: L('A03'), qty: 1520, remain: 120, coating: '3.2kg', weight: 251.3, resin: 'EP-700 · 화이트', catalyst: 'CAT-12', mixDate: d(-2), bubbleTest: '합격' },
    { id: 'WL-045', no: `${today.replace(/-/g, '')}-045`, time: '13:24', woNo: null, worker: '박소연', machine: '실링기 #3', sealTemp: 179.2, roomTemp: 23.5, humidity: 49, itemCode: 'P-3088', lotNo: L('C02'), qty: 1350, remain: 210, coating: '4.3kg', weight: 250.8, resin: 'SR-340 · 블루', catalyst: 'CAT-07', mixDate: d(-4), bubbleTest: '합격' },
    { id: 'WL-044', no: `${today.replace(/-/g, '')}-044`, time: '11:48', woNo: `WO-${mmdd}-01`, worker: '장다슬', machine: '실링기 #1', sealTemp: 181.0, roomTemp: 23.9, humidity: 50, itemCode: 'P-1042', lotNo: L('A02'), qty: 1560, remain: 0, coating: '3.0kg', weight: 249.5, resin: 'EP-700 · 화이트', catalyst: 'CAT-12', mixDate: d(-2), bubbleTest: '합격' },
    { id: 'WL-043', no: `${today.replace(/-/g, '')}-043`, time: '10:15', woNo: null, worker: '박소연', machine: '실링기 #3', sealTemp: 178.9, roomTemp: 23.4, humidity: 48, itemCode: 'P-3088', lotNo: L('C01'), qty: 1380, remain: 0, coating: '4.4kg', weight: 250.2, resin: 'SR-340 · 블루', catalyst: 'CAT-07', mixDate: d(-4), bubbleTest: '재검 → 합격' },
  ];

  /* ───────── 생산 LOT ───────── */
  const lots = [
    { no: L('A01'), itemCode: 'P-1042', qty: 1540, remain: 0, coating: '3.1kg', machine: '실링기 #1', status: '완료', date: d(0), worker: '장다슬', woNo: `WO-${mmdd}-01` },
    { no: L('A02'), itemCode: 'P-1042', qty: 1560, remain: 0, coating: '3.0kg', machine: '실링기 #1', status: '완료', date: d(0), worker: '장다슬', woNo: `WO-${mmdd}-01` },
    { no: L('A03'), itemCode: 'P-1042', qty: 1520, remain: 120, coating: '3.2kg', machine: '실링기 #1', status: '진행 중', date: d(0), worker: '장다슬', woNo: `WO-${mmdd}-01` },
    { no: L('B01'), itemCode: 'P-2210', qty: 1200, remain: 80, coating: '3.2kg', machine: '실링기 #2', status: '온도 주의', date: d(0), worker: '김현우', woNo: `WO-${mmdd}-02` },
    { no: L('C01'), itemCode: 'P-3088', qty: 1380, remain: 0, coating: '4.4kg', machine: '실링기 #3', status: '완료', date: d(0), worker: '박소연', woNo: null },
    { no: L('C02'), itemCode: 'P-3088', qty: 1350, remain: 210, coating: '4.3kg', machine: '실링기 #3', status: '진행 중', date: d(0), worker: '박소연', woNo: null },
    { no: L('F01'), itemCode: 'P-5001', qty: 9800, remain: 0, coating: '-', machine: '조립 1라인', status: '완료', date: d(0), worker: '서준호', woNo: null },
    { no: L('F02'), itemCode: 'P-5001', qty: 4400, remain: 600, coating: '-', machine: '조립 1라인', status: '진행 중', date: d(0), worker: '서준호', woNo: null },
    { no: L('G01'), itemCode: 'P-5002', qty: 26000, remain: 0, coating: '-', machine: '조립 2라인', status: '완료', date: d(0), worker: '서준호', woNo: null },
    { no: L('K01'), itemCode: 'P-5003', qty: 11800, remain: 1400, coating: '-', machine: '키트 포장 라인', status: '진행 중', date: d(0), worker: '문가영', woNo: `WO-${mmdd}-05` },
    { no: Ly('D04'), itemCode: 'P-1077', qty: 1420, remain: 0, coating: '1.8kg', machine: '실링기 #1', status: '완료', date: d(-1), worker: '김현우', woNo: null },
  ];

  /* ───────── 품질 기록 ───────── */
  const qualityRecords = [
    { time: '14:30', lotNo: L('B01'), sealTemp: 196.8, room: '24.2℃/53%', weight: 248.1, bubble: '합격', verdict: '주의' },
    { time: '14:00', lotNo: L('A03'), sealTemp: 182.4, room: '24.0℃/52%', weight: 251.3, bubble: '합격', verdict: '정상' },
    { time: '13:30', lotNo: L('B01'), sealTemp: 193.1, room: '23.8℃/51%', weight: 244.2, bubble: '합격', verdict: '기준 이탈' },
    { time: '13:00', lotNo: L('C02'), sealTemp: 179.2, room: '23.5℃/49%', weight: 250.8, bubble: '합격', verdict: '정상' },
    { time: '12:30', lotNo: L('C02'), sealTemp: 178.9, room: '23.4℃/48%', weight: 250.2, bubble: '재검 → 합격', verdict: '정상' },
    { time: '11:40', lotNo: L('A02'), sealTemp: 181.0, room: '23.9℃/50%', weight: 249.5, bubble: '합격', verdict: '정상' },
  ];
  const qcStats = { bubblePassRate: 99.1, bubblePass7d: 98.7, weightOut: 2, tempOver: 1, defectRate: 0.42, defectTrend: 0.11, humidityCorr: 0.81, humidityRange: '47%→53%' };

  /* ───────── 원재료 배합 (LOT 추적) ───────── */
  const materialBatches = [
    { resin: 'EP-700', color: '클리어', catalyst: 'CAT-12', synthDate: d(-6), mixDate: d(-3), lots: 'B01', remainKg: 14.2, status: '사용 중' },
    { resin: 'EP-700', color: '화이트', catalyst: 'CAT-12', synthDate: d(-6), mixDate: d(-2), lots: 'A01–A03', remainKg: 22.8, status: '사용 중' },
    { resin: 'SR-340', color: '블루', catalyst: 'CAT-07', synthDate: d(-9), mixDate: d(-4), lots: 'C01–C02', remainKg: 8.4, status: '잔량 부족' },
    { resin: 'SR-340', color: '클리어', catalyst: 'CAT-07', synthDate: d(-14), mixDate: d(-8), lots: 'D04', remainKg: 0, status: '소진' },
  ];

  /* ───────── 구매 발주 ───────── */
  const purchaseOrders = [
    { no: `PO-${yymm}-03`, supplierCode: 'V-004', materialCode: 'R-SR340', qty: 60, unit: 'kg', unitCost: 7200, amount: 432000, orderDate: d(-2), dueDate: d(2), status: '운송중', note: '소진 예측 D-1.8 — 입고 전 생산계획 조정 필요' },
    { no: `PO-${yymm}-02`, supplierCode: 'V-003', materialCode: 'M-0040', qty: 500, unit: 'kg', unitCost: 9800, amount: 4900000, orderDate: d(-7), dueDate: d(0), status: '입고완료', receivedAt: d(0) + ' 09:12' },
    { no: `PO-${yymm}-01`, supplierCode: 'V-002', materialCode: 'M-0033', qty: 800, unit: 'kg', unitCost: 3600, amount: 2880000, orderDate: d(-6), dueDate: d(-1), status: '입고완료', receivedAt: d(-1) + ' 10:05' },
    { no: `PO-${yymm}-04`, supplierCode: 'V-006', materialCode: 'M-0071', qty: 600000, unit: 'EA', unitCost: 95, amount: 57000000, orderDate: d(-3), dueDate: d(3), status: '운송중', note: 'Pacific 수액세트 240,000EA 생산 대비' },
    { no: `PO-${yymm}-05`, supplierCode: 'V-007', materialCode: 'M-0072', qty: 400000, unit: 'EA', unitCost: 520, amount: 208000000, orderDate: d(-4), dueDate: d(4), status: '운송중', note: '한빛 진단키트 80,000EA + 안전재고 보충' },
  ];

  /* ───────── 출고 보드 ───────── */
  const shipments = [
    { id: 'OUT-01', orderNo: `SO-${mmdd}-01`, customerCode: 'C-010', itemCode: 'P-0488', qty: 30000, transport: '차량 1회전', status: '상차', time: null, invoiceNo: null },
    { id: 'OUT-02', orderNo: `${dayN(-2)}-09`, customerCode: 'C-008', itemCode: 'P-0207', qty: 400, transport: '택배', status: '피킹', time: null, invoiceNo: null },
    { id: 'OUT-03', orderNo: `${dayN(-2)}-11`, customerCode: 'C-009', itemCode: 'P-0331', qty: 6000, transport: '택배', status: '피킹', time: null, invoiceNo: null },
    { id: 'OUT-04', orderNo: `SO-${mmdd}-02`, customerCode: 'C-007', itemCode: 'P-0732', qty: 2400, transport: '차량 2회전', status: '출고완료', time: '08:50', invoiceNo: `IV-${ymd}-15` },
    { id: 'OUT-05', orderNo: `${dayN(-1)}-07`, customerCode: 'C-003', itemCode: 'P-2210', qty: 3600, transport: '항공 (수출)', status: '보세창고 이동', time: null, invoiceNo: null, exportId: 'EXP-2606-02' },
    { id: 'OUT-06', orderNo: `SO-${mmdd}-04`, customerCode: 'C-001', itemCode: 'P-1250', qty: 4000, transport: '차량 2회전', status: '생산 중 (42%)', time: null, invoiceNo: null, blocked: true },
    { id: 'OUT-07', orderNo: `${dayN(-1)}-12`, customerCode: 'C-005', itemCode: 'P-5002', qty: 500000, transport: '차량 3회전 (2일)', status: '피킹', time: null, invoiceNo: null },
  ];

  /* ───────── 거래명세서 (이달 발행 누계 ≈ 31.7억 — 연 매출 460억 페이스) ───────── */
  const invoices = [
    { no: `IV-${ymd}-15`, customerCode: 'C-007', orderNos: [`SO-${mmdd}-02`], items: [{ code: 'P-0732', qty: 2400, price: 532 }], supply: 1276800, vat: 127680, total: 1404480, type: '내수', status: '대기', source: '출고 자동생성 08:50' },
    { no: `IV-${ymd}-14`, customerCode: 'C-005', orderNos: [`${dayN(-3)}-05`], items: [{ code: 'P-1077', qty: 1200, price: 230 }], supply: 276000, vat: 27600, total: 303600, type: '내수', status: '대기', source: '출고 자동생성 (전일)' },
    { no: `IV-${ymd}-13`, customerCode: 'C-001', orderNos: [], items: [{ code: 'P-5003', qty: 60000, price: 3950 }], supply: 237000000, vat: 23700000, total: 260700000, type: '내수', status: '대기', source: '출고 자동생성 (전일)' },
    { no: `IV-${ymd}-12`, customerCode: 'C-008', orderNos: [], items: [{ code: 'P-0488', qty: 5000, price: 42 }], supply: 210000, vat: 21000, total: 231000, type: '내수', status: '대기', source: '출고 자동생성 (전일)' },
    { no: `IV-${ymd}-11`, customerCode: 'C-010', orderNos: [`${dayN(-3)}-02`], items: [{ code: 'P-0488', qty: 12000, price: 41 }], supply: 492000, vat: 49200, total: 541200, type: '내수', status: '발행', issuedAt: d(-1) + ' 16:40', source: '출고 자동생성' },
    { no: `IV-${ymd}-10`, customerCode: 'C-009', orderNos: [], items: [{ code: 'P-0331', qty: 4000, price: 92 }], supply: 368000, vat: 0, total: 368000, type: '수출(영세율)', status: '발행', issuedAt: d(-1) + ' 15:20', source: '출고 자동생성' },
    { no: `IV-${ymd}-09`, customerCode: 'C-001', orderNos: [], items: [{ code: 'P-5003', qty: 120000, price: 3950 }], supply: 474000000, vat: 47400000, total: 521400000, type: '내수', status: '발행', issuedAt: d(-2) + ' 17:05', source: '출고 자동생성' },
    { no: `IV-${ymd}-08`, customerCode: 'C-003', orderNos: [], items: [{ code: 'P-5001', qty: 90000, price: 2200 }], supply: 198000000, vat: 0, total: 198000000, type: '수출(영세율)', status: '발행', issuedAt: d(-3) + ' 11:30', source: '출고 자동생성' },
    { no: `IV-${ymd}-07`, customerCode: 'C-002', orderNos: [], items: [{ code: 'P-5001', qty: 250000, price: 2200 }], supply: 550000000, vat: 0, total: 550000000, type: '수출(영세율)', status: '발행', issuedAt: d(-4) + ' 14:10', source: '출고 자동생성' },
    { no: `IV-${ymd}-06`, customerCode: 'C-010', orderNos: [], items: [{ code: 'P-5004', qty: 1800, price: 79000 }], supply: 142200000, vat: 14220000, total: 156420000, type: '내수', status: '발행', issuedAt: d(-5) + ' 16:20', source: '출고 자동생성' },
    { no: `IV-${ymd}-05`, customerCode: 'C-005', orderNos: [], items: [{ code: 'P-5002', qty: 600000, price: 810 }], supply: 486000000, vat: 48600000, total: 534600000, type: '내수', status: '발행', issuedAt: d(-6) + ' 10:40', source: '출고 자동생성' },
    { no: `IV-${ymd}-04`, customerCode: 'C-007', orderNos: [], items: [{ code: 'P-5003', qty: 220000, price: 4130 }], supply: 908600000, vat: 90860000, total: 999460000, type: '내수', status: '발행', issuedAt: d(-7) + ' 15:35', source: '출고 자동생성 (OEM)' },
    { no: `IV-${ymd}-03`, customerCode: 'C-004', orderNos: [], items: [{ code: 'P-5001', qty: 140000, price: 2300 }], supply: 322000000, vat: 0, total: 322000000, type: '수출(영세율)', status: '발행', issuedAt: d(-8) + ' 11:10', source: '출고 자동생성' },
  ];

  /* ───────── 입금 ───────── */
  const payments = [
    { id: 'PM-01', customerCode: 'C-001', amount: 474000000, date: d(-1), method: '계좌이체' },
    { id: 'PM-02', customerCode: 'C-003', amount: 198000000, date: d(-1), method: 'T/T 송금' },
    { id: 'PM-03', customerCode: 'C-010', amount: 142200000, date: d(0), method: '계좌이체' },
    { id: 'PM-04', customerCode: 'C-005', amount: 534600000, date: d(0), method: '계좌이체' },
    { id: 'PM-05', customerCode: 'C-007', amount: 700000000, date: d(-2), method: '계좌이체' },
  ];

  /* ───────── 수출 선적 ───────── */
  const exportShipments = [
    {
      id: 'EXP-2606-01', customerCode: 'C-002', country: '미국', incoterms: 'FOB Busan', portFrom: '부산항', portTo: 'Long Beach', carrier: 'HMM', mode: '해상',
      etd: d(3), eta: d(17), stepIndex: 1, steps: ['서류 준비', '수출신고 · 통관', '선적', '해상운송', '도착 · 인도'],
      items: [{ itemCode: 'P-5001', qty: 240000, priceUsd: 1.62 }, { itemCode: 'P-5002', qty: 200000, priceUsd: 0.60 }],
      ciNo: `CI-${ymd}-01`, plNo: `PL-${ymd}-01`, blNo: '발급 예정', hsCode: '9018.39 / 9018.31', currency: 'USD', fx: 1368, note: 'FDA 등록 시설 — 21 CFR 라벨 검수 완료 · 수액세트는 생산 완료분부터 선적',
    },
    {
      id: 'EXP-2606-02', customerCode: 'C-003', country: '일본', incoterms: 'CIP Tokyo', portFrom: '인천공항', portTo: '나리타', carrier: 'KE Cargo', mode: '항공',
      etd: d(1), eta: d(2), stepIndex: 2, steps: ['서류 준비', '수출신고 · 통관', '선적', '항공운송', '도착 · 인도'],
      items: [{ itemCode: 'P-2210', qty: 3600, priceUsd: 0.21 }, { itemCode: 'P-5001', qty: 60000, priceUsd: 1.65 }],
      ciNo: `CI-${ymd}-02`, plNo: `PL-${ymd}-02`, blNo: 'AWB 180-4421 7702', hsCode: '3923.29 / 9018.39', currency: 'USD', fx: 1368, note: 'PMDA 표기 라벨 v1 적용',
    },
    {
      id: 'EXP-2605-12', customerCode: 'C-004', country: '베트남', incoterms: 'CIF HCMC', portFrom: '부산항', portTo: '호치민 Cat Lai', carrier: 'SITC', mode: '해상',
      etd: d(-6), eta: d(4), stepIndex: 3, steps: ['서류 준비', '수출신고 · 통관', '선적', '해상운송', '도착 · 인도'],
      items: [{ itemCode: 'P-3088', qty: 2400, priceUsd: 0.40 }, { itemCode: 'P-5001', qty: 140000, priceUsd: 1.68 }],
      ciNo: 'CI-260605-04', plNo: 'PL-260605-04', blNo: 'SITC8801-2241', hsCode: '9018.90 / 9018.39', currency: 'USD', fx: 1362, note: '클레임 보전분 1박스(40ea) 동봉',
    },
    {
      id: 'EXP-2605-09', customerCode: 'C-006', country: '독일', incoterms: 'DAP Frankfurt', portFrom: '부산항', portTo: '함부르크', carrier: 'Maersk', mode: '해상',
      etd: d(-32), eta: d(-4), stepIndex: 4, steps: ['서류 준비', '수출신고 · 통관', '선적', '해상운송', '도착 · 인도'],
      items: [{ itemCode: 'P-0207', qty: 2000, priceUsd: 0.31 }, { itemCode: 'P-5003', qty: 24000, priceUsd: 3.10 }],
      ciNo: 'CI-260510-02', plNo: 'PL-260510-02', blNo: 'MAEU-99041 8852', hsCode: '3919.10 / 3822.19', currency: 'USD', fx: 1355, note: 'EU MDR 라벨 재작업분 — 인도 완료',
    },
  ];

  /* ───────── 배송 추적 ───────── */
  const deliveries = [
    { id: 'DLV-01', ref: 'OUT-04', customerCode: 'C-007', carrier: '자사 차량 1호', tno: 'BL-TRK-01', steps: ['출고', '상차', '배송중', '배달완료'], stepIndex: 3, eta: d(0), dest: '대전 유성구 테크노4로 17', times: ['08:50', '09:05', '09:40', '11:20'] },
    { id: 'DLV-02', ref: `IV-${ymd}-12`, customerCode: 'C-008', carrier: 'CJ대한통운', tno: '6128-4402-1190', steps: ['출고', '터미널 입고', '배송중', '배달완료'], stepIndex: 2, eta: d(1), dest: '경기 김포시 양촌읍 황금로 117', times: [d(-1) + ' 16:30', d(-1) + ' 21:10', d(0) + ' 07:40', null] },
    { id: 'DLV-03', ref: `IV-${ymd}-14`, customerCode: 'C-005', carrier: '한진택배', tno: '5011-2298-7741', steps: ['출고', '터미널 입고', '배송중', '배달완료'], stepIndex: 3, eta: d(0), dest: '인천 남동구 논현고잔로 88', times: [d(-1) + ' 16:35', d(-1) + ' 20:55', d(0) + ' 08:10', d(0) + ' 10:48'] },
    { id: 'DLV-04', ref: 'OUT-01', customerCode: 'C-010', carrier: '자사 차량 2호', tno: 'BL-TRK-02', steps: ['출고', '상차', '배송중', '배달완료'], stepIndex: 0, eta: d(0), dest: '서울 송파구 법원로 128', times: [null, null, null, null] },
    { id: 'DLV-05', ref: 'EXP-2606-02', customerCode: 'C-003', carrier: 'KE Cargo (수출 연계)', tno: 'AWB 180-4421 7702', steps: ['보세창고', '수출통관', '항공운송', '현지 인도'], stepIndex: 1, eta: d(2), dest: '東京都 港区 (나리타 경유)', times: [d(0) + ' 13:20', null, null, null] },
  ];

  /* ───────── 창고 입출고 이력 ───────── */
  const movements = [
    { time: d(0) + ' 09:12', type: '입고', code: 'M-0040', name: 'AL 호일 7㎛', qty: '+500kg', ref: `PO-${yymm}-02 · 대한알루미늄`, zone: 'A 원자재' },
    { time: d(0) + ' 08:50', type: '출고', code: 'P-0732', name: '멸균 롤 3중합지', qty: '−2,400m', ref: 'OUT-04 · ㈜바움바이오', zone: 'D 출하장' },
    { time: d(0) + ' 08:40', type: '생산입고', code: 'P-3088', name: '수액백 1L', qty: '+1,380EA', ref: L('C01'), zone: 'B 완제품' },
    { time: d(0) + ' 08:20', type: '생산입고', code: 'P-5002', name: '안전 주사기 1mL', qty: '+26,000EA', ref: L('G01'), zone: 'B 완제품' },
    { time: d(-1) + ' 16:30', type: '출고', code: 'P-0488', name: '멸균 지퍼백 (중)', qty: '−12,000EA', ref: 'SO 출고 · 한솔헬스케어', zone: 'D 출하장' },
    { time: d(-1) + ' 15:10', type: '생산입고', code: 'P-5001', name: '수액세트 20drop', qty: '+22,400EA', ref: '조립 1라인 전일분', zone: 'B 완제품' },
    { time: d(-1) + ' 10:05', type: '입고', code: 'M-0033', name: 'PET 필름 12㎛', qty: '+800kg', ref: `PO-${yymm}-01 · 한솔필름`, zone: 'A 원자재' },
    { time: d(-2) + ' 14:20', type: '조정', code: 'C-031', name: '수출용 외박스', qty: '−12EA', ref: '재고실사 — 파손 폐기', zone: 'A 원자재' },
  ];
  const zones = [
    { id: 'A', name: '원자재 창고', usage: 72, note: 'AL 호일 입고분 적치 완료' },
    { id: 'B', name: '완제품 창고', usage: 61, note: '멸균 검수 통과분만 입고' },
    { id: 'C', name: '멸균 보관실', usage: 38, note: 'EO 멸균 후 7일 에어레이션' },
    { id: 'D', name: '출하장', usage: 4, note: '금일 출고 대기 5건' },
  ];

  /* ───────── 생산계획 ───────── */
  const capacity = {
    people: { avail: 42, total: 46 },
    machines: { avail: 8, total: 10, note: '실링기 #4 정비 · 점보 슬리터 대기' },
    throughput: { used: 121000, total: 138000 },
  };
  const planPriorities = [
    { rank: 1, urgent: true, itemCode: 'P-1250', title: '의료용 PE 보호필름 1250㎜ · 5,500m', badge: '납기 D-1', meta: '㈜한빛메디칼 4,000m + 그린팩메디칼 1,500m 통합 생산 · 압출 1라인 · 예상 7.5h', why: '근거: 납기 D-1 + 가용재고 −1,800m + 동일 품목 수주 2건 통합 시 셋업 1회 절감 (−40분)', woNo: null },
    { rank: 2, urgent: true, itemCode: 'P-5001', title: '수액세트 20drop · 240,000EA (수출)', badge: '선적 ETD D-3', meta: 'Pacific Medical · 조립 1라인 · 일일 60,000EA × 4일 분할', why: '근거: 부산항 ETD D-3 + 가용재고 −60,000EA — 일일 지시 4건 자동 분할, 금일 발행 필수', woNo: `WO-${mmdd}-04` },
    { rank: 3, urgent: false, itemCode: 'P-0915', title: '알루미늄 멸균 파우치 (대) · 12,000EA', badge: '납기 D-2', meta: '모리메디컬 · 제대기 #2 · 예상 5h · 원재료 충분', why: '근거: 가용재고 −7,800EA, 1순위 종료 후 동일조 인원 전환 가능', woNo: null },
    { rank: 4, urgent: false, itemCode: 'P-5003', title: '신속진단키트 콤보 · 80,000EA', badge: '납기 D-6', meta: '㈜한빛메디칼 · 키트 포장 라인 · 일일 26,000~27,000EA × 3일', why: '근거: 가용재고가 적용 안전재고(48,000) 하회 — 진행 중 일일 지시 3건', woNo: `WO-${mmdd}-05` },
    { rank: 5, urgent: false, itemCode: 'P-0331', title: '멸균 스탠드 파우치 (소) · 20,000EA', badge: '안전재고 보충', meta: '수주 없음 · 7월 성수기 대비 선행 생산 · 유휴 시간대 배정', why: '근거: 최근 4주 출고 추세 +18% — 한가한 시간에 미리 생산', woNo: null },
  ];
  const weekBoard = [
    { date: d(-1), label: `${wd(-1)} ${d(-1).slice(5).replace('-', '/')}`, load: 92, jobs: [{ name: '수액세트 (수출분)', qty: '22,400EA · 완료', state: 'gray' }, { name: '멸균 지퍼백(중)', qty: '35,000EA · 완료', state: 'gray' }] },
    { date: d(0), label: `${wd(0)} ${d(0).slice(5).replace('-', '/')} · 오늘`, load: 89, today: true, jobs: [{ name: 'PE 필름 1250㎜', qty: '5,500m · 진행중 42%', state: 'red' }, { name: '진단키트 콤보', qty: '26,000EA · 진행 45%', state: 'amber' }, { name: '안전 주사기', qty: '26,000EA · 완료', state: 'gray' }] },
    { date: d(1), label: `${wd(1)} ${d(1).slice(5).replace('-', '/')}`, load: 84, jobs: [{ name: '수액세트 (수출)', qty: '60,000EA · 일일지시 1/4', state: 'blue' }, { name: '진단키트 콤보', qty: '27,000EA · 일일지시 2/3', state: 'blue' }] },
    { date: d(2), label: `${wd(2)} ${d(2).slice(5).replace('-', '/')}`, load: 78, jobs: [{ name: '수액세트 (수출)', qty: '65,000EA · 일일지시 2/4', state: 'blue' }, { name: '스탠드 파우치(소)', qty: '20,000EA · 선행', state: 'blue' }] },
    { date: d(3), label: `${wd(3)} ${d(3).slice(5).replace('-', '/')}`, load: 52, jobs: [{ name: '수액세트 (수출)', qty: '65,000EA · 일일지시 3/4', state: 'blue' }, { name: '여유 슬롯', qty: '긴급수주 대응 버퍼', state: 'gray' }] },
  ];

  /* ───────── 클레임 · Follow-up ───────── */
  const claims = [
    { customerCode: 'C-001', date: d(-42), type: '포장 불량', desc: '외박스 파손 3건 — 교환 완료', status: '종결' },
    { customerCode: 'C-002', date: d(-27), type: '납기 지연', desc: '선적 5일 지연 — 운임 일부 보전', status: '종결' },
    { customerCode: 'C-004', date: d(-20), type: '수량 부족', desc: '1박스(40ea) 누락 — 차기 출고분 보전 (EXP-2605-12 동봉)', status: '진행중' },
    { customerCode: 'C-006', date: d(-75), type: '라벨 오류', desc: 'EU MDR 표기 누락 — 재라벨링 비용 협의', status: '진행중' },
    { customerCode: 'C-009', date: d(-9), type: '인쇄 번짐', desc: '인디케이터 표기 번짐 200EA — 재발행 완료', status: '종결' },
  ];
  const followUps = [
    { id: 'FU-01', customerCode: 'C-006', date: d(-6), note: '장기 미수금 3.7억 원 — 회수 독촉 2차', done: false },
    { id: 'FU-02', customerCode: 'C-004', date: d(-3), note: '클레임 보전분 출고 확정 + 미수금 회수 협의', done: false },
    { id: 'FU-03', customerCode: 'C-002', date: d(-2), note: '미수금 17.8억 원 입금 일정 확인', done: false },
    { id: 'FU-04', customerCode: 'C-001', date: d(1), note: '3분기 단가 협의 미팅 (진단키트 물량 연동제)', done: false },
    { id: 'FU-05', customerCode: 'C-007', date: d(2), note: 'OEM 스펙 v3 라벨 사진 송부', done: false },
    { id: 'FU-06', customerCode: 'C-009', date: d(4), note: '인디케이터 재발행분 만족도 확인', done: false },
    { id: 'FU-07', customerCode: 'C-003', date: d(7), note: '수액세트 일본 인증(PMDA) 추가 서류 회신', done: false },
    { id: 'FU-08', customerCode: 'C-010', date: d(11), note: '하반기 점보 롤 정기 발주 수요 조사', done: false },
    { id: 'FU-09', customerCode: 'C-005', date: d(14), note: '안전 주사기 연간 단가 계약 협의', done: false },
  ];

  /* ───────── AI 알림 · 활동 로그 ───────── */
  const alerts = [
    { time: '14:28', severity: 'bad', icon: '🌡', title: '실링기 #2 온도 기준 초과 임박', desc: '설정 상한 198℃의 99.4% 도달 (196.8℃). 점검을 권장합니다.', source: 'AI 이상감지 · 센서 스트림' },
    { time: '13:51', severity: 'warn', icon: '⚖', title: `LOT ${L('B01')} 제품 무게 편차 감지`, desc: '평균 대비 −2.3g, 허용 범위(245–255g) 하한 근접.', source: 'AI 이상감지 · 품질정보' },
    { time: '11:02', severity: 'blue', icon: '🔍', title: '기포 불량 증가 원인 분석 완료', desc: '실내 습도 상승(47%→53%)과 상관도 0.81 — 습도 50% 이하 유지 권장.', source: 'AI 불량분석 · 품질×환경 교차분석' },
    { time: '10:30', severity: 'bad', icon: '⚠', title: 'PE 원단(M-0021) 재고 소진 예측 D-4', desc: '현재고 820kg < 적용 안전재고 1,320kg. 동방케미칼 리드타임 3일 — 금일 발주 권장.', source: 'AI 발주 제안 · 소비 추세' },
    { time: '09:45', severity: 'warn', icon: '◷', title: `Pacific 수액세트 일일 지시 발행 대기`, desc: `WO-${mmdd}-04 일일 60,000EA × 4일 분할 완료 — 선적 ETD 역산 시 금일 발행 필수.`, source: '생산능력 시뮬레이션 · 일일 지시 분할' },
    { time: '09:10', severity: 'blue', icon: '⛴', title: 'Pacific Medical 수출 선적 ETD D-3', desc: '수출신고 서류 준비 완료 — 수액세트 240,000EA 일일 분할 생산 착수 필요.', source: '수출 일정 × 생산계획 연동' },
    { time: '12:00', severity: 'ok', icon: '✓', title: 'ERP 실적 자동 등록 완료', desc: '오전 마감분 23건 전송 성공.', source: '시스템' },
  ];
  const activities = [
    { time: d(0) + ' 14:31', who: '김현우', action: '공정일지 작성 · 자동 저장 → ERP 실적 등록', ref: L('B01') },
    { time: d(0) + ' 14:02', who: '장다슬', action: '공정일지 작성 · 자동 저장', ref: L('A03') },
    { time: d(0) + ' 13:24', who: '박소연', action: '기포테스트 결과 입력 (합격)', ref: L('C02') },
    { time: d(0) + ' 11:50', who: '문가영', action: `일일 생산지시 실적 등록 (WO-${mmdd}-05 · 11,800/26,000)`, ref: L('K01') },
    { time: d(0) + ' 09:12', who: '강민준', action: `구매 입고 처리 (PO-${yymm}-02 · AL 호일 500kg)`, ref: 'M-0040' },
    { time: d(0) + ' 08:50', who: '강민준', action: '출고 확정 → 거래명세서 자동 생성', ref: 'OUT-04' },
  ];

  /* ───────── 주간 수주/출고 추이 ───────── */
  const weekTrend = [-6, -5, -4, -3, -2, -1, 0].map((off, i) => ({
    date: d(off).slice(5).replace('-', '/'),
    label: off === 0 ? '오늘' : d(off).slice(5).replace('-', '/'),
    inAmt: [55, 70, 42, 30, 78, 88, 64][i],
    outAmt: [48, 62, 58, 25, 66, 74, 40][i],
  }));

  return {
    meta: {
      company: '비엘테크 (BL-tech)', brand: 'BL-tech MediERP', industry: '의료용 멸균 포장재 · 의료용품 제조/수출',
      cert: 'ISO 13485 · GMP', seededAt: today, todayPlan: 64000, todayLogs: 47, specLibrary: 142, specVendors: 28,
      ceo: '배진우',
      user: { name: '진은명', role: '영업팀 매니저', avatar: '진' },
    },
    items, rawMaterials, customers, suppliers, employees, machines,
    orders, workOrders, workLogs, lots, qualityRecords, qcStats, materialBatches,
    purchaseOrders, shipments, invoices, payments, exportShipments, deliveries,
    movements, zones, capacity, planPriorities, weekBoard,
    claims, followUps, alerts, activities, weekTrend,
    seq: { order: 6, wo: 6, po: 6, invoice: 16, payment: 6, worklog: 48, out: 8, dlv: 6 },
  };
}

module.exports = { buildSeed };
