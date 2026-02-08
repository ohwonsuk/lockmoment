# LockMoment API 설계서 (http API V2 기준)

본 문서는 LockMoment MVP 및 확장(B2C + 부모 + 학원/학교 B2B)을 고려한 REST API 설계서입니다.
역할별(학생/부모/교사/기관관리자/시스템관리자) 권한을 기준으로 API를 구분합니다.

---

## 1. 공통 사항

### 1.1 Base URL

https://18gffqu5rb.execute-api.ap-northeast-2.amazonaws.com


### 1.2 인증 방식
- **Cognito JWT (Access Token)**
- 일부 학생 기능은 **비로그인(디바이스 기반)** 허용

### 1.3 공통 Header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### 1.4 사용자 Role 정의
| Role | 설명 |
|---|---|
| STUDENT | 학생 / 자녀 |
| PARENT | 부모 |
| TEACHER | 교사 |
| ORG_ADMIN | 기관 관리자 |
| ADMIN | 서비스 운영자 |

---

## 2. 인증 / 계정 API

### 2.1 카카오 로그인
POST /auth/kakao

Request
```json
{
  "kakaoAccessToken": "string",
  "role": "PARENT | TEACHER | ORG_ADMIN"
}
```

Response
```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "userId": "uuid",
    "role": "PARENT"
  }
}
```

---

## 3. 학생 / 디바이스 API

### 3.1 디바이스 등록 (학생)
POST /devices/register

```json
{
  "deviceId": "uuid",
  "platform": "iOS | ANDROID",
  "model": "iPhone 14",
  "osVersion": "17.2"
}
```

---

### 3.2 권한 상태 업데이트 (iOS/Android)
PATCH /devices/{deviceId}/permissions

```json
{
  "accessibility": true,
  "screenTime": true,
  "deviceAdmin": false
}
```

---

## 4. 잠금 (Lock) API

### 4.1 즉시 잠금 실행
POST /locks/execute

```json
{
  "deviceId": "uuid",
  "durationMinutes": 60,
  "source": "QR | MANUAL | ADMIN"
}
```

---

### 4.2 잠금 상태 조회
GET /locks/status?deviceId=uuid

```json
{
  "isLocked": true,
  "endAt": "2026-02-02T11:30:00Z"
}
```

---

### 4.3 잠금 이력 조회
GET /locks/history?deviceId=uuid

---

## 5. QR 코드 API

### 5.1 QR 코드 생성 (부모/교사/관리자)
POST /qr

```json
{
  "lockMinutes": 50,
  "validDays": ["MON","TUE"],
  "timeWindow": {
    "start": "09:00",
    "end": "10:00"
  },
  "attendance": true
}
```

Response
```json
{
  "qrId": "uuid",
  "qrPayload": "encrypted-string",
  "expiresAt": "2026-03-01"
}
```

---

### 5.2 QR 스캔 처리 (학생)
POST /qr/scan

```json
{
  "qrPayload": "encrypted-string",
  "deviceId": "uuid"
}
```

---

## 6. 부모 API

### 6.1 자녀 연결 (초대 코드)
POST /parents/children/link

```json
{
  "childDeviceId": "uuid",
  "relation": "FATHER | MOTHER"
}
```

---

### 6.2 자녀 상태 조회
GET /parents/children/{childId}/status

---

### 6.3 부모 임의 잠금 해제
POST /parents/children/{childId}/unlock

---

## 7. 교사 / 수업 API

### 7.1 수업 생성
POST /classes

```json
{
  "name": "중2 수학",
  "schedule": "MON 09:00-10:00"
}
```

---

### 7.2 수업 QR 생성
POST /classes/{classId}/qr

---

### 7.3 출석 조회
GET /classes/{classId}/attendance

---

## 8. 기관 관리 API

### 8.1 기관 등록 신청
POST /organizations/apply

```json
{
  "orgName": "OO학원",
  "bizNumber": "123-45-67890",
  "documentImageUrl": "s3://..."
}
```

---

### 8.2 교사 관리
POST /organizations/{orgId}/teachers

---

## 9. 관리자 (Admin) API

### 9.1 기관 승인
POST /admin/organizations/{orgId}/approve

---

### 9.2 강제 잠금 해제
POST /admin/locks/{lockId}/force-unlock

---

## 10. 알림 / 푸시

### 10.1 잠금/해제 푸시 발송 (내부)
- FCM / APNs 연동

---

## 11. 향후 확장 API
- 집중도 통계
- 앱 사용 리포트 (Android 중심)
- MDM 연동 API

---

※ 본 설계서는 MVP 기준이며, iOS 제약에 따라 실제 잠금 제어는 Guided Access / ScreenTime 연계 방식으로 동작합니다.



**API 확장**:
    - POST /qr/generate : `lock_duration`, `blocked_apps`, `time_window` 등 상세 필드 대응.
    - POST /qr/scan : 페이로드의 서명(Signature) 검증 및 스캔 시점(`time_window`) 유효성 체크.

## API 변경 설계

- POST /qr/generate

```json
{
  "type": "USER_INSTANT_LOCK",
  "policy": {
    "lock_duration": 120,
    "time_window": null,
    "schedule": null
  },
  "apps": ["youtube", "instagram"]
}
```

- POST /qr/scan

```json
{
  "qr_payload": "...",
  "device_id": "uuid"
}
```
## 현재 AWS API Gateway 적용된 API (260207)
POST /auth/kakao
POST /devices/register
POST /devices/{deviceId}/permissions
POST /qr/generate
POST /qr/scan

