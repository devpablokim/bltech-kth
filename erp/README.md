# BL-tech MediERP — 비엘테크 의료용품 통합 ERP

의료용 멸균 포장재·의료용품을 **생산·수출·개발·판매**하는 비엘테크(BL-tech)의 통합 ERP.
영업 마스터 데이터 정의(진은명) · 생판재 통합대시보드 · SmartLog 생산관리 · AI 영업지원(SFA) · 생산공정일지 자동화 PPT(장다슬)의 모든 모듈을 하나의 서버 기반 시스템으로 통합했다.

## 실행

```bash
cd erp
npm start          # http://localhost:3000  (외부 의존성 0개 — npm install 불필요, Node 18+)
npm run reset      # DB 초기화 (다음 실행 시 시드 데이터 재생성)
```

- **모든 기능이 서버단에서 동작**: 집계·재고 판정·LOT 채번·품질 판정(AI 이상감지)·명세서 생성·미수금 재계산·문서 생성이 전부 REST API에서 수행되고, 프론트는 결과만 렌더링.
- 데이터는 `data/db.json`에 영속화. 시드는 기동 시점 기준 상대 날짜로 생성되어 언제 실행해도 "오늘"이 살아있다.
- `ANTHROPIC_API_KEY` 환경변수 설정 시 AI 비서·제안서·브리핑·이메일·시장분석이 Claude API로 보강된다 (없으면 서버 내장 룰 엔진으로 동작 — 기능 저하 없음).

```bash
ANTHROPIC_API_KEY=sk-... CLAUDE_MODEL=claude-sonnet-4-6 npm start
```

로컬에서는 `erp/data/.env`에 `ANTHROPIC_API_KEY=...`를 넣어두면 서버가 기동 시 자동 로드한다 (gitignore 대상 — 커밋되지 않음).

## Vercel 배포 (기존주소/dashboard)

- **프론트엔드**: `vercel.json` 리라이트로 `기존주소/dashboard` → `erp/public/` 서빙 (test1 PMS 루트 서빙은 그대로 유지)
- **백엔드**: `api/[[...path]].js` 서버리스 함수가 모든 `/api/*` 요청을 동일한 ERP 라우터(`erp/lib/api.js`)로 위임 — 비즈니스 로직 전부 서버단 동작 유지
- **DB**: 서버리스 환경은 파일시스템이 읽기 전용이라 `/tmp`에 영속화 (웜 인스턴스 동안 유지, 콜드 스타트 시 시드 재생성 — 데모 운영 모드)
- **Claude 연동**: Vercel 프로젝트 Settings → Environment Variables에 `ANTHROPIC_API_KEY` 등록 시 활성화 (미등록 시 내장 룰 엔진으로 동작)

## 좌측 탭 구성 (원천 자료 매핑)

| 그룹 | 탭 | 원천 자료 |
|---|---|---|
| OVERVIEW | 통합 현황 (수주→재고→생산→출고→명세서 파이프라인) | 생판재 ONE 대시보드 |
| 영업·판매 | 수주 관리(엑셀 자동분석), 거래처 관리(CRM), AI 제안서, 시장·경쟁 분석, Follow-up | 생판재 ONE + SFA + 영업 마스터 정의 |
| 생산 | 생산 현황, 작업지시·OEM 스펙, 공정일지 입력, 생산 LOT, 품질 관리, 원재료·배합, 생산계획, 작업자 | SmartLog + 공정일지 자동화 PPT |
| 구매 | 구매 발주(AI 발주 제안 연동), 공급처 | 신규 (요구사항) |
| 물류·재고 | 재고 현황(가용재고=현재고−수주잔량), 창고·입출고 | 생판재 ONE + 신규 |
| 유통·배송 | 출고 관리(확정=명세서 트리거), 배송 추적, 수출 선적(C/I·B/L·통관) | 생판재 ONE + SFA 해외거래처 + 신규 |
| 원가·회계 | 원가 관리(BOM 원가계산), 거래명세서, 매출·미수금(채권관리) | 영업 마스터 정의 2단계 + 신규 |
| 기준정보 | 품목·단가 마스터(A+/A/B/C 등급), 사원·조직 | 영업 마스터 데이터 정의 |
| AI | AI 통합 비서(자연어 질의) | SmartLog AI 비서 + 생판재 AI 운영 비서 |

## 아키텍처

```
erp/
├─ server.js          # Node 내장 http 서버 (정적 파일 + /api 라우팅)
├─ lib/
│  ├─ seed.js         # 시드 데이터 (의료용품 마스터·트랜잭션, 상대 날짜)
│  ├─ db.js           # JSON 파일 영속화 (data/db.json)
│  ├─ api.js          # REST API 60여 개 + 비즈니스 로직 (재고판정·LOT채번·명세서·채권)
│  └─ ai.js           # AI 룰 엔진 + 선택적 Claude API (질의/브리핑/제안서/이메일/시장분석)
└─ public/            # SPA 프론트엔드 (vanilla JS — 서버 API 호출만 수행)
```

### 대표 서버 트랜잭션

- `POST /api/orders/upload` — CSV/샘플 수주를 서버가 파싱 → 거래처 별칭 매칭 → 단가등급 자동 적용 → 가용재고 판정
- `POST /api/production/worklogs` — 공정일지 저장 → LOT 자동 채번 → 완제품 재고 입고 → 품질 판정(온도/무게/습도/기포 기준) → AI 이상감지 알림 → ERP 실적 등록
- `POST /api/shipping/:id/advance` — 출고 확정 → 재고 차감 → 거래명세서 자동 생성(수출은 영세율/C-I 연계) → 배송 추적 시작 → 수주 마감
- `POST /api/purchase/orders/:no/receive` — 입고 처리 → 원자재 재고 반영 → 창고 입출고 이력
- `POST /api/finance/payments` — 입금 등록 → 거래처 미수금 자동 재계산
