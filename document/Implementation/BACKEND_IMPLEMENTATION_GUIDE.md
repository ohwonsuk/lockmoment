# 백엔드 구현 업데이트 가이드

## 📋 개요

기존 AWS RDS 데이터베이스와 API Gateway/Lambda 구조를 기반으로 새로운 기능을 추가하기 위한 백엔드 구현 가이드입니다.

**기존 구현 상태**:
- ✅ AWS RDS PostgreSQL 데이터베이스
- ✅ AWS API Gateway + Lambda (Node.js)
- ✅ 기본 QR 생성/스캔 기능
- ✅ 디바이스 등록 및 권한 업데이트

**신규 구현 필요**:
1. 권한 상태 추적 (devices 테이블 확장)
2. 부모-자녀 관계 및 스케줄 관리
3. 자녀 목록 조회 시 권한 상태 포함
4. QR 생성 시 스케줄 저장

---

## 🗄️ 데이터베이스 마이그레이션

### 1. devices 테이블 권한 필드 추가

```sql
-- 권한 상태 추적을 위한 개별 필드 추가
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS accessibility_permission BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS screen_time_permission BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notification_permission BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_permission_sync TIMESTAMPTZ;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at);

-- 기존 permission_status JSONB는 유지 (하위 호환성)
-- 새로운 개별 필드와 병행 사용
```

**참고**: 
- 기존 `permission_status JSONB` 필드는 유지하되, 새로운 개별 boolean 필드를 추가합니다.
- 클라이언트는 개별 필드로 업데이트하고, 조회 시에도 개별 필드를 사용합니다.

### 2. parent_child 테이블 확인 및 수정

기존 스키마에 `parent_child` 테이블이 있으므로 확인만 하면 됩니다:

```sql
-- 기존 테이블 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'parent_child';

-- 필요시 relation enum 타입 확장
-- ALTER TYPE relation_enum ADD VALUE IF NOT EXISTS 'TEACHER';
```

### 3. child_schedules 테이블 생성 (신규)

```sql
-- 부모가 자녀를 위해 생성한 예약 잠금 스케줄
CREATE TABLE IF NOT EXISTS child_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days TEXT[] NOT NULL, -- ['월', '화', '수', '목', '금']
    apps TEXT[] NOT NULL, -- universal app IDs
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 부모-자녀 관계 검증
    CONSTRAINT fk_parent_child_relation 
        FOREIGN KEY (parent_id, child_id) 
        REFERENCES parent_child(parent_id, child_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_child_schedules_child_id ON child_schedules(child_id);
CREATE INDEX IF NOT EXISTS idx_child_schedules_parent_id ON child_schedules(parent_id);
CREATE INDEX IF NOT EXISTS idx_child_schedules_active ON child_schedules(is_active);

-- 자동 updated_at 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_child_schedules_updated_at 
    BEFORE UPDATE ON child_schedules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

### 4. qr_codes 테이블 확장 (선택사항)

기존 테이블에 추가 타입 지원:

```sql
-- qr_type 체크 제약 조건 업데이트
ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_qr_type_check;

ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_qr_type_check 
CHECK (qr_type IN (
    'CLASS_ATTEND',
    'USER_INSTANT_LOCK',
    'USER_SCHEDULE_LOCK',
    'CHILD_REGISTRATION',  -- 신규: 자녀 등록용
    'PARENT_LINK'          -- 신규: 부모 연결용
));
```

---

## 🔧 Lambda 함수 업데이트

### 기존 Lambda 함수 구조
현재 `index.mjs` 파일에 모든 엔드포인트가 하나의 핸들러에 구현되어 있습니다.

### 권장 구조 개선
가독성과 유지보수를 위해 핸들러를 분리하는 것을 권장합니다:

```
lambda/
├── index.mjs              # 메인 라우터
├── handlers/
│   ├── auth.mjs          # 인증 관련
│   ├── devices.mjs       # 디바이스 관련
│   ├── qr.mjs            # QR 관련
│   ├── parentChild.mjs   # 부모-자녀 관련 (신규)
│   └── schedules.mjs     # 스케줄 관련 (신규)
└── utils/
    ├── db.mjs            # DB 연결
    ├── response.mjs      # 응답 헬퍼
    └── validation.mjs    # 검증 로직
```

하지만 기존 구조를 유지하면서 기능만 추가하는 방식으로도 진행 가능합니다.

---

## 📝 신규 API 엔드포인트 구현

### 1. 권한 상태 업데이트 (기존 개선)

**엔드포인트**: `PATCH /devices/{deviceId}/permissions`

**기존 코드 수정**:
```javascript
// 기존: permission_status JSONB로만 저장
// 개선: 개별 필드로도 저장

if (httpMethod === 'PATCH' && requestPath.includes('/permissions')) {
    const pathParts = requestPath.split('/');
    const deviceId = pathParts[pathParts.length - 2];
    
    const { accessibility, screenTime, notification } = data;
    
    const query = `
        UPDATE devices 
        SET 
            accessibility_permission = COALESCE($1, accessibility_permission),
            screen_time_permission = COALESCE($2, screen_time_permission),
            notification_permission = COALESCE($3, notification_permission),
            permission_status = $4,
            last_permission_sync = NOW(),
            last_seen_at = NOW()
        WHERE id = $5 OR device_uuid = $5::text
        RETURNING *;
    `;
    
    const result = await client.query(query, [
        accessibility,
        screenTime,
        notification,
        JSON.stringify(data), // 하위 호환성을 위해 JSONB도 유지
        deviceId
    ]);
    
    if (result.rows.length === 0) {
        return response(404, { success: false, message: "Device not found" });
    }
    
    return response(200, { 
        success: true, 
        device: result.rows[0],
        message: "Permissions updated successfully"
    });
}
```

### 2. 자녀 목록 조회 (신규)

**엔드포인트**: `GET /parent-child/children`

```javascript
// GET /parent-child/children
if (httpMethod === 'GET' && requestPath.endsWith('/parent-child/children')) {
    // Authorization 헤더에서 userId 추출 (실제로는 JWT 검증 필요)
    const userId = event.requestContext?.authorizer?.userId || data.userId;
    
    if (!userId) {
        return response(401, { success: false, message: "Unauthorized" });
    }
    
    const query = `
        SELECT 
            u.id,
            u.name as child_name,
            d.device_model as device_name,
            d.last_seen_at,
            CASE 
                WHEN d.platform = 'IOS' THEN d.screen_time_permission
                WHEN d.platform = 'ANDROID' THEN d.accessibility_permission
                ELSE NULL
            END as has_permission,
            CASE
                WHEN d.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 'ONLINE'
                WHEN d.last_seen_at > NOW() - INTERVAL '1 hour' THEN 'OFFLINE'
                ELSE 'OFFLINE'
            END as status
        FROM parent_child pc
        JOIN users u ON pc.child_id = u.id
        LEFT JOIN devices d ON d.user_id = u.id
        WHERE pc.parent_id = $1 AND pc.approved = TRUE
        ORDER BY u.name;
    `;
    
    const result = await client.query(query, [userId]);
    
    return response(200, {
        success: true,
        data: result.rows.map(row => ({
            id: row.id,
            childName: row.child_name,
            deviceName: row.device_name,
            status: row.status,
            lastSeenAt: row.last_seen_at,
            hasPermission: row.has_permission
        }))
    });
}
```

### 3. 자녀 스케줄 저장 (신규)

**엔드포인트**: `POST /parent-child/:childId/schedules`

```javascript
// POST /parent-child/{childId}/schedules
if (httpMethod === 'POST' && requestPath.includes('/parent-child/') && requestPath.endsWith('/schedules')) {
    const pathParts = requestPath.split('/');
    const childId = pathParts[pathParts.indexOf('parent-child') + 1];
    const userId = event.requestContext?.authorizer?.userId || data.userId;
    
    if (!userId) {
        return response(401, { success: false, message: "Unauthorized" });
    }
    
    const { name, startTime, endTime, days, apps, isActive } = data;
    
    // 유효성 검사
    if (!name || !startTime || !endTime || !days || !apps) {
        return response(400, { 
            success: false, 
            message: "Missing required fields: name, startTime, endTime, days, apps" 
        });
    }
    
    // 부모-자녀 관계 확인
    const relationCheck = await client.query(
        `SELECT 1 FROM parent_child 
         WHERE parent_id = $1 AND child_id = $2 AND approved = TRUE`,
        [userId, childId]
    );
    
    if (relationCheck.rows.length === 0) {
        return response(403, { 
            success: false, 
            message: "You don't have permission to manage this child's schedule" 
        });
    }
    
    // 스케줄 저장
    const insertQuery = `
        INSERT INTO child_schedules 
        (child_id, parent_id, name, start_time, end_time, days, apps, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;
    
    const result = await client.query(insertQuery, [
        childId,
        userId,
        name,
        startTime,
        endTime,
        days,
        apps,
        isActive !== undefined ? isActive : true
    ]);
    
    return response(201, {
        success: true,
        data: result.rows[0],
        message: "Schedule created successfully"
    });
}
```

### 4. 자녀 스케줄 조회 (신규)

**엔드포인트**: `GET /parent-child/:childId/schedules`

```javascript
// GET /parent-child/{childId}/schedules
if (httpMethod === 'GET' && requestPath.includes('/parent-child/') && requestPath.endsWith('/schedules')) {
    const pathParts = requestPath.split('/');
    const childId = pathParts[pathParts.indexOf('parent-child') + 1];
    const userId = event.requestContext?.authorizer?.userId || data.userId;
    
    if (!userId) {
        return response(401, { success: false, message: "Unauthorized" });
    }
    
    // 부모-자녀 관계 확인 또는 본인 확인
    const authCheck = await client.query(
        `SELECT 1 FROM parent_child 
         WHERE (parent_id = $1 AND child_id = $2) OR $2 = $1`,
        [userId, childId]
    );
    
    if (authCheck.rows.length === 0) {
        return response(403, { 
            success: false, 
            message: "Access denied" 
        });
    }
    
    const query = `
        SELECT * FROM child_schedules
        WHERE child_id = $1
        ORDER BY created_at DESC;
    `;
    
    const result = await client.query(query, [childId]);
    
    return response(200, {
        success: true,
        data: result.rows
    });
}
```

### 5. QR 스캔 시 권한 확인 (기존 개선)

**엔드포인트**: `POST /qr/scan`

기존 코드에 권한 확인 로직 추가:

```javascript
// POST /qr/scan (기존 코드에 추가)
if (httpMethod === 'POST' && requestPath.endsWith('/qr/scan')) {
    const { qrPayload, deviceId } = data;
    const { qr_id, exp, sig } = JSON.parse(qrPayload);
    
    // ... 기존 검증 로직 ...
    
    // 디바이스 권한 확인 추가
    const deviceCheck = await client.query(`
        SELECT 
            id, 
            platform,
            accessibility_permission,
            screen_time_permission
        FROM devices 
        WHERE id = $1 OR device_uuid = $1::text 
        LIMIT 1
    `, [deviceId]);
    
    if (deviceCheck.rows.length === 0) {
        return response(404, { 
            success: false, 
            message: "Device not found" 
        });
    }
    
    const device = deviceCheck.rows[0];
    const dbDeviceId = device.id;
    
    // 플랫폼별 권한 확인
    let hasPermission = false;
    if (device.platform === 'IOS') {
        hasPermission = device.screen_time_permission === true;
    } else if (device.platform === 'ANDROID') {
        hasPermission = device.accessibility_permission === true;
    }
    
    // 권한 없으면 에러 반환 (클라이언트에서 권한 설정 페이지로 이동)
    if (!hasPermission) {
        return response(403, {
            success: false,
            requiresPermission: true,
            message: "Required permissions not granted",
            platform: device.platform
        });
    }
    
    // ... 나머지 기존 로직 ...
}
```

---

## 🚀 배포 단계

### 1. 데이터베이스 마이그레이션

```bash
# AWS RDS에 접속하여 마이그레이션 SQL 실행
psql -h your-rds-endpoint.amazonaws.com -U your-username -d lockmoment -f migration.sql
```

### 2. Lambda 함수 업데이트

```bash
# Lambda 함수 코드 업데이트
cd lambda
zip -r function.zip .
aws lambda update-function-code \
    --function-name LockMomentAPI \
    --zip-file fileb://function.zip
```

### 3. API Gateway 라우트 추가

AWS Console 또는 CLI를 통해 새로운 라우트 추가:

```
GET  /parent-child/children
GET  /parent-child/{childId}/schedules
POST /parent-child/{childId}/schedules
PUT  /parent-child/{childId}/schedules/{scheduleId}
DELETE /parent-child/{childId}/schedules/{scheduleId}
```

---

## 🧪 테스트

### 1. 권한 업데이트 테스트

```bash
curl -X PATCH https://your-api-gateway-url/devices/{deviceId}/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "accessibility": true,
    "screenTime": false,
    "notification": true
  }'
```

### 2. 자녀 목록 조회 테스트

```bash
curl -X GET https://your-api-gateway-url/parent-child/children \
  -H "Authorization: Bearer {token}"
```

### 3. 스케줄 저장 테스트

```bash
curl -X POST https://your-api-gateway-url/parent-child/{childId}/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "저녁 공부 시간",
    "startTime": "18:00",
    "endTime": "20:00",
    "days": ["월", "화", "수", "목", "금"],
    "apps": ["youtube", "instagram", "tiktok"],
    "isActive": true
  }'
```

---

## 📊 모니터링 및 로깅

### CloudWatch 로그 확인

```bash
aws logs tail /aws/lambda/LockMomentAPI --follow
```

### 주요 모니터링 지표

1. **API 응답 시간**: 평균 < 500ms
2. **에러율**: < 1%
3. **DB 연결 풀 사용률**: < 80%
4. **권한 업데이트 성공률**: > 95%

---

## 🔒 보안 고려사항

### 1. JWT 인증 강화

현재 Lambda에서 userId를 직접 받고 있는데, 실제로는 JWT 토큰 검증이 필요합니다:

```javascript
// utils/auth.mjs
import jwt from 'jsonwebtoken';

export function verifyToken(event) {
    const token = event.headers?.Authorization?.replace('Bearer ', '');
    if (!token) return null;
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.userId;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}
```

### 2. SQL Injection 방지

✅ 이미 parameterized queries 사용 중 (안전)

### 3. Rate Limiting

API Gateway에서 Rate Limiting 설정 권장:
- 일반 사용자: 100 req/min
- 관리자: 1000 req/min

---

## 📝 체크리스트

### 데이터베이스
- [ ] devices 테이블에 권한 필드 추가
- [ ] child_schedules 테이블 생성
- [ ] 인덱스 생성
- [ ] 트리거 설정 (updated_at)

### Lambda 함수
- [ ] 권한 업데이트 API 개선
- [ ] 자녀 목록 조회 API 구현
- [ ] 스케줄 CRUD API 구현
- [ ] QR 스캔 시 권한 확인 추가

### API Gateway
- [ ] 새로운 라우트 추가
- [ ] CORS 설정
- [ ] Rate Limiting 설정

### 테스트
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] 부하 테스트

### 배포
- [ ] 스테이징 환경 배포
- [ ] 프로덕션 배포
- [ ] 롤백 계획 수립

---

## 🎯 우선순위

### Phase 1 (즉시 구현)
1. ✅ devices 테이블 권한 필드 추가
2. ✅ 권한 업데이트 API 개선
3. ✅ 자녀 목록 조회 API (권한 포함)

### Phase 2 (1주일 내)
4. ✅ child_schedules 테이블 생성
5. ✅ 스케줄 저장/조회 API
6. ✅ QR 스캔 시 권한 확인

### Phase 3 (향후 개선)
7. JWT 인증 강화
8. 에러 핸들링 개선
9. 로깅 및 모니터링 강화
10. 성능 최적화

---

## 💡 참고사항

1. **기존 코드 호환성**: 기존 `permission_status` JSONB 필드는 유지하여 하위 호환성 보장
2. **점진적 마이그레이션**: 클라이언트는 새로운 API를 사용하되, 기존 API도 당분간 유지
3. **에러 처리**: 모든 API는 일관된 에러 응답 형식 사용
4. **문서화**: API 변경사항은 lockmoment_api.md에 반영

---

이 가이드를 따라 단계별로 구현하시면 됩니다. 추가 질문이나 구체적인 코드 예제가 필요하시면 말씀해주세요!
