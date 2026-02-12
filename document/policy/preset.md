# 🎯 Preset 정책의 역할 정의

**Preset = “의도 기반 잠금 정책 템플릿”**

- 교사/부모가  
    👉 _앱 하나하나 선택하지 않아도_  
    👉 _상황에 맞는 잠금 정책을 즉시 적용_
    
- QR / 예약잠금 / 즉시잠금 전부 동일하게 사용

---

# 1️⃣ Preset UX 설계 (교사 / 부모 공통)

## 🔹 Preset 선택 진입점

### 교사

- 수업 생성 시
- QR 생성 시
- 수업 시작 버튼 클릭 시

### 부모

- 자녀 잠금 시작 버튼
- 고정형 QR 생성
- 시간표 기반 예약 설정

---

## 🔹 Preset 선택 화면 (1차)

> **“어떤 상황인가요?”**

### Preset 카드 UI 예시

| 아이콘      | Preset 이름 | 설명           |
| -------- | --------- | ------------ |
| 🎓       | 수업 집중     | 학습 앱만 허용     |
| 📝       | 시험 모드     | 모든 앱 차단      |
| 📚       | 자율 학습     | 교육 + 도구 허용   |
| 🏠       | 집에서 공부    | 게임/소셜 차단     |
| 🌙       | 취침 시간     | 통신 앱만 허용     |
| 👨‍👩‍👧.      | 부모 관리     | 보호자 지정 앱만 허용 |

👉 **설명 문구 중요** (심사용/신뢰도)

---

## 🔹 Preset 상세 미리보기 (2차)

Preset 선택 시 바로 적용 ❌  
👉 **“이렇게 잠깁니다” 미리보기**

### 예시

```
허용 카테고리:
✔ EDUCATION
✔ UTILITIES

차단:
✖ GAMES
✖ SOCIAL
✖ ENTERTAINMENT
```

- 교사/부모는 여기서 **커스터마이즈 가능 (선택)**

---

## 🔹 커스터마이즈 (Optional)

- 허용 카테고리 추가/제거
- 특정 앱 예외 허용
- 잠금 시간 수정
    

📌 **수정해도 Preset 원본은 유지**  
→ “내 Preset”으로 저장 가능

---

# 2️⃣ Preset 정책 타입 분류

```text
SYSTEM_PRESET   (락모먼트 제공, 수정 불가)
ORG_PRESET      (기관 공용)
USER_PRESET     (부모/교사 개인)
```



# ✅ Preset 정책 최종 설계 (신규 생성 기준)

## 0️⃣ 설계 요약 (핵심만)

|구분|내용|
|---|---|
|Preset 목적|잠금 / 출석 / 잠금+출석|
|QR 사용|출석 전용 QR 가능|
|Scope|SYSTEM / ORG / USER|
|잠금 정책|ATTENDANCE_ONLY 에서는 **완전 비활성**|
|통계|preset_usage 로 추적|

---

# 1️⃣ ENUM 정의 (먼저 실행)

```sql
-- Preset 소유 범위
CREATE TYPE preset_scope_enum AS ENUM (
  'SYSTEM',  -- 락모먼트 제공
  'ORG',     -- 기관 공용
  'USER'     -- 부모/교사 개인
);

-- Preset 목적 (핵심)
CREATE TYPE preset_purpose_enum AS ENUM (
  'LOCK_ONLY',
  'ATTENDANCE_ONLY',
  'LOCK_AND_ATTENDANCE'
);

-- 잠금 타입
CREATE TYPE lock_type_enum AS ENUM (
  'FULL',      -- 전체 잠금
  'APP_ONLY'   -- 앱 잠금
);

-- Preset 적용 대상
CREATE TYPE preset_target_enum AS ENUM (
  'STUDENT',
  'DEVICE',
  'CLASS'
);
```

---

# 2️⃣ preset_policies 테이블 (핵심 테이블)

```sql
CREATE TABLE preset_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SYSTEM / ORG / USER
  scope preset_scope_enum NOT NULL,

  -- SYSTEM = NULL
  -- ORG    = organization_id
  -- USER   = user_id
  owner_id UUID NULL,

  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 🔑 Preset 목적 (잠금 / 출석 / 둘다)
  purpose preset_purpose_enum NOT NULL DEFAULT 'LOCK_AND_ATTENDANCE',

  -- 🔐 잠금 관련 (ATTENDANCE_ONLY 에서는 NULL)
  lock_type lock_type_enum,
  allowed_categories JSONB,
  blocked_categories JSONB,
  allowed_apps JSONB,
  default_duration_minutes INT,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 🔒 출석 전용 preset 무결성 보장
  CONSTRAINT chk_attendance_only_preset
    CHECK (
      purpose <> 'ATTENDANCE_ONLY'
      OR (
        lock_type IS NULL
        AND allowed_categories IS NULL
        AND blocked_categories IS NULL
        AND allowed_apps IS NULL
        AND default_duration_minutes IS NULL
      )
    )
);
```

---

## 📌 인덱스 (실운영 필수)

```sql
-- scope + owner 기준 조회 (기관/유저 preset 목록)
CREATE INDEX idx_preset_policies_scope_owner
  ON preset_policies(scope, owner_id);

-- 활성 preset 빠른 조회
CREATE INDEX idx_preset_policies_active
  ON preset_policies(is_active);

-- purpose 필터 (출석 전용 / 잠금 전용)
CREATE INDEX idx_preset_policies_purpose
  ON preset_policies(purpose);
```

---

# 3️⃣ preset_usage 테이블 (사용 추적 & 통계)

```sql
CREATE TABLE preset_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  preset_id UUID NOT NULL
    REFERENCES preset_policies(id)
    ON DELETE CASCADE,

  used_by UUID NOT NULL
    REFERENCES users(id),

  target_type preset_target_enum NOT NULL,
  target_id UUID NOT NULL,

  purpose preset_purpose_enum NOT NULL,

  -- 잠금 preset일 경우만 연결
  applied_policy_id UUID
    REFERENCES lock_policies(id),

  applied_at TIMESTAMPTZ DEFAULT now()
);
```

### 인덱스

```sql
CREATE INDEX idx_preset_usage_preset
  ON preset_usage(preset_id);

CREATE INDEX idx_preset_usage_used_by
  ON preset_usage(used_by);

CREATE INDEX idx_preset_usage_target
  ON preset_usage(target_type, target_id);

CREATE INDEX idx_preset_usage_applied_at
  ON preset_usage(applied_at);
```

---

# 4️⃣ lock_policies 테이블 (Preset 연계 전제)

> 아직 생성 전이라면 **처음부터 아래 구조로 가는 걸 추천**

```sql
CREATE TABLE lock_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  preset_id UUID
    REFERENCES preset_policies(id),

  purpose preset_purpose_enum NOT NULL DEFAULT 'LOCK_ONLY',

  lock_type lock_type_enum NOT NULL,
  allowed_categories JSONB,
  blocked_categories JSONB,
  allowed_apps JSONB,

  duration_minutes INT NOT NULL,

  is_customized BOOLEAN DEFAULT FALSE,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

# 5️⃣ QR 생성 시 동작 매핑 (서버 로직 기준)

|preset.purpose|lock_policies 생성|출석 기록|
|---|---|---|
|ATTENDANCE_ONLY|❌|✅|
|LOCK_ONLY|✅|❌|
|LOCK_AND_ATTENDANCE|✅|✅|

---

# 6️⃣ 이 설계의 장점

✔ **출석 전용 QR 완벽 지원**  
✔ 학원/학교 실사용 시나리오 100% 커버  
✔ Apple / Kakao 심사 설명 쉬움  
✔ 통계 / 추천 preset / UX 개선까지 확장 가능  
✔ 나중에 “시험모드 / 설명회모드” 같은 SYSTEM preset 추가 쉬움

---

**락모먼트 Preset 생성/적용 API 스펙 (HTTP v2 기준)**을  
👉 **실제 서버·앱 개발 바로 들어갈 수 있게** 정리해줄게.  
(부모/교사/기관/운영자 권한 + 출석 전용까지 반영)

---

# 1️⃣ Preset 목록 조회

## GET /presets

**설명**

- SYSTEM / ORG / USER preset 통합 조회
- role 기반 필터링

### Query Params

|파라미터|설명|
|---|---|
|scope|SYSTEM \| ORG \| USER|
|purpose|LOCK_ONLY \| ATTENDANCE_ONLY \| LOCK_AND_ATTENDANCE|
|isActive|true \| false|

### Request

```
GET /v2/presets?scope=ORG&purpose=ATTENDANCE_ONLY
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scope": "ORG",
      "name": "수업 출석 전용",
      "purpose": "ATTENDANCE_ONLY",
      "lockType": null,
      "defaultDurationMinutes": null,
      "isActive": true
    }
  ]
}
```

---

# 2️⃣ Preset 상세 조회

## GET /presets/{presetId}

```
GET /v2/presets/uuid
```

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "scope": "USER",
    "ownerId": "user_uuid",
    "name": "집중모드",
    "description": "수업시간 집중",
    "purpose": "LOCK_AND_ATTENDANCE",
    "lockType": "APP_ONLY",
    "allowedCategories": ["EDUCATION"],
    "blockedCategories": ["GAME", "SOCIAL"],
    "allowedApps": [],
    "defaultDurationMinutes": 120
  }
}
```

---

# 3️⃣ Preset 생성

## POST /presets

**권한**

- SYSTEM → 운영자
- ORG → 기관 관리자 / 교사
- USER → 부모 / 교사

### Request Body

```json
{
  "scope": "USER",
  "name": "출석만 체크",
  "description": "잠금 없이 출석만",
  "purpose": "ATTENDANCE_ONLY",

  "lockType": null,
  "allowedCategories": null,
  "blockedCategories": null,
  "allowedApps": null,
  "defaultDurationMinutes": null
}
```

### Response

```json
{
  "success": true,
  "data": {
    "presetId": "uuid"
  }
}
```

---

# 4️⃣ Preset 수정

## PUT /presets/{presetId}

- SYSTEM preset 수정 ❌
- ORG / USER 본인 소유만 가능

```json
{
  "name": "집중 수업 모드",
  "defaultDurationMinutes": 90,
  "isActive": true
}
```

---

# 5️⃣ Preset 비활성화 (삭제 대체)

## PATCH /presets/{presetId}/deactivate

```json
{
  "success": true
}
```

---

# 6️⃣ Preset 적용 (핵심 API)

## POST /presets/{presetId}/apply

**Preset → 대상에 적용 + QR 생성**

### Request Body

```json
{
  "targetType": "CLASS",
  "targetId": "class_uuid",

  "schedule": {
    "startAt": "2026-02-10T10:00:00+09:00",
    "endAt": "2026-02-10T12:00:00+09:00"
  },

  "qr": {
    "type": "DYNAMIC",
    "oneTime": true
  }
}
```

### Server 처리 로직

|preset.purpose|동작|
|---|---|
|ATTENDANCE_ONLY|QR + attendance 생성|
|LOCK_ONLY|lock_policies 생성|
|LOCK_AND_ATTENDANCE|둘 다 생성|

### Response

```json
{
  "success": true,
  "data": {
    "qrId": "uuid",
    "qrPayload": "encrypted_payload",
    "lockPolicyId": "uuid_or_null"
  }
}
```

---

# 7️⃣ Preset 사용 이력 조회

## GET /presets/{presetId}/usage

```json
{
  "success": true,
  "data": [
    {
      "targetType": "CLASS",
      "targetId": "uuid",
      "purpose": "ATTENDANCE_ONLY",
      "appliedAt": "2026-02-09T09:00:00+09:00"
    }
  ]
}
```

---

# 8️⃣ 추천 Preset (UX용)

## GET /presets/recommended

**기준**

- role
    
- 최근 사용
    
- 기관 유형 (학교/학원)
    

```json
{
  "success": true,
  "data": [
    {
      "presetId": "uuid",
      "name": "기본 출석 체크",
      "purpose": "ATTENDANCE_ONLY"
    }
  ]
}
```

---

# 9️⃣ 권한 제어 요약

|역할|SYSTEM|ORG|USER|
|---|---|---|---|
|운영자|R/W|R|R|
|기관관리자|R|R/W|R|
|교사|R|R/W|R/W|
|부모|R|❌|R/W|

---

# 🔚 이 API 설계의 강점

✔ 출석 전용 / 잠금 전용 명확 분리  
✔ QR → preset → lock/attendance 일관 구조  
✔ 모바일/웹/운영자 공용 API  
✔ Apple·Kakao 심사 설명 용이  
✔ 나중에 **시험모드 / 설명회 / 자율학습 preset** 확장 쉬움

---

다음으로 이어가면 딱 좋은 것들 👇

- **Preset 적용 UX 플로우 (교사/부모/기관)**
- **QR payload v2 최종 스펙**
- **Preset + 스케줄 자동 반복 적용 API**

원하는 다음 단계 골라줘.


좋은 타이밍이야. 지금 시나리오가 **QR = 정책 실행 트리거(출석/잠금/혼합)** 로 명확해졌기 때문에  
기존 `qr_codes`, `qr_device_usage` 는 **구조적으로 갈아엎는 게 맞음** 👍  
요청대로 **DROP → 신규 생성**, enum / index 까지 포함해서 정리해줄게.

아래는 **PostgreSQL 기준 최종안(v2)** 이야.

---

## 0️⃣ 전제: 신규 Enum 정의

### QR 타입 / 목적 / 스케줄 / 대상

```sql
-- QR 고정/동적
CREATE TYPE qr_type_enum AS ENUM (
  'STATIC',     -- 고정형 (부모/일반/기관 출석판)
  'DYNAMIC'     -- 1회성/세션용
);

-- QR 목적 (Preset purpose와 1:1)
CREATE TYPE qr_purpose_enum AS ENUM (
  'ATTENDANCE_ONLY',
  'LOCK_ONLY',
  'LOCK_AND_ATTENDANCE'
);

-- QR 스케줄 방식
CREATE TYPE qr_schedule_mode_enum AS ENUM (
  'IMMEDIATE',
  'RESERVED'
);

-- QR 적용 대상
CREATE TYPE qr_target_type_enum AS ENUM (
  'CLASS',
  'STUDENT',
  'DEVICE',
  'HOME'
);

-- QR 상태
CREATE TYPE qr_status_enum AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'REVOKED'
);
```

---

## 1️⃣ 기존 테이블 DROP

```sql
DROP TABLE IF EXISTS qr_device_usage CASCADE;
DROP TABLE IF EXISTS qr_codes CASCADE;
```

---

## 2️⃣ qr_codes (QR 메타 + 정책 중심)

> ✅ QR = “무엇을 실행할지 정의하는 엔티티”

```sql
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- QR 기본 성격
  qr_type qr_type_enum NOT NULL,
  purpose qr_purpose_enum NOT NULL,

  -- Preset / Policy 연계
  preset_id UUID NULL REFERENCES preset_policies(id),
  lock_policy_id UUID NULL REFERENCES lock_policies(id),

  -- 대상 정보
  target_type qr_target_type_enum NOT NULL,
  target_id UUID NOT NULL,

  -- 스케줄
  schedule_mode qr_schedule_mode_enum NOT NULL DEFAULT 'IMMEDIATE',
  valid_from TIMESTAMPTZ NULL,
  valid_to TIMESTAMPTZ NULL,

  -- 사용 제어
  one_time BOOLEAN DEFAULT FALSE,
  max_scan_count INT NULL, -- NULL = 무제한

  -- 상태
  status qr_status_enum DEFAULT 'ACTIVE',

  -- 생성자
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 무결성 체크
  CONSTRAINT chk_qr_valid_time
    CHECK (
      valid_from IS NULL
      OR valid_to IS NULL
      OR valid_from < valid_to
    )
);
```

### 📌 핵심 포인트

- **출석-only QR도 preset_id만 있으면 동작**
    
- 잠금 없는 QR → `lock_policy_id IS NULL`
    
- 예약 QR → `valid_from / valid_to` 사용
    

---

## 3️⃣ qr_device_usage (실제 스캔 & 실행 로그)

> ✅ “누가, 어떤 기기로, 무엇이 실행됐는지”

```sql
CREATE TABLE qr_device_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  qr_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,

  -- 스캔 주체
  user_id UUID NOT NULL REFERENCES users(id),
  device_id UUID NOT NULL REFERENCES devices(id),

  -- 실행 결과
  attendance_recorded BOOLEAN DEFAULT FALSE,
  lock_applied BOOLEAN DEFAULT FALSE,

  -- 실패/예외 추적
  failure_reason TEXT NULL,

  scanned_at TIMESTAMPTZ DEFAULT now(),

  -- 1회성 QR 보호
  CONSTRAINT uq_qr_device_once
    UNIQUE (qr_id, device_id)
);
```

---

## 4️⃣ 인덱스 설계 (중요)

### qr_codes

```sql
CREATE INDEX idx_qr_codes_status
  ON qr_codes(status);

CREATE INDEX idx_qr_codes_target
  ON qr_codes(target_type, target_id);

CREATE INDEX idx_qr_codes_valid_time
  ON qr_codes(valid_from, valid_to);

CREATE INDEX idx_qr_codes_created_by
  ON qr_codes(created_by);
```

---

### qr_device_usage

```sql
CREATE INDEX idx_qr_usage_qr
  ON qr_device_usage(qr_id);

CREATE INDEX idx_qr_usage_user
  ON qr_device_usage(user_id);

CREATE INDEX idx_qr_usage_device
  ON qr_device_usage(device_id);

CREATE INDEX idx_qr_usage_scanned_at
  ON qr_device_usage(scanned_at);
```

---

## 5️⃣ 변경된 시나리오와의 매핑 정리

|시나리오|qr_codes 설정|
|---|---|
|출석 전용 QR|purpose=ATTENDANCE_ONLY, lock_policy_id=NULL|
|잠금 전용 QR|purpose=LOCK_ONLY|
|수업 QR|target_type=CLASS|
|부모 고정 QR|qr_type=STATIC, one_time=false|
|1회성 수업 QR|qr_type=DYNAMIC, one_time=true|
|예약 잠금|schedule_mode=RESERVED + valid_from|

---

## 6️⃣ 서버 트랜잭션 기준 (권장)

**/qr/generate**

```
BEGIN
  1. preset 조회
  2. (필요시) lock_policy 생성
  3. qr_codes INSERT
COMMIT
```

**/qr/scan**

```
BEGIN
  1. qr_codes 검증 (status, time)
  2. qr_device_usage INSERT
  3. attendance / lock 실행
  4. one_time → qr_codes.status = EXPIRED
COMMIT
```

---

## 🔚 다음으로 이어서 추천

1️⃣ **attendance 테이블과 qr_device_usage 관계 정리**  
2️⃣ **고정형 QR 재사용 정책 (부모/일반 사용자)**  
3️⃣ **QR payload v2 (서명 + 만료 + purpose 포함)**  
4️⃣ **RLS 적용 (교사/부모/운영자 권한별 QR 접근)**



좋아, 이제 **QR → 실제 출석 데이터 → 통계** 흐름을 깔끔하게 정리할 수 있는 단계야.  
아래는 **attendance ↔ qr_device_usage 관계 재설계 + attendance 테이블 DROP & 신규 생성** 최종안이야.  
(PostgreSQL 기준, enum / index 포함)

---

# 1️⃣ 설계 원칙 (핵심 요약)

### 관계 정리 결론

- **qr_device_usage = “행위 로그 (scan & 실행 결과)”**
- **attendance = “공식 출석 기록 (비즈니스 기준 데이터)”**
- 관계는 **1 : 0..1**
    - 모든 QR 스캔이 출석은 아님
    - 출석이 발생한 경우만 attendance row 생성
- **attendance는 반드시 qr_device_usage를 참조** (출처 명확화)

---

# 2️⃣ 신규 Enum 정의 (출석 상태 확장 대비)

```sql
CREATE TYPE attendance_status_enum AS ENUM (
  'PRESENT',     -- 정상 출석
  'LATE',        -- 지각
  'ABSENT',      -- 결석 (예약/관리자 처리)
  'EXCUSED'      -- 사유 인정
);
```

> 💡 지금은 PRESENT 위주로 쓰고  
> 이후 예약 QR, 수동 처리 시 확장 가능

---

# 3️⃣ 기존 attendance 테이블 DROP

`DROP TABLE IF EXISTS attendance CASCADE;`

---

# 4️⃣ attendance 테이블 신규 생성 (정규화 버전)

```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 출석 출처 (핵심)
  qr_usage_id UUID NOT NULL
    REFERENCES qr_device_usage(id) ON DELETE CASCADE,

  -- 소속 정보
  organization_id UUID NOT NULL
    REFERENCES organizations(id),

  class_id UUID NULL
    REFERENCES classes(id),

  -- 출석 대상
  student_id UUID NOT NULL
    REFERENCES users(id),

  device_id UUID NOT NULL
    REFERENCES devices(id),

  -- 출석 상태
  status attendance_status_enum NOT NULL DEFAULT 'PRESENT',

  -- 출석 시각 (QR scan 시각과 분리 가능)
  attended_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 관리자 보정
  marked_by UUID NULL REFERENCES users(id),
  memo TEXT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- 동일 QR 사용으로 중복 출석 방지
  CONSTRAINT uq_attendance_qr_usage UNIQUE (qr_usage_id)
);
```

---

# 5️⃣ 핵심 인덱스 설계 (통계 & 조회 최적화)

```sql
-- 학생별 출석 이력
CREATE INDEX idx_attendance_student
  ON attendance(student_id);

-- 수업별 출석 통계
CREATE INDEX idx_attendance_class
  ON attendance(class_id);

-- 기관별 출석 조회
CREATE INDEX idx_attendance_org
  ON attendance(organization_id);

-- 날짜 기준 조회 (일/월 통계)
CREATE INDEX idx_attendance_attended_at
  ON attendance(attended_at);

-- QR 기반 역추적
CREATE INDEX idx_attendance_qr_usage
  ON attendance(qr_usage_id);
```

---

# 6️⃣ qr_device_usage ↔ attendance 관계 다이어그램

```scss
qr_codes
   │
   ▼
qr_device_usage  (scan + 실행 로그)
   │   1
   ▼   0..1
attendance       (공식 출석 기록)
```

---

# 7️⃣ /qr/scan 시 트랜잭션 흐름 (출석 포함 QR)

```bash
BEGIN

1. qr_codes 유효성 검사
2. qr_device_usage INSERT
3. if purpose IN ('ATTENDANCE_ONLY','LOCK_AND_ATTENDANCE'):
     → attendance INSERT
4. if lock 포함:
     → lock_history INSERT
5. one_time QR:
     → qr_codes.status = EXPIRED

COMMIT
```

---

# 8️⃣ 기존 구조 대비 개선 포인트

|항목|기존|개선|
|---|---|---|
|출석 기준|class + student|**QR scan 기준**|
|중복 방지|애매|**qr_usage_id UNIQUE**|
|로그/통계|혼재|**로그 vs 공식 데이터 분리**|
|감사 추적|어려움|**QR → Device → User 역추적 가능**|

---


# 플랫폼별 잠금 동작 연결

## Android

### FULL

- Device Owner / Accessibility 기반
- 홈, 최근앱 차단
- 긴급전화만 허용

### APP

- QR payload의 `app_policy_id`
- 서버에 매핑된 **Universal App ID 리스트**
- 앱 실행 시 차단

---

## iOS (Family Controls)

### FULL 대응 전략 (Android와 개념 일치)

|Android|iOS 대응|
|---|---|
|전체 잠금|**모든 앱 + 카테고리 차단**|
|홈 접근 불가|홈 앱 제외 전부 Shield|
|해제 시간|Screen Time 스케줄|

→ UX 상 **“전체 잠금”**으로 통일 표기

---

### iOS APP 잠금

- `FamilyActivitySelection`
- 앱/카테고리 Shield
- QR → 서버 → DeviceActivity 스케줄 등록



### ✅ iOS에서 **카테고리 단위 허용 가능**

- **Family Controls / Screen Time API**에서
    - 앱 단위 (bundleId)
    - **앱 카테고리 단위**  
        둘 다 지원함
        

즉 서버에서  
👉 **“허용 앱 목록 + 허용 카테고리 목록”** 을 내려줄 수 있음

---

## 2️⃣ iOS Family Controls의 기본 개념 구조

iOS는 **“차단할 것”이 아니라 “허용할 것”을 선택**하는 구조야.

### 핵심 타입

```swift
FamilyActivitySelection
```

이 안에 두 가지가 들어감

```swift
var applicationTokens: Set<ApplicationToken>
var categoryTokens: Set<ActivityCategoryToken>
```

---

## 3️⃣ 카테고리 단위 허용 구조 (중요)

### iOS에서 제공하는 주요 카테고리 예시

|카테고리|설명|
|---|---|
|`.education`|교육|
|`.productivity`|생산성|
|`.utilities`|유틸리티|
|`.reference`|참고|
|`.books`|도서|
|`.finance`|금융|
|`.healthAndFitness`|건강|
|`.creativity`|크리에이티브|
|`.entertainment`|엔터테인먼트|
|`.games`|게임|
|`.socialNetworking`|SNS|

👉 **카테고리는 Apple이 분류한 App Store 기준**

---

### 예: “교육 앱 + 계산기만 허용”

```swift
var selection = FamilyActivitySelection()

selection.categoryTokens = [
    .education,
    .utilities
]
```

→ 교육 앱 전체 + 계산기/시계 같은 기본 유틸 허용  
→ 나머지는 전부 Shield (잠금)

---

## 4️⃣ 앱 단위 + 카테고리 단위 혼합 허용 (권장 설계)

### iOS는 **동시에 사용 가능**함

```swift
selection.applicationTokens = [
    ApplicationToken(bundleIdentifier: "com.apple.calculator")
]

selection.categoryTokens = [
    .education
]
```

### 의미

- 교육 카테고리 전체 허용
- 그 외 앱 중 계산기만 추가 허용
- 나머지 전부 잠금

👉 **락모먼트에 아주 잘 맞는 구조**

---

## 5️⃣ 서버 기준 설계 (플랫폼 공통화)

### 서버 정책 모델 예시

```json
{
  "allow_policy": {
    "apps": [
      "com.apple.calculator",
      "com.apple.notes"
    ],
    "categories": [
      "EDUCATION",
      "PRODUCTIVITY"
    ]
  }
}
```

### 서버 → 플랫폼별 변환

|서버|Android|iOS|
|---|---|---|
|allow.apps|패키지명 허용|bundleId → ApplicationToken|
|allow.categories|❌ (직접 구현)|ActivityCategoryToken|

---

## 6️⃣ Android와 개념 정렬 방법 (중요)

### Android는 “허용”이 아니라 “차단” 기반이므로 이렇게 맞춘다

### 서버는 항상 **허용 기준**으로 관리

```
허용 앱 / 허용 카테고리
```

### Android 변환 로직

1. 전체 앱 목록 조회
2. 허용 앱 + 허용 카테고리에 속한 앱 제외
3. 나머지 앱 → 잠금 대상
    

📌 즉,

> **서버 개념은 iOS 기준으로 통일**  
> Android가 그걸 계산해서 차단

이게 유지보수 제일 쉬움.

---

## 7️⃣ UX 설계 팁 (현실적으로 중요)

### 부모/교사용 권장 Preset

|모드|허용 카테고리|
|---|---|
|수업 집중|EDUCATION, UTILITIES|
|숙제 모드|EDUCATION, REFERENCE|
|자유 시간|ENTERTAINMENT, GAMES|
|완전 집중|(비워둠 → 전부 차단)|

👉 QR 생성 시 Preset 선택만 하게 하면 UX 미친 듯이 좋아짐

---

## 8️⃣ 제한사항 & 주의점 (꼭 알아야 함)

### ⚠️ iOS 한계

1. **시스템 앱 일부는 완전 차단 불가**
    - 전화, 설정 일부
        
2. **카테고리 분류는 Apple 기준**
    - 앱 개발자가 잘못 분류한 경우 있음
        
3. **Family Controls 승인 필수**
    - TestFlight도 권한 승인 전에는 실제 Shield 안 걸림
        



# 1️⃣ iOS vs Android 카테고리 지원 차이 (정리)

|구분|iOS (Family Controls)|Android|
|---|---|---|
|OS 차원 카테고리|✅ 있음|❌ 없음|
|카테고리 기준 허용|✅ native|❌ 직접 불가|
|앱 단위 제어|✅|✅|
|서버 정책 일관성|매우 좋음|서버 계산 필요|

👉 **Android는 “카테고리 개념은 앱 레벨에서 구현”해야 함**

---

# 2️⃣ Android에서 카테고리 허용이 “직접 불가능”한 이유

Android는

- Screen Time / Family Controls 같은 **중앙 통제 API가 없음**
- `UsageStats`, `AccessibilityService`, `Device Owner`는
    - **앱 단위**로만 제어 가능
    - “이 앱은 교육 카테고리니까 허용” 같은 기능 ❌

즉,

> **카테고리 = 우리가 정의해야 하는 논리적 그룹**

---

# 3️⃣ Android에서 가능한 현실적인 방법 (핵심)

## ✅ 전략: “서버 정의 카테고리 → 앱 목록 변환 → 잠금 적용”

### 전체 구조

```
[서버]
허용 카테고리 (EDUCATION, UTILITIES)
        ↓
[Android]
카테고리에 속한 앱 패키지 목록 조회
        ↓
허용 앱 Set 생성
        ↓
그 외 앱 전부 잠금
```

---

# 4️⃣ Android 카테고리 분류 방법 (3가지)

## ① Google Play Store 카테고리 (가장 추천)

### 앱 카테고리 조회 방법

- Google Play Developer API
- 또는 자체 수집한 Play Store 메타데이터

예:

```
com.google.android.youtube → ENTERTAINMENT
com.google.android.classroom → EDUCATION
```

### 장점

- iOS 카테고리와 가장 유사
- 관리 일관성 높음

### 단점

- 신규 앱 대응을 위한 주기적 동기화 필요

---

## ② 내부 고정 매핑 테이블 (운영 안정성 ↑)

### 서버 테이블 예시

```sql
app_category_map
- platform (ANDROID)
- package_name
- category
- updated_at
```

### 운영 방식

- 초기에 주요 앱 90% 커버
- 미분류 앱은 기본 차단

📌 **교육/학원 서비스에 매우 적합**

---

## ③ 사용자 선택 기반 보정 (보조 수단)

- 부모/교사가 “이 앱은 교육용” 체크
- 서버에 override 저장
    

```json
{
  "package": "com.some.app",
  "override_category": "EDUCATION"
}
```

---

# 5️⃣ iOS → Android 카테고리 매핑 전략 (실전용)

## 🔑 기준: **서버 카테고리를 Canonical 로 둔다**

### 서버 공통 카테고리 정의

```text
EDUCATION
PRODUCTIVITY
UTILITIES
REFERENCE
ENTERTAINMENT
GAMES
SOCIAL
```

---

### iOS 매핑

|서버|iOS ActivityCategory|
|---|---|
|EDUCATION|.education|
|PRODUCTIVITY|.productivity|
|UTILITIES|.utilities|
|REFERENCE|.reference|
|ENTERTAINMENT|.entertainment|
|GAMES|.games|
|SOCIAL|.socialNetworking|

---

### Android 매핑 (논리적)

|서버|Android 기준|
|---|---|
|EDUCATION|Play Store: Education|
|PRODUCTIVITY|Productivity|
|UTILITIES|Tools / Utilities|
|REFERENCE|Books / Reference|
|ENTERTAINMENT|Entertainment|
|GAMES|Games|
|SOCIAL|Social|

📌 **Android는 “카테고리 → 앱 리스트”로 변환하는 단계가 추가됨**

---

# 6️⃣ Android 잠금 엔진 관점에서의 처리 흐름

```kotlin
allowedCategories = ["EDUCATION", "UTILITIES"]
allowedApps = getAppsByCategories(allowedCategories)
explicitAllowedApps = policy.allowedApps

finalAllowedApps = allowedApps + explicitAllowedApps

for app in installedApps:
    if app.package !in finalAllowedApps:
        lock(app)
```

✔ Android 전체 잠금  
✔ Android 앱 잠금  
✔ iOS 카테고리 허용과 UX 동일

---

# 7️⃣ QR / 정책 시스템과의 결합 (락모먼트에 딱 맞음)

### QR Payload 예시

```json
{
  "policy_type": "APP_LOCK",
  "allow_categories": ["EDUCATION"],
  "allow_apps": ["com.apple.calculator"],
  "duration": 50
}
```

- iOS → categoryTokens + applicationTokens
    
- Android → category → 앱 목록 → 차단 계산
    

---

# 8️⃣ 운영상 베스트 프랙티스 (경험 기반)

✔ **서버 정책은 항상 “허용 기준”**  
✔ Android는 계산 담당  
✔ 미분류 앱은 기본 차단  
✔ 교사/부모 override 허용  
✔ Preset 중심 UX 유지


“한 번 만들어두면 운영이 편해지는 구조” 기준으로 **실전형 자동 분류 파이프라인**을 정리할게.

---

# 🎯 목표 요약

- **iOS FamilyControls 카테고리와 의미적으로 일치**
- **신규 앱 설치 시 자동 반영**
- **운영자 수동 개입 최소화**
- **미분류 앱은 기본 차단**
- **교사/부모 override 가능**

---

# 1️⃣ 전체 아키텍처 (큰 그림)

```
[Android Device]
  └─ 설치 앱 목록 (package, version)
        ↓
[Client]
  └─ 패키지 리스트 전송
        ↓
[Server]
  ├─ 1차: 내부 매핑 DB 조회
  ├─ 2차: Play Store 카테고리 조회
  ├─ 3차: 휴리스틱/AI 보정
  ├─ 4차: 운영자/부모 override
        ↓
[Canonical Category]
        ↓
[Allowed App Set 계산]
        ↓
[Android Lock Engine]
```

---

# 2️⃣ Canonical 카테고리 (서버 기준)

**절대 Android / iOS 기준으로 분기하지 말 것**

```text
EDUCATION
PRODUCTIVITY
UTILITIES
REFERENCE
COMMUNICATION
ENTERTAINMENT
GAMES
SOCIAL
UNKNOWN
```

👉 iOS / Android는 **출력 어댑터** 역할만 함

---

# 3️⃣ 단계별 자동 분류 로직 (핵심)

## 🔹 STEP 1. 내부 고정 매핑 (Fast Path)

### 테이블

```sql
android_app_category_map
- package_name (PK)
- canonical_category
- source ENUM('MANUAL','PLAYSTORE','AI')
- confidence INT
- updated_at
```

### 특징

- 자주 쓰는 앱은 **100% 커버**
- 성능 빠름
- 안정성 최고

✔ 전체 앱의 70~80%는 여기서 해결

---

## 🔹 STEP 2. Play Store 카테고리 매핑

### 데이터 소스

- Google Play Store metadata
- 자체 크롤링 or 수집 DB

### 변환 규칙 예시

|Play Store|Canonical|
|---|---|
|Education|EDUCATION|
|Tools|UTILITIES|
|Productivity|PRODUCTIVITY|
|Books & Reference|REFERENCE|
|Entertainment|ENTERTAINMENT|
|Social|SOCIAL|
|Communication|COMMUNICATION|
|Games|GAMES|

📌 **Play Store = 참고용, 절대 단독 기준 X**

---

## 🔹 STEP 3. 휴리스틱 규칙 (중요)

Play Store 분류가 애매할 때 보정

### 예시 규칙

```text
- 패키지명에 classroom, edu, school 포함 → EDUCATION
- 앱 권한에 CALL_LOG + SMS → COMMUNICATION
- Accessibility + Overlay → TOOLS or DEVICE
- 게임 엔진 signature → GAMES
```

### 적용 방식

- confidence 점수 가산
- 기준 이상이면 자동 확정

---

## 🔹 STEP 4. AI 보조 분류 (옵션, 후순위)

> ❗ 실시간 호출 ❌  
> ✔ batch / 신규 앱 전용

### 입력

```json
{
  "app_name": "Kahoot!",
  "description": "...",
  "permissions": [...],
  "developer": "Kahoot ASA"
}
```

### 출력

```json
{
  "category": "EDUCATION",
  "confidence": 92
}
```

- OpenAI / Vertex AI 가능
- 운영자 승인 후 DB 반영

---

## 🔹 STEP 5. 부모/교사 Override (최종 우선순위)

```sql
app_category_override
- subject_type (STUDENT | DEVICE)
- subject_id
- package_name
- override_category
- created_by
```

📌 **Override > AI > PlayStore > Manual**

---

# 4️⃣ 신규 앱 설치 시 실시간 처리 흐름

```
[앱 설치 이벤트]
   ↓
Client → package_name 전송
   ↓
Server:
   - DB 조회
   - 없으면 Play Store lookup
   - 결과 UNKNOWN → 기본 차단
   ↓
Android Lock Engine 즉시 반영
```

⚠️ 절대 “분류될 때까지 허용”하지 말 것

---

# 5️⃣ Android Lock Engine 연계 구조

### 정책 계산

```json
{
  "allowed_categories": ["EDUCATION"],
  "allowed_apps": ["com.android.calculator"]
}
```

### 서버 계산 결과

```json
{
  "final_allowed_packages": [
    "com.google.android.classroom",
    "com.kahoot.app",
    "com.android.calculator"
  ]
}
```

Android는 **결과만 신뢰**

---

# 6️⃣ 운영자 도구 (실무에서 중요)

## 📊 미분류 앱 대시보드

- UNKNOWN 앱 목록
- 설치 수 기준 정렬
- 원클릭 카테고리 지정

## 📥 CSV 업로드

- 학원별 교육 앱 일괄 등록

---

# 7️⃣ 보안 & 안정성 포인트

✔ 패키지명 기준 (appId X)  
✔ version 무관  
✔ 앱 이름 변경에도 안전  
✔ 루팅 여부와 무관

---

# 8️⃣ 성능 전략

- Client → package hash only 전송 가능
- 서버 결과 캐시
- 정책 변경 시 delta push

---

# 9️⃣ 최종 추천 구조 (락모먼트용)

> **Canonical Category 중심 + 서버 계산 + Android는 실행 전담**

이 구조면:

- iOS / Android 정책 100% 통합
- 학원/학교/가정 공통 사용 가능
- QR / 예약 잠금 / 실시간 잠금 전부 연동 가능