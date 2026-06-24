# AI 튜터 (가칭) — 시스템 아키텍처 문서

> 작성일: 2026-06-22
> 상태: 초안 (MVP 설계 기준)
> 한 줄 요약: 사진을 찍으면 **답을 알려주지 않고** 힌트·해석·풀이 방향을 제시하는, **교사 관리형** AI 학습 튜터. MVP는 **수학 단일 과목 / 모바일 웹(PWA)**.

---

## 1. 제품 개요

### 1.1 핵심 가치 제안
- 학생이 문제 사진을 찍으면, AI가 **답 대신** 힌트·개념·해석·풀이 방향을 소크라테스식으로 제공한다.
- **과외 선생님이 학생의 대화 내용을 모니터링**할 수 있다. (B2B2C — 순수 B2C 풀이앱과의 결정적 차별점)
- 학생의 오답·약점 데이터를 누적해 **오답 모의고사 / 변형문제**로 확장한다. (락인)

### 1.2 차별점 vs 경쟁
| | 콴다/Photomath | Khanmigo | **본 제품** |
|---|---|---|---|
| 답 제공 | 즉시 제공 | 안 줌(소크라테스) | **안 줌(소크라테스)** |
| 교사 모니터링 | ✕ | 제한적 | **핵심 기능** |
| 학습 데이터 누적 | 약함 | 있음 | **오답→모의고사 락인** |
| 초기 사용자 | 콜드스타트 | 학교 채널 | **기존 과외생(콜드스타트 없음)** |

### 1.3 비목표 (MVP 범위 밖, YAGNI)
- 영어 과목, 듣기 생성 → Phase 3
- 네이티브 앱 → 모바일 웹/PWA 검증 후 검토
- 결제·구독 시스템 → 유료화 전환 시점에
- 모의고사/변형문제 생성 → Phase 2

---

## 2. 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 프론트엔드 | Next.js (App Router) + PWA | 모바일 웹 카메라 접근, Vercel 배포 일체화 |
| 호스팅 | Vercel | Next.js 네이티브, 미리보기 배포 |
| DB / 인증 | **Supabase (Postgres + Auth + RLS)** | 역할 계층·"자기 학생만 조회"가 RLS와 정확히 매칭 |
| 이미지 저장 | Cloudflare R2 (또는 Supabase Storage) | egress 비용 저렴. 초기엔 Supabase Storage로 단순화 가능 |
| LLM | **GPT-5** (멀티모달 vision + 추론) | 사진→문제 인식 별도 OCR 없이 처리. 수학 추론 정확도·비용 우수. LLM 레이어는 어댑터로 추상화해 교체 가능하게 둠 |
| 수식 렌더 | KaTeX | 빠른 클라이언트 렌더 |
| 2D 그래프/도형 | GeoGebra 임베드 또는 Desmos API | 한국 교과 도형 호환 |
| 3D 공간도형 | GeoGebra 3D (대안: three.js) | 교과 도형엔 GeoGebra가 적합 |
| 푸시 알림 | **Web Push (VAPID) + `web-push`** | DB와 독립. Firebase 불필요. FCM은 전송용으로만 선택적 병용 |

### 2.1 DB 선택: Supabase vs Firebase (확정 근거)
- 요구사항 핵심이 **관리자→선생님→학생 역할 계층 + "선생님은 자기 학생 데이터만 조회"**.
- 이는 관계형 + **Row Level Security**가 정확히 맞는 구조. Firestore 보안 규칙으로는 계층·소유권 제약이 급격히 복잡해짐.
- 오답 누적→모의고사 생성은 **집계·조인 쿼리**가 많아 SQL 유리.
- **푸시 알림은 DB 선택과 무관**: 웹 푸시는 Web Push(VAPID) 표준이며 Firebase 없이 동작. FCM이 필요하면 전송 트랜스포트로만 병용 가능 → 푸시 때문에 Firestore로 갈 이유 없음. (상세: [architecture-english.md](architecture-english.md) §6)

---

## 3. 역할(Role) 및 권한 모델

### 3.1 계층 구조
```
관리자(admin)  ──등록──▶  선생님(teacher)  ──등록──▶  학생(student)
```
- 각 상위 역할이 직속 하위 역할을 **등록/조회/수정/삭제(CRUD)** 한다.
- 선생님: 자기 학생만 CRUD + 자기 학생의 **대화 로그 조회**.
- 학생: 자기 자신의 학습/대화만 접근. 수학 외 질문 불가(가드레일).
- 관리자: 선생님 CRUD. (학생 전체 조회는 정책상 결정 필요 — 기본은 불가/감사 목적만)

### 3.2 핵심 권한 규칙 (RLS로 강제)
| 주체 | 대상 | 권한 |
|---|---|---|
| admin | teachers | CRUD |
| teacher | 자신이 등록한 students | CRUD |
| teacher | 자기 학생의 conversations | READ |
| student | 자신의 conversations | CRUD(생성·조회) |
| student | 타인 데이터 | 접근 불가 |

> ⚠️ 권한은 프론트가 아니라 **DB의 RLS 정책에서 강제**한다. 프론트 가드는 UX용일 뿐.

---

## 4. 데이터 모델 (초안)

```
profiles
  id (uuid, = auth.users.id)
  role (enum: admin | teacher | student)
  display_name
  created_by (uuid, 등록한 상위 사용자)   -- 계층·소유권의 핵심
  grade (int, nullable)                    -- 학년 → 교과과정 범위 결정
  created_at

teacher_students  (선생님↔학생 매핑; 1선생-다학생, 향후 다대다 대비)
  teacher_id (uuid)
  student_id (uuid)

conversations  (한 문제에 대한 대화 세션)
  id
  student_id (uuid)
  subject (enum: math)        -- MVP는 math 고정, 확장 대비 컬럼화
  problem_image_url           -- R2/Storage 키
  problem_text                -- vision이 추출한 문제 텍스트(검토용)
  mode (enum: solve | review) -- solve=미공개 문제, review=답지 해설 질문
  status (enum: active | resolved)
  understanding_score (int 0~100, default 0)  -- 이해도 게이팅(§5). 답 공개는 ≥90에서만
  answer_disclosed (bool, default false)      -- 이 대화에서 답이 공개됐는가
  created_at

messages
  id
  conversation_id (uuid)
  sender (enum: student | assistant)
  content (text, KaTeX 포함 가능)
  guardrail_flag (enum: ok | blocked_offtopic | redacted_premature_answer | answer_disclosed)
  understanding_at_turn (int 0~100)  -- 이 턴 시점의 이해도 추정(루브릭 디버깅·교사 모니터링용)
  created_at

-- Phase 2 확장 예정
problem_attempts / mistakes  (오답 누적)
  student_id, conversation_id, topic_tag, was_correct, ...
```

---

## 5. 이해도 게이팅 가드레일 아키텍처 (제품 정체성)

> **원칙은 "절대 안 줌"이 아니라 "쉽게 안 줌"이다.** 답은 언젠가 줘야 한다 — 핵심은 *타이밍*이다. 학생의 이해가 정답에 충분히 근접했다고 판단될 때만(이해도 ≥90%), 남은 부분을 마저 설명하며 답을 공개한다. 그 전까지는 학생이 답을 찍어 물어도("정답 1번이지?") 답을 확인해주지 않고 근거를 되묻는다.

### 5.1 핵심 개념: 이해도 점수(Understanding Score)
- 대화가 진행되며 AI가 학생의 이해도를 **0~100으로 추정**하고 `conversations.understanding_score`에 갱신한다.
- 이 점수는 **느낌이 아니라 명시적 루브릭(§5.4)** 으로 산출한다. 모델 관대화(leniency drift)·학생의 이해한 척(faking) 방지가 이 점수의 신뢰성을 좌우한다.
- 점수 구간별 행동(disclosure gate):

| 이해도 | AI 행동 |
|---|---|
| ~50% | 개념 재정립·기초 힌트. 정답 근처 질문 유도. |
| 50~89% | 단계적 힌트. 학생이 답을 찍으면 **반드시 "왜 그렇게 생각해?"** 로 근거 요구. |
| **≥90%** | **답 공개 허용.** 남은 10%(놓친 디테일·검산)를 설명하며 정답을 확정해준다. |

### 5.2 "정답 1번이지?" 처리 규칙 (제품의 시그니처 동작)
이해도 90% 미만에서 학생이 답을 추측해 물으면:
1. **실제 답이 맞든 틀리든** 곧바로 확인해주지 않는다 → "왜 그렇게 생각했어?"
2. 학생이 **근거를 댄다**:
   - 근거가 타당 + 이해도 90% 도달 → "맞아, 그 논리가 정확해" (이때 비로소 확정)
   - 근거가 부실/틀림 → **타깃 힌트**: "ㅇㅇㅇ를 기준으로 다시 생각해봐", "왜 ㅇㅇㅇ이 나오는지를 먼저 따져봐"
3. 즉, **정답 일치 여부가 아니라 "근거의 타당성 + 이해도"** 가 답 확정의 조건이다. 우연히 찍어 맞힌 것에는 답을 확정해주지 않는다.

### 5.3 요청 파이프라인
```
학생 입력(+이미지)
   │
   ▼
[1] 입력 가드 — 과목/주제 분류
     · 수학 외 질문 → 차단(blocked_offtopic), 정중히 거절
   │
   ▼
[2] 이해도 평가 (루브릭 기반)
     · 직전 대화 + 이번 발화로 understanding_score 갱신
     · 학생이 답을 추측했는가? 근거를 제시했는가? 판정
   │
   ▼
[3] 메인 튜터 호출 (GPT-5)
     · 시스템 프롬프트: 학년(grade)별 교과 범위 + 현재 이해도 점수 주입
     · 게이트 분기:
         - <90% : 답·완성 풀이 금지. 추측엔 "왜 그렇게 생각해?" 또는 타깃 힌트
         - ≥90% : 답 공개 허용 + 남은 부분 설명하며 확정
     · 모드 분기(solve/review)는 5.5 참조
   │
   ▼
[4] 출력 검증 레이어 (별도 판정)
     · 이해도<90%인데 답/완성 풀이가 노출됐는가? → redact + 재생성
     · 이해도≥90%면 답 공개 통과(answer_disclosed로 기록)
   │
   ▼
학생에게 전달 + messages에 (guardrail_flag, 그 시점 understanding_score) 저장
```

### 5.4 이해도 루브릭 (점수의 신뢰성이 제품 품질을 결정)
점수는 다음 **관측 가능한 근거**로만 산출한다(추상적 "이해한 것 같다" 금지):
- 학생이 **자기 말로** 핵심 개념/관계를 설명했는가
- 풀이의 **다음 단계를 스스로** 제시했는가
- 왜 그 방법이 성립하는지 **근거**를 댔는가 (단순 정답 추측 ✕)
- 오답 선택지를 **왜 배제하는지** 설명했는가
- 힌트를 받은 뒤 **스스로 연결**해 진전을 보였는가

> ⚠️ **안티-게이밍**: "이해했어요/알겠어요" 같은 *주장*은 점수에 반영하지 않는다. 오직 *시연된 추론*만 반영. 학생이 핵심 단계를 직접 재현하지 못하면 90%에 도달하지 못한다.

### 5.5 모드 구분 (게이트와 직교)
- **solve 모드**: 미공개 문제 풀이. 이해도 게이트 적용(≥90%에서만 답 공개).
- **review 모드**: 답지·해설이 이미 존재. "이 줄이 왜 이렇게 넘어가요?" 같은 해설 질문 허용(답이 이미 공개돼 있으므로 게이트 완화). 단 다른 미공개 문제로 새지 않게 경계.
- 모드는 업로드 시 "답지/해설 포함 여부" 또는 명시적 토글로 결정.

### 5.6 학년 기반 교과 스코핑
- `profiles.grade` → 해당 학년 교과과정 내 개념·도구로만 유도(예: 중3에게 미적분 도구 강요 금지).
- 시스템 프롬프트에 학년별 허용 개념 범위를 주입.

### 5.7 테스트 전략
- **레드팀 프롬프트 셋**: 우회 시도 50~100개("마지막 한 줄만", "검산용으로 답만", "이해했으니 답 줘", 역할극 유도, **이해한 척 흉내**)를 자동 회귀 테스트로.
- **조기 공개율(premature-disclosure rate)**: 이해도<90%인데 답이 노출된 비율 — 핵심 실패 지표.
- **게이트 정확도**: 실제 이해 못 한 학생을 90%로 잘못 판정하는 위양성(false-positive) 추적.

---

## 6. 수식·도형 렌더링

- **수식**: LLM이 LaTeX로 출력 → 클라이언트에서 KaTeX 렌더.
- **2D 그래프/함수/도형**: GeoGebra 임베드 또는 Desmos. LLM은 식/파라미터만 생성, 렌더는 라이브러리가 담당(환각 도형 방지).
- **3D 공간도형**: GeoGebra 3D 임베드. LLM이 좌표·도형 정의를 생성.
- 원칙: **그림은 LLM이 직접 그리지 않고**, LLM은 "렌더 명세(식·좌표)"만 만들고 검증된 라이브러리가 그린다.

---

## 7. 이미지 파이프라인
```
모바일 카메라/갤러리 → 클라이언트 리사이즈/압축
  → 업로드(R2/Storage) → URL 발급
  → GPT-5 vision에 이미지 전달 → 문제 텍스트·수식 추출
  → conversations.problem_text 저장(검토·검색용)
```
- PWA에서 `<input capture>` 또는 getUserMedia로 카메라 접근.
- 원본은 비공개 버킷, 서명 URL로만 접근.

---

## 8. 단계별 로드맵

### Phase 0 — 가설 검증 (코드 최소)
- 답 안 주는 튜터 프롬프트 + 가드레일 초안을 과외생 소수에게 수동 검증.
- 레드팀 프롬프트 셋 초안 작성, 누설율 베이스라인 측정.

### Phase 1 — MVP (수학 / 모바일 웹 PWA)
1. Supabase 인증 + 역할 계층 + RLS 정책
2. 선생님: 학생 CRUD 페이지
3. 학생: 사진 업로드 → 힌트 대화(solve/review 모드)
4. 답 누설 가드레일 파이프라인(입력 가드 + 출력 검증)
5. 선생님: 학생 대화 로그 조회 페이지
6. KaTeX 수식 렌더 + GeoGebra 도형 임베드

### Phase 2 — 학습 데이터 누적
- 오답 노트, 약점 태깅, **오답 모의고사 / 변형문제 생성**.

### Phase 3 — 과목·교과 확장
- 영어(독해·문법), 영어 듣기 생성, 타 교과 확장.

---

## 8.5 LLM 모델 및 비용 (확정: GPT-5)

- **메인 튜터/비전/이해도 판정: GPT-5.** 수학 추론 정확도와 출력 단가에서 유리. LLM 호출은 어댑터로 추상화해 추후 교체·라우팅 가능하게 둔다.
- **문제당 비용(8턴 세션, 턴당 출력 ~1.2K토큰 가정) 추정**: GPT-5 기준 **~$0.10–0.15/문제**, GPT-5 mini로 라우팅 시 ~$0.02–0.04. 학생 1명 월 100문제 기준 GPT-5 ~$12/월.
- **비용 최대 변수 = 추론(reasoning) 토큰량.** 어려운 문제에서 턴당 토큰이 급증하므로 **난이도별 reasoning effort 조절 + 쉬운 문제는 GPT-5 mini 라우팅**이 핵심 절감 레버.
- ⚠️ 단가는 변동되므로 [platform.openai.com/pricing](https://platform.openai.com/pricing)에서 확인. 실제 문제당 비용은 Phase 0 파일럿에서 측정 확정.

## 8.6 과목 배정·자동분류·진입 플로우 (구현됨)

- **과목 배정**: `profiles.allowed_subjects subject_t[]` (수학만/영어만/둘다). 교사가 학생 등록 시 지정.
- **진입 CTA 2종** (학생 `/learn`):
  - **📷 문제 찍기** — 사진 업로드 → R2 → **자동 분류**(gpt-5-mini vision) → 배정 과목이면 대화 생성, 아니면 차단(`/learn?blocked=`).
  - **💬 개념 질문** — 사진 없이 시작. 배정 과목 1개면 그 과목, 2개면 첫 메시지에서 분류. `conversations.is_concept=true`.
- **서브에이전트 라우팅**: 분류된 `subject`로 과목별 시스템 프롬프트 선택(수학 가드레일 vs 영어 가드레일). `src/lib/classify.ts` → `src/lib/prompts.ts`.
- **차단**: 분류 결과가 `other`이거나 배정 과목이 아니면 진행 차단(예: 영어만 배정 학생이 수학 업로드 → 막힘). `/api/tutor`에도 방어 로직 중복.
- **개념 모드**: `is_concept=true`면 답-게이팅 미적용 — 개념을 학년 수준으로 자유롭게 설명(누설 검증 skip).
- **스키마 변경**: `conversations.subject` nullable화(개념질문 지연 분류용), `conversations.is_concept` 추가.

## 8.7 숙제 출제 (교사) — 구현됨

- **대화 요약**: 첫 튜터 턴에서 `conversations.summary`(한 줄)를 gpt-5-mini로 생성·저장 → 교사 리스트 표시용.
- **출제 UI**(`/teacher/students/[id]`): 학생 대화 목록을 체크박스로 다중선택 + 문제 수 + 마감(datetime) → "숙제 내기".
- **유사문제 생성**: 선택 대화 요약을 토픽으로 GPT-5가 비슷한 유형 N개 생성(정답 미포함). `src/lib/homework.ts`.
- **스키마**: `assignments`(teacher/student/title/deadline/status), `assignment_problems`(position/problem_text). 정답은 저장 안 함 — 채점(③) 시 GPT-5가 직접 풀어 비교.
- **RLS**: 교사는 자기 과제 CRUD, 학생은 자기 과제·문제 읽기.
- 미구현(다음): ③ 학생 풀이 사진 업로드 → 자동채점, ④ 알림(Web Push).

## 8.8 숙제 자동채점 (학생) + 로그인 아이디 — 구현됨

- **로그인 아이디**: 이메일 형식 불필요. 일반 문자열(4자+, `[a-zA-Z0-9._-]`)을 받아 내부적으로 `id@yourmentor.local` 합성 이메일로 Supabase Auth에 사용(`src/lib/auth-id.ts`). 기존 `@` 포함 이메일은 그대로. `profiles.login_id`에 표시용 저장.
- **자동채점 흐름**(문제별): `/learn/homework/[id]`에서 문제마다 **풀이 사진 1장 업로드** → `/api/grade` → GPT-5 비전 채점.
  - 맞음 → ✅ 종료.
  - 1차 오답 → 어디가 틀렸는지 피드백 + "다시 한 번 풀어봐"(정답 비공개).
  - 2차 오답 → 📘 전체 풀이·정답 공개하고 종료.
  - 모든 문제 종료 시 `assignments.status='graded'`.
- **스키마**: `assignment_problems`에 attempts/resolved/correct/feedback/submission_url, `assignments.subject` 추가.
- 채점 쓰기는 service_role(admin)로 처리(학생 소유 확인 후) — RLS 완화 없이.
- 미구현: ④ 알림(Web Push) — 숙제 출제·채점 시.

## 9. 미해결/결정 필요 사항
- [ ] 제품 이름 (보류 중)
- [ ] 관리자가 전 학생 데이터 조회 가능 여부(프라이버시 정책)
- [ ] 학생당/문제당 토큰 예산 상한값 (Phase 0 측정 후 확정)
- [ ] review 모드 진입 방식(업로드 시 선택 vs 대화 중 토글)
- [ ] teacher_students 다대다 필요 시점(한 학생을 여러 선생이 보는가)
- [x] 이미지 저장: **Cloudflare R2 확정** (버킷 `your-mentor`, public URL 발급). 업로드는 서버에서 S3 호환 API로.
