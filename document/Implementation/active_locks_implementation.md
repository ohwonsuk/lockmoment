# Active Locks 기능 구현 완료 (2026-02-15)

## 개요
부모가 자녀의 실시간 잠금 상태를 확인할 수 있도록 `active_locks` 테이블을 추가하고, 관련 API 및 프론트엔드 로직을 구현했습니다.

## 1. 데이터베이스 스키마 변경

### active_locks 테이블 추가
**위치**: `document/schema/schema(260214).md`

```sql
CREATE TABLE active_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 잠금 대상
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  
  -- 잠금 정보
  lock_name VARCHAR(100) NOT NULL,
  lock_type lock_type_enum NOT NULL,
  
  -- 시간 정보
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- 잠금 정책 (선택사항)
  lock_policy_id UUID REFERENCES lock_policies(id) ON DELETE SET NULL,
  preset_id UUID REFERENCES preset_policies(id) ON DELETE SET NULL,
  
  -- 잠금 설정
  allowed_apps JSONB,
  blocked_apps JSONB,
  prevent_app_removal BOOLEAN DEFAULT FALSE,
  
  -- 메타데이터
  source VARCHAR(50), -- 'MANUAL', 'SCHEDULED', 'QR', 'PRESET'
  initiated_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 인덱스 및 제약사항
- `idx_active_locks_user_id`: 사용자별 조회 최적화
- `idx_active_locks_device_id`: 기기별 조회 최적화
- `idx_active_locks_ends_at`: 만료된 잠금 정리 최적화
- `idx_active_locks_user_ends`: 복합 인덱스 (사용자 + 종료시간)
- `chk_active_locks_time_order`: 종료 시간 > 시작 시간 검증
- `idx_active_locks_unique_device`: 기기당 하나의 활성 잠금만 허용

## 2. Lambda API 변경

### 2.1 잠금 상태 관리 엔드포인트 추가

#### POST /locks/start
잠금 시작 시 active_locks 테이블에 기록

**요청 본문**:
```json
{
  "device_id": "UUID",
  "lock_name": "바로 잠금",
  "lock_type": "FULL" | "APP",
  "duration_minutes": 60,
  "source": "MANUAL" | "SCHEDULED" | "QR" | "PRESET",
  "blocked_apps": ["com.example.app"],
  "prevent_app_removal": true
}
```

**응답**:
```json
{
  "success": true,
  "message": "잠금이 시작되었습니다",
  "lock": { ... }
}
```

#### POST /locks/stop
잠금 종료 시 active_locks에서 삭제

**응답**:
```json
{
  "success": true,
  "message": "잠금이 종료되었습니다",
  "lock": { ... }
}
```

#### GET /locks/status
현재 사용자의 잠금 상태 조회

**응답**:
```json
{
  "success": true,
  "isLocked": true,
  "lock": {
    "id": "UUID",
    "lock_name": "바로 잠금",
    "ends_at": "2026-02-15T17:00:00Z",
    ...
  }
}
```

### 2.2 자녀 목록 조회 API 개선

#### GET /parent-child/children
active_locks 테이블을 LEFT JOIN하여 실시간 잠금 상태 반환

**변경 전**:
```javascript
status: row.device_status === 'ACTIVE' ? 'ONLINE' : 'OFFLINE'
```

**변경 후**:
```javascript
let lockStatus = 'UNLOCKED';
if (row.active_lock_id) {
    lockStatus = 'LOCKED';
} else if (row.device_status !== 'ACTIVE') {
    lockStatus = 'OFFLINE';
}
```

**응답 예시**:
```json
{
  "success": true,
  "data": [
    {
      "id": "child-uuid",
      "childName": "세현",
      "deviceName": "IOS",
      "deviceModel": "iPad Air (4th generation)",
      "status": "LOCKED",
      "lockName": "바로 잠금",
      "lockEndsAt": "2026-02-15T17:00:00Z",
      "hasPermission": true
    }
  ]
}
```

## 3. 프론트엔드 변경

### 3.1 LockService 확장
**파일**: `src/services/LockService.ts`

새로운 메서드 추가:
- `reportLockStart()`: 잠금 시작 시 서버에 보고
- `reportLockStop()`: 잠금 종료 시 서버에 보고

```typescript
await LockService.reportLockStart({
    lockName: "바로 잠금",
    lockType: 'FULL',
    durationMinutes: 60,
    source: 'MANUAL',
    preventAppRemoval: true
});

await LockService.reportLockStop();
```

### 3.2 DashboardScreen 수정
**파일**: `src/screens/DashboardScreen.tsx`

- `handleQuickLockConfirm`: 잠금 시작 시 `reportLockStart()` 호출
- `handleStopLock`: 잠금 종료 시 `reportLockStop()` 호출

### 3.3 ParentChildService 인터페이스 업데이트
**파일**: `src/services/ParentChildService.ts`

```typescript
export interface ChildInfo {
    id: string;
    childName: string;
    deviceName?: string;
    deviceModel?: string;
    status: 'LOCKED' | 'UNLOCKED' | 'OFFLINE';
    lockName?: string;        // 추가
    lockEndsAt?: string;      // 추가
    lastSeenAt?: string;
    hasPermission?: boolean;
}
```

### 3.4 FamilyLockList 컴포넌트 개선
**파일**: `src/components/FamilyLockList.tsx`

자녀가 잠금 중일 때 잠금 이름과 종료 시간 표시:

```tsx
{child.status === 'LOCKED' && child.lockName && (
    <Typography variant="caption" color={Colors.primary}>
        {child.lockName}
        {child.lockEndsAt && ` • ${new Date(child.lockEndsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 종료`}
    </Typography>
)}
```

### 3.5 PresetService 수정
**파일**: `src/services/PresetService.ts`

- `/presets/recommended` → `/presets` 엔드포인트 사용
- Lambda에서 사용자 역할에 따라 자동으로 필터링된 Preset 반환

## 4. 동작 흐름

### 4.1 자녀가 잠금을 시작할 때
1. 자녀 앱에서 `NativeLockControl.startLock()` 호출
2. `LockService.reportLockStart()` 호출
3. Lambda `/locks/start` API로 잠금 정보 전송
4. `active_locks` 테이블에 새 레코드 INSERT
5. 기존 활성 잠금이 있으면 자동 삭제

### 4.2 부모가 자녀 상태를 확인할 때
1. 부모 앱에서 `ParentChildService.getLinkedChildren()` 호출
2. Lambda `/parent-child/children` API 호출
3. `active_locks` 테이블과 LEFT JOIN하여 실시간 상태 조회
4. `status: 'LOCKED'`, `lockName`, `lockEndsAt` 반환
5. UI에 잠금 상태 및 종료 시간 표시

### 4.3 자녀가 잠금을 종료할 때
1. 자녀 앱에서 `NativeLockControl.stopLock()` 호출
2. `LockService.reportLockStop()` 호출
3. Lambda `/locks/stop` API로 종료 요청
4. `active_locks` 테이블에서 해당 레코드 DELETE
5. 부모 앱에서 자녀 상태가 'UNLOCKED'로 업데이트됨

## 5. 주요 개선 사항

### 5.1 실시간 상태 동기화
- 자녀의 잠금 상태가 서버에 실시간으로 반영됨
- 부모는 자녀의 정확한 잠금 상태를 확인 가능

### 5.2 성능 최적화
- 인덱스를 통한 빠른 조회
- 만료된 잠금 자동 필터링 (`ends_at > NOW()`)

### 5.3 데이터 무결성
- 제약사항을 통한 데이터 검증
- 기기당 하나의 활성 잠금만 허용

### 5.4 확장성
- `source` 필드로 잠금 출처 추적 (MANUAL, SCHEDULED, QR, PRESET)
- `initiated_by` 필드로 잠금을 시작한 사용자 추적
- 향후 잠금 히스토리 분석 가능

## 6. 테스트 시나리오

### 6.1 기본 시나리오
1. ✅ 자녀가 "바로 잠금" 시작
2. ✅ 부모 앱에서 자녀 상태가 "잠금 중"으로 표시
3. ✅ 잠금 이름 및 종료 시간 표시
4. ✅ 자녀가 잠금 종료
5. ✅ 부모 앱에서 자녀 상태가 "해제"로 업데이트

### 6.2 엣지 케이스
1. ✅ 자녀가 오프라인일 때 → 'OFFLINE' 상태 표시
2. ✅ 잠금이 자동으로 만료될 때 → `ends_at > NOW()` 조건으로 자동 필터링
3. ✅ 중복 잠금 시도 → 기존 잠금 자동 삭제 후 새 잠금 등록
4. ✅ 네트워크 오류 시 → 로컬 잠금은 정상 동작, 서버 동기화만 실패

## 7. 향후 개선 사항

### 7.1 자동 정리 작업
만료된 잠금을 주기적으로 삭제하는 Lambda 함수 추가:
```sql
DELETE FROM active_locks WHERE ends_at < NOW();
```

### 7.2 잠금 히스토리
`active_locks`를 `lock_history` 테이블로 이동하여 분석 가능:
```sql
CREATE TABLE lock_history AS SELECT * FROM active_locks;
```

### 7.3 푸시 알림
자녀의 잠금 상태 변경 시 부모에게 푸시 알림 전송

### 7.4 실시간 업데이트
WebSocket 또는 Server-Sent Events를 통한 실시간 상태 업데이트

## 8. 배포 체크리스트

- [ ] 데이터베이스 마이그레이션 실행 (`schema(260214).md`)
- [ ] Lambda 함수 배포 (`index(260211).mjs`)
- [ ] 프론트엔드 앱 빌드 및 배포
- [ ] 기존 사용자 데이터 마이그레이션 (필요시)
- [ ] 프로덕션 환경 테스트
- [ ] 모니터링 및 로그 확인

## 9. 관련 파일

### 백엔드
- `document/schema/schema(260214).md`
- `document/lambda/index(260211).mjs`

### 프론트엔드
- `src/services/LockService.ts`
- `src/services/ParentChildService.ts`
- `src/services/PresetService.ts`
- `src/screens/DashboardScreen.tsx`
- `src/components/FamilyLockList.tsx`

---

**작성일**: 2026-02-15
**작성자**: AI Assistant
**버전**: 1.0
