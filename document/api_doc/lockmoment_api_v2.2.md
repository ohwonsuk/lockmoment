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

### 개선된 기능
1. **JWT 기반 보안**: 모든 보호된 엔드포인트에 `jose` 라이브러리를 사용한 JWT 검증 적용
2. **QR 코드 연동**: QR 생성 시 Preset ID를 연동하여 복잡한 잠금 정책을 한 번에 적용 가능
3. **부모-자녀 연결**: `POST /parent-child/link` 기능 정식 지원

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

## 🔧 에러 응답 코드

| 코드 | 설명 | 대응 방법 |
| :--- | :--- | :--- |
| **401** | Unauthorized | `/auth/refresh`를 통한 토큰 갱신 또는 재로그인 |
| **403** | Forbidden | 권한 부족 (예: 학생이 부모용 API 호출) |
| **404** | Not Found | 요청한 리소스가 존재하지 않음 |
| **500** | Internal Error | 서버 내부 오류 (로그 확인 필요) |

---

**Last Updated**: 2026-02-11
**API Version**: 2.2.1
