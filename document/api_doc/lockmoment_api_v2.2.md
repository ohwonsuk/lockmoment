# LockMoment API 업데이트 (2026-02-10 - v2.2.0)

## 📋 변경 사항 요약

### 신규 인증 시스템 (Modernized)
1. `POST /auth/apple` - Apple Sign-In 지원 (JWT 발급 또는 신규 가입 분기)
2. `POST /auth/register` - 필수 정보(이름, 전화번호) 입력 및 회원가입 완료
3. `POST /auth/kakao` - 카카오 로그인 (JWT 발급)
4. `POST /auth/anonymous` - 익명 사용자(게스트) 로그인
5. `POST /auth/refresh` - JWT 액세스 토큰 갱신

### Preset 정책 관리
1. `GET /presets` - Preset 목록 조회 (SYSTEM, ORG, USER 범위)
2. `POST /presets` - 사용자 지정 Preset 생성
3. `POST /presets/{presetId}/apply` - 특정 대상(학생/디바이스/반)에 Preset 적용

### 출석 관리
1. `GET /attendance/class/{classId}` - 특정 수업의 학생별 출석 상태 조회
2. `GET /attendance/student/{studentId}` - 특정 학생의 전체 출석 이력 조회

### 메타데이터
1. `GET /meta/categories` - 서비스에서 사용하는 앱 카테고리 목록(ID, 이름 등) 조회

### 통계 및 리포트 (New)
1. `GET /parent-child/{childId}/usage-stats` - 오늘의 실시간 사용량 및 제한 시간 조회
2. `GET /reports/usage/{childId}` - 최근 7일간의 일별 집중 시간 리포트 데이터
3. `GET /users/profile` - **(New v260220)** 다중 보호자, 소속 기관, 역할 정보를 포함한 상세 프로필 조회

---

## 🔐 인증 (Authentication)

모든 API는 (인증 불필요 엔드포인트 제외) 다음 헤더를 포함해야 합니다:

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### 1. Apple 로그인
`POST /auth/apple`

**Request**:
```json
{
  "identityToken": "apple-identity-token",
  "user": {
    "user": "apple-user-id",
    "email": "user@example.com",
    "fullName": { "givenName": "철수", "familyName": "김" }
  }
}
```

**Response (기존 사용자 - 로그인 성공)**:
```json
{
  "success": true,
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "철수",
    "role": "PARENT",
    "auth_provider": "APPLE"
  }
}
```

**Response (신규 사용자 - 추가 정보 입력 필요)**:
```json
{
  "success": true,
  "status": "NEW_USER",
  "appleSub": "apple-user-unique-id",
  "email": "user@example.com",
  "name": "철수"
}
```

### 2. 회원가입 완료
`POST /auth/register`
Apple 또는 카카오 로그인 후 이름, 휴대폰 번호 등 누락된 필수 정보를 전송하여 가입을 완료하고 토큰을 발급받습니다.

**Request**:
```json
{
  "provider": "APPLE | KAKAO",
  "appleSub": "apple-user-unique-id",
  "name": "김철수",
  "phone": "01012345678",
  "role": "PARENT | TEACHER",
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "uuid",
    "name": "김철수",
    "phone": "01012345678",
    "role": "PARENT",
    "auth_provider": "APPLE"
  }
}
```

### 2. 게스트 로그인
`POST /auth/anonymous`

**Request**:
```json
{
  "deviceData": {
    "deviceId": "uuid",
    "platform": "IOS",
    "model": "iPhone 15",
    "osVersion": "17.4"
  }
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "uuid",
    "role": "STUDENT",
    "auth_provider": "ANONYMOUS"
  }
}
```

### 3. 토큰 갱신
`POST /auth/refresh`

**Request**:
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "new-jwt-access-token"
}
```

---

## 🔒 PIN 보안 및 접근 제한 (New)

### 3-1. PIN 설정/변경
`POST /auth/pin/set`

**Request**:
```json
{
  "pin": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PIN이 설정되었습니다."
}
```

### 3-2. PIN 검증
`POST /auth/pin/verify`

**Request**:
```json
{
  "pin": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PIN 검증 성공"
}
```

### 3-3. 자녀 접근 제한 설정 (부모 전용)
`PATCH /users/restriction`

**Request**:
```json
{
  "childId": "uuid",
  "restrict": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "자녀의 내 정보 접근이 제한되었습니다."
}
```

---

### 3-4. 상세 프로필 조회 (Multi-Role & Relation 지원)
`GET /users/profile`

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "display_name": "김철수",
      "email": "user@example.com",
      "role": "PARENT",
      "phone_number": "01012345678"
    },
    "relations": {
      "parents": [
        { "id": "uuid1", "display_name": "엄마", "is_primary": true },
        { "id": "uuid2", "display_name": "아빠", "is_primary": false }
      ],
      "children": [
        { "id": "uuid3", "display_name": "김민준", "nickname": "첫째" }
      ],
      "organizations": [
        { "id": "org-uuid", "name": "OO수학학원", "role": "TEACHER" }
      ]
    }
  }
}
```

---

## 📋 Preset 정책 API

### 4. Preset 목록 조회
`GET /presets?scope=SYSTEM|ORG|USER&purpose=LOCK_ONLY|ATTENDANCE_ONLY|LOCK_AND_ATTENDANCE`

**Response**:
```json
{
  "success": true,
  "presets": [
    {
      "id": "uuid",
      "scope": "SYSTEM",
      "name": "강력 집중 모드",
      "purpose": "LOCK_ONLY",
      "lock_type": "FULL",
      "default_duration_minutes": 60,
      "allowed_categories": ["EDUCATION"],
      "blocked_categories": ["SOCIAL", "GAMES"],
      "isActive": true
    }
  ]
}
```

### 5. Preset 상세 조회
`GET /presets/{presetId}`

**Response**:
```json
{
  "success": true,
  "preset": {
    "id": "uuid",
    "scope": "USER",
    "name": "집중 학습",
    "purpose": "LOCK_AND_ATTENDANCE",
    "lock_type": "APP_ONLY",
    "allowed_categories": ["EDUCATION"],
    "blocked_categories": ["GAMES"],
    "allowed_apps": ["com.apple.calculator"],
    "default_duration_minutes": 120
  }
}
```

### 6. Preset 생성
`POST /presets`

**Request Body**:
```json
{
  "scope": "USER",
  "name": "시험 공부",
  "purpose": "LOCK_ONLY",
  "lock_type": "FULL",
  "default_duration_minutes": 60
}
```

### 7. Preset 비활성화
`PATCH /presets/{presetId}/deactivate`

**Response**:
```json
{ "success": true }
```

### 8. Preset 적용
`POST /presets/{presetId}/apply`

**Request**:
```json
{
  "target_type": "STUDENT | DEVICE | CLASS",
  "target_id": "uuid",
  "duration_minutes": 90,
  "overrides": {
    "allowed_apps": ["com.apple.calculator"]
  }
}
```

### 9. Preset 사용 이력 조회
`GET /presets/{presetId}/usage`

**Response**:
```json
{
  "success": true,
  "usage": [
    {
      "target_type": "CLASS",
      "target_id": "uuid",
      "applied_at": "2026-02-12T10:00:00Z"
    }
  ]
}
```

### 10. 추천 Preset 조회
`GET /presets/recommended`

**Response**:
```json
{
  "success": true,
  "presets": [...]
}
```

---

## 🔒 개인용 Preset API (New)

### 11. 개인 Preset 목록 조회
`GET /personal-presets`

**Response**:
```json
{
  "success": true,
  "presets": [
    {
      "id": "uuid",
      "name": "나의 집중 시간",
      "lock_type": "FULL",
      "duration_minutes": 60,
      "allowed_apps": [],
      "blocked_apps": []
    }
  ]
}
```

### 12. 개인 Preset 생성/수정
`POST /personal-presets`

**Request Body**:
```json
{
  "id": "uuid (optional for update)",
  "name": "나의 집중 시간",
  "lock_type": "FULL | APP",
  "duration_minutes": 60,
  "allowed_apps": [],
  "blocked_apps": [],
  "allowed_categories": [],
  "blocked_categories": []
}
```

### 13. 개인 Preset 삭제
`DELETE /personal-presets/{presetId}`

---

## 🔒 QR 코드 API (업데이트)

### 6. QR 생성 (Preset 연동)
`POST /qr/generate`

**Request**:
```json
{
  "purpose": "LOCK_ONLY | ATTENDANCE_ONLY | LOCK_AND_ATTENDANCE",
  "preset_id": "uuid",
  "target_type": "STUDENT | CLASS",
  "target_id": "uuid",
  "duration_minutes": 60,
  "max_uses": 1
}
```

---

## 📊 출석 API

### 7. 수업별 출석 조회
`GET /attendance/class/{classId}`

**Response**:
```json
{
  "success": true,
  "attendance": [
    {
      "student_id": "uuid",
      "student_name": "홍길동",
      "status": "PRESENT",
      "created_at": "2026-02-10T09:05:00Z"
    }
  ]
}
```

---

## 🛠 메타데이터 API

### 8. 앱 카테고리 목록 조회
`GET /meta/categories`
서비스에서 정의된 앱 카테고리(교육, 게임, SNS 등)의 ID와 표시 이름을 조회합니다.

**Response**:
```json
{
  "success": true,
  "categories": [
    {
      "id": "EDUCATION",
      "display_name": "교육",
      "ios_category": ".education",
      "android_label": "Play Store: Education"
    },
    {
      "id": "GAMES",
      "display_name": "게임",
      "ios_category": ".games",
      "android_label": "Games"
    }
  ]
}
```

### 9. 앱 목록 조회
`GET /meta/apps`
서비스에서 관리하는 잠금 가능한 전체 앱 목록을 조회합니다. `app_category_map` 테이블의 데이터 기반으로 제공됩니다.

**Response**:
```json
{
  "success": true,
  "apps": [
    {
      "name": "유튜브",
      "packageNames": ["com.google.ios.youtube", "com.google.android.youtube"],
      "category": "ENTERTAINMENT"
    },
    {
      "name": "카카오톡",
      "packageNames": ["com.iwilab.kakao.talk", "com.kakao.talk"],
      "category": "SOCIAL"
    }
  ]
}
```

---

---

## 📱 잠금 관리 API

### 9. 잠금 시작
`POST /locks/start`
자녀 기기에서 잠금을 시작하고 서버에 상태를 기록합니다.

**Request**:
```json
{
  "device_id": "uuid",
  "lock_name": "바로 잠금",
  "lock_type": "FULL | APP",
  "duration_minutes": 60,
  "source": "MANUAL | SCHEDULED | QR | PRESET",
  "allowed_apps": ["com.example.app"],
  "blocked_apps": ["com.game.app"],
  "prevent_app_removal": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "잠금이 시작되었습니다",
  "lock": {
    "id": "uuid",
    "lock_name": "바로 잠금",
    "ends_at": "2026-02-15T10:00:00Z",
    "prevent_app_removal": true
  }
}
```

### 10. 잠금 종료
`POST /locks/stop`
자녀 기기에서 잠금을 종료하고 서버 상태를 업데이트합니다.

**Response**:
```json
{
  "success": true,
  "message": "잠금이 종료되었습니다"
}
```

### 11. 현재 잠금 상태 조회
`GET /locks/status`
현재 사용자의 활성화된 잠금 상태를 조회합니다.

**Response**:
```json
{
  "success": true,
  "isLocked": true,
  "lock": {
    "id": "uuid",
    "lock_name": "바로 잠금",
    "type": "FULL",
    "ends_at": "2026-02-15T10:00:00Z"
  }
}
```

---

## 📅 예약된 잠금 (Scheduled Locks) API
### 12. 스케줄 목록 조회
`GET /parent-child/{childId}/schedules`
자녀의 등록된 잠금 스케줄 목록을 조회합니다.

**Response**:
```json
{
  "success": true,
  "schedules": [
    {
      "id": "uuid",
      "name": "주말 게임 제한",
      "start_time": "09:00:00",
      "end_time": "12:00:00",
      "days": ["SAT", "SUN"],
      "lock_type": "APP_ONLY",
      "allowed_apps": ["com.edu.app"],
      "blocked_apps": ["com.game.app"],
      "allowed_categories": ["EDUCATION"],
      "blocked_categories": ["GAMES"],
      "is_active": true
    }
  ]
}
```

### 13. 스케줄 생성
`POST /parent-child/{childId}/schedules`

**Request**:
```json
{
  "name": "취침 시간",
  "start_time": "22:00",
  "end_time": "07:00",
  "days": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
  "lock_type": "FULL",
  "is_active": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "스케줄이 생성되었습니다",
  "schedule": { ... }
}
```

### 14. 스케줄 수정
`PUT /parent-child/{childId}/schedules/{scheduleId}`

**Request**:
```json
{
  "name": "취침 시간 (수정)",
  "start_time": "23:00",
  "end_time": "07:00",
  "days": ["FRI", "SAT"],
  "lock_type": "FULL",
  "allowed_categories": [],
  "blocked_categories": ["GAMES", "SOCIAL"],
  "is_active": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "스케줄이 수정되었습니다"
}
```

### 15. 스케줄 활성화/비활성화
`PATCH /parent-child/{childId}/schedules/{scheduleId}/status`

**Request**:
```json
{
  "is_active": false
}
```

**Response**:
```json
{
  "success": true,
  "message": "스케줄 상태가 변경되었습니다"
}
```

### 16. 스케줄 삭제
`DELETE /parent-child/{childId}/schedules/{scheduleId}`

**Response**:
```json
{
  "success": true,
  "message": "스케줄이 삭제되었습니다"
}
```

---

## 📊 통계 및 리포트 (Usage & Reports) API

### 17. 오늘의 사용량 통계 조회
`GET /parent-child/{childId}/usage-stats`
자녀의 오늘 총 사용(잠금) 시간과 설정된 스케줄에 따른 제한 시간을 조회합니다.

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalUsage": 45,
    "limit": 180
  }
}
```

### 18. 주간 사용 리포트 조회
`GET /reports/usage/{childId}`
자녀의 최근 7일간의 일별 집중 시간(분 단위) 데이터를 조회합니다.

**Response**:
```json
{
  "success": true,
  "report": [
    { "date": "2026-02-10", "minutes": 120 },
    { "date": "2026-02-11", "minutes": 45 }
  ]
}
```

---

## 🔧 에러 응답 코드

| 코드 | 설명 | 대응 방법 |
| :--- | :--- | :--- |
| **401** | Unauthorized | `/auth/refresh`를 통한 토큰 갱신 또는 재로그인 |
| **403** | Forbidden | 권한 부족 (예: 학생이 부모용 API 호출) |
| **404** | Not Found | 요청한 리소스가 존재하지 않음 |
| **500** | Internal Error | 서버 내부 오류 (로그 확인 필요) |

---

**Last Updated**: 2026-02-20
**API Version**: 2.2.4
