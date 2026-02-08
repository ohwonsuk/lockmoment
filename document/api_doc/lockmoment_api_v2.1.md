# LockMoment API 업데이트 (2026-02-08)

## 📋 변경 사항 요약

### 신규 API 엔드포인트
1. `GET /parent-child/children` - 자녀 목록 조회 (권한 상태 포함)
2. `GET /parent-child/{childId}/schedules` - 자녀 스케줄 조회
3. `POST /parent-child/{childId}/schedules` - 자녀 스케줄 생성

### 개선된 API
1. `PATCH /devices/{deviceId}/permissions` - 개별 권한 필드 지원
2. `POST /qr/scan` - 권한 확인 로직 추가

---

## 🔐 인증

모든 API는 다음 헤더를 포함해야 합니다:

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

일부 디바이스 관련 API는 비인증 요청을 허용합니다.

---

## 📱 디바이스 API

### 1. 디바이스 등록
**기존 유지**

`POST /devices/register`

**Request**:
```json
{
  "id": "uuid",
  "device_uuid": "unique-device-id",
  "platform": "IOS | ANDROID",
  "device_model": "iPhone 14 Pro",
  "os_version": "17.2",
  "app_version": "1.0.0"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Device registered",
  "device": {
    "id": "uuid",
    "device_uuid": "unique-device-id",
    "platform": "IOS",
    ...
  }
}
```

---

### 2. 권한 상태 업데이트 (개선)
`PATCH /devices/{deviceId}/permissions`

**Request**:
```json
{
  "accessibility": true,      // Android Accessibility Service
  "screenTime": true,          // iOS Screen Time/Family Controls
  "notification": true         // 알림 권한 (공통)
}
```

**Response**:
```json
{
  "success": true,
  "message": "Permissions updated successfully",
  "device": {
    "id": "uuid",
    "accessibility_permission": true,
    "screen_time_permission": true,
    "notification_permission": true,
    "last_permission_sync": "2026-02-08T13:45:00Z",
    ...
  }
}
```

**변경 사항**:
- 개별 boolean 필드로 권한 상태 저장
- `last_permission_sync` 타임스탬프 자동 업데이트
- 기존 `permission_status` JSONB 필드도 하위 호환성을 위해 유지

---

## 🔒 QR 코드 API

### 3. QR 생성
**기존 유지**

`POST /qr/generate`

**Request**:
```json
{
  "type": "USER_INSTANT_LOCK | USER_SCHEDULE_LOCK | CLASS_ATTEND",
  "duration_minutes": 60,
  "blocked_apps": ["youtube", "instagram", "tiktok"],
  "time_window": "09:00-10:00",
  "days": ["월", "화", "수", "목", "금"],
  "userId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "qr_id": "uuid",
  "payload": "{\"qr_id\":\"uuid\",\"exp\":1234567890,\"sig\":\"hmac-signature\"}"
}
```

---

### 4. QR 스캔 (개선)
`POST /qr/scan`

**Request**:
```json
{
  "qrPayload": "{\"qr_id\":\"uuid\",\"exp\":1234567890,\"sig\":\"hmac-signature\"}",
  "deviceId": "uuid"
}
```

**Success Response**:
```json
{
  "success": true,
  "lockPolicy": {
    "name": "집중 모드",
    "durationMinutes": 60,
    "allowedApps": ["youtube", "instagram"]
  }
}
```

**Permission Required Error (신규)**:
```json
{
  "success": false,
  "requiresPermission": true,
  "message": "Required permissions not granted",
  "platform": "IOS | ANDROID"
}
```

**변경 사항**:
- QR 스캔 전 디바이스 권한 확인
- iOS: `screen_time_permission` 체크
- Android: `accessibility_permission` 체크
- 권한 없으면 `403` 에러와 함께 `requiresPermission: true` 반환

**클라이언트 처리**:
```typescript
const response = await scanQR(qrPayload, deviceId);
if (response.requiresPermission) {
  // 권한 설정 페이지로 이동
  navigation.navigate('Permissions');
}
```

---

## 👨‍👩‍👧‍👦 부모-자녀 관계 API

### 5. 자녀 목록 조회 (신규)
`GET /parent-child/children`

**Headers**:
```
Authorization: Bearer {parent_access_token}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "child-uuid-1",
      "childName": "김철수",
      "deviceName": "iPhone 14",
      "status": "ONLINE | OFFLINE",
      "lastSeenAt": "2026-02-08T13:45:00Z",
      "hasPermission": true
    },
    {
      "id": "child-uuid-2",
      "childName": "김영희",
      "deviceName": "Galaxy S24",
      "status": "OFFLINE",
      "lastSeenAt": "2026-02-08T12:30:00Z",
      "hasPermission": false
    }
  ]
}
```

**필드 설명**:
- `hasPermission`: 플랫폼별 필수 권한 허용 여부
  - iOS: `screen_time_permission`
  - Android: `accessibility_permission`
  - `null`: 권한 상태 미확인
- `status`: 
  - `ONLINE`: 5분 이내 활동
  - `OFFLINE`: 5분 이상 비활동

---

### 6. 자녀 스케줄 조회 (신규)
`GET /parent-child/{childId}/schedules`

**Headers**:
```
Authorization: Bearer {parent_access_token}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "schedule-uuid",
      "child_id": "child-uuid",
      "parent_id": "parent-uuid",
      "name": "저녁 공부 시간",
      "start_time": "18:00:00",
      "end_time": "20:00:00",
      "days": ["월", "화", "수", "목", "금"],
      "apps": ["youtube", "instagram", "tiktok"],
      "is_active": true,
      "created_at": "2026-02-08T10:00:00Z",
      "updated_at": "2026-02-08T10:00:00Z"
    }
  ]
}
```

**권한**:
- 부모: 자신의 자녀 스케줄 조회 가능
- 자녀: 본인의 스케줄 조회 가능

---

### 7. 자녀 스케줄 생성 (신규)
`POST /parent-child/{childId}/schedules`

**Headers**:
```
Authorization: Bearer {parent_access_token}
```

**Request**:
```json
{
  "name": "저녁 공부 시간",
  "startTime": "18:00",
  "endTime": "20:00",
  "days": ["월", "화", "수", "목", "금"],
  "apps": ["youtube", "instagram", "tiktok"],
  "isActive": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Schedule created successfully",
  "data": {
    "id": "schedule-uuid",
    "child_id": "child-uuid",
    "parent_id": "parent-uuid",
    "name": "저녁 공부 시간",
    "start_time": "18:00:00",
    "end_time": "20:00:00",
    "days": ["월", "화", "수", "목", "금"],
    "apps": ["youtube", "instagram", "tiktok"],
    "is_active": true,
    "created_at": "2026-02-08T13:45:00Z",
    "updated_at": "2026-02-08T13:45:00Z"
  }
}
```

**Error Responses**:

**400 Bad Request** - 필수 필드 누락:
```json
{
  "success": false,
  "message": "Missing required fields: name, startTime, endTime, days, apps"
}
```

**403 Forbidden** - 권한 없음:
```json
{
  "success": false,
  "message": "You don't have permission to manage this child's schedule"
}
```

---

## 🔄 데이터 모델

### Device (업데이트)
```typescript
interface Device {
  id: string;
  user_id?: string;
  device_uuid: string;
  platform: 'IOS' | 'ANDROID';
  device_model: string;
  os_version: string;
  app_version: string;
  
  // 신규 필드
  accessibility_permission?: boolean;  // Android
  screen_time_permission?: boolean;    // iOS
  notification_permission?: boolean;   // 공통
  last_permission_sync?: string;       // ISO 8601
  
  // 기존 필드 (하위 호환성)
  permission_status?: object;
  last_seen_at?: string;
  created_at: string;
}
```

### ChildSchedule (신규)
```typescript
interface ChildSchedule {
  id: string;
  child_id: string;
  parent_id: string;
  name: string;
  start_time: string;  // "HH:mm:ss"
  end_time: string;    // "HH:mm:ss"
  days: string[];      // ["월", "화", "수", ...]
  apps: string[];      // universal app IDs
  is_active: boolean;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}
```

### ChildInfo (프론트엔드)
```typescript
interface ChildInfo {
  id: string;
  childName: string;
  deviceName?: string;
  status: 'ONLINE' | 'OFFLINE';
  lastSeenAt?: string;
  hasPermission?: boolean;  // 신규
}
```

---

## 🚀 마이그레이션 가이드

### 클라이언트 업데이트

#### 1. 권한 동기화
```typescript
// 기존
await AuthService.syncPermissions({ 
  permissions: { accessibility: true } 
});

// 신규 (개별 필드)
await AuthService.syncPermissions({
  accessibility: true,
  screenTime: true,
  notification: true
});
```

#### 2. 자녀 목록 조회
```typescript
// 신규
const response = await ParentChildService.getLinkedChildren();
// response.data[0].hasPermission 사용 가능
```

#### 3. 스케줄 저장
```typescript
// 신규
const schedule = {
  name: "저녁 공부 시간",
  startTime: "18:00",
  endTime: "20:00",
  days: ["월", "화", "수", "목", "금"],
  apps: ["youtube", "instagram"],
  isActive: true
};

await ParentChildService.saveChildSchedule(childId, schedule);
```

---

## 📊 API 엔드포인트 전체 목록

### 기존 API (유지)
- `POST /auth/kakao` - 카카오 로그인
- `POST /devices/register` - 디바이스 등록
- `POST /qr/generate` - QR 생성

### 개선된 API
- `PATCH /devices/{deviceId}/permissions` - 권한 업데이트 (개별 필드 지원)
- `POST /qr/scan` - QR 스캔 (권한 확인 추가)

### 신규 API
- `GET /parent-child/children` - 자녀 목록 조회
- `GET /parent-child/{childId}/schedules` - 자녀 스케줄 조회
- `POST /parent-child/{childId}/schedules` - 자녀 스케줄 생성

### 향후 구현 예정
- `PUT /parent-child/{childId}/schedules/{scheduleId}` - 스케줄 수정
- `DELETE /parent-child/{childId}/schedules/{scheduleId}` - 스케줄 삭제
- `POST /parent-child/link` - 자녀 연결
- `GET /locks/history` - 잠금 이력 조회

---

## 🔧 개발 환경 설정

### 환경 변수
```bash
DB_HOST=your-rds-endpoint.amazonaws.com
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=lockmoment
DB_PORT=5432
QR_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

### 테스트 URL
```
Base URL: https://18gffqu5rb.execute-api.ap-northeast-2.amazonaws.com
```

---

## 📝 변경 이력

### 2026-02-08
- 권한 상태 추적 기능 추가 (devices 테이블)
- 부모-자녀 스케줄 관리 API 추가
- QR 스캔 시 권한 확인 로직 추가
- 자녀 목록 조회 시 권한 상태 포함

### 2026-02-07 (기존)
- 기본 QR 생성/스캔 기능
- 디바이스 등록
- 카카오 로그인

---

## 🐛 알려진 이슈

1. **JWT 인증**: 현재 간단한 구현, 향후 jwt.verify로 개선 필요
2. **Rate Limiting**: API Gateway에서 설정 필요
3. **에러 로깅**: CloudWatch 로그 모니터링 강화 필요

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. CloudWatch Logs: `/aws/lambda/LockMomentAPI`
2. API Gateway 로그
3. RDS 연결 상태

---

**Last Updated**: 2026-02-08
**API Version**: 2.1.0
