# LockMoment Feature Implementation Summary

## 구현 완료된 기능

### 1. ✅ 시간 설정 UI 수정
**파일**: `src/screens/QRGeneratorScreen.tsx`

**변경 사항**:
- ':' 구분자를 오전/오후와 시 사이에서 → 시와 분 사이로 이동 제거
- 시간과 분에 각각 "시", "분" 단위 표시 추가
- 숫자가 박스 중앙에 정렬되도록 `justifyContent: 'center', alignItems: 'center'` 스타일 추가
- 분 조정은 기존대로 5분 단위로 유지
- 사용자 안내 메시지 추가

**UI 개선**:
```
이전: [오후] : [9시] [46분]
이후: [오후] [9시] [46분]
```

### 2. ✅ 예약 잠금 저장 기능
**파일**: `src/screens/QRGeneratorScreen.tsx`

**변경 사항**:
- `handleSaveSchedule` 함수 개선
- 저장 성공 시 상세 정보 표시 (잠금 제목, 시간, 요일)
- 성공한 자녀 수 카운트 추가
- 자녀 이름 표시 개선

**기능**:
- QR 생성 시 스케줄을 DB에 저장
- 전체 자녀 또는 특정 자녀 선택 가능
- 저장된 스케줄은 목록에서 확인 가능
- `ParentChildService.saveChildSchedule()` API 활용

### 3. ✅ 권한 상태 아이콘
**파일**: 
- `src/components/Header.tsx` (기존 로직 활용)
- `src/screens/DashboardScreen.tsx` (hasPermission prop 전달)

**변경 사항**:
- Dashboard에서 권한 상태를 Header에 전달
- 관리자 대시보드에도 권한 상태 표시 추가
- Header의 shield 아이콘 색상:
  - 🟢 Green (#10B981): 권한 허용됨
  - 🔴 Red (#EF4444): 권한 거부됨
  - ⚪ Grey (Colors.text): 권한 상태 미확인

### 4. ✅ 자녀 권한 확인
**파일**: 
- `src/screens/QRScannerScreen.tsx`
- `src/screens/DashboardScreen.tsx`
- `src/screens/LinkSubUserScreen.tsx`

**변경 사항**:

#### QR 스캔 시 권한 확인:
- `handleConfirmLock` 함수에 권한 체크 로직 추가
- iOS: Screen Time 권한 확인 (`checkAuthorization`)
- Android: Accessibility 권한 확인 (`checkAccessibilityPermission`)
- 권한 미허용 시 → 권한 설정 페이지로 이동 안내 Alert 표시

#### 자녀 목록에 권한 상태 표시:
- Dashboard의 관리 대상 리스트에 권한 배지 추가
- LinkSubUserScreen과 동일한 UI 패턴 사용
- 권한 상태별 아이콘:
  - ✅ 허용: checkmark-circle (green)
  - ❌ 필요: close-circle (red)
  - ❓ 미확인: help-circle (grey)

**스타일 추가**:
```typescript
permissionBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
}
```

### 5. ✅ DB 스키마 확인
**파일**: `DATABASE_SCHEMA_UPDATES.md` (새로 생성)

**내용**:
- 필요한 테이블 및 필드 정의
- `devices` 테이블: 권한 상태 필드 추가
  - `accessibility_permission` (Android)
  - `screen_time_permission` (iOS)
  - `notification_permission` (공통)
  - `last_permission_sync`
- `child_schedules` 테이블: 예약 잠금 저장
- `qr_codes` 테이블: QR 코드 추적
- API 엔드포인트 명세
- 구현 노트 및 테스트 체크리스트

## 기술적 세부사항

### 권한 동기화 흐름
1. **자녀 기기**:
   - Dashboard 로드 시 권한 상태 확인
   - `AuthService.syncPermissions()` 호출
   - Backend의 `devices` 테이블 업데이트

2. **부모 기기**:
   - `ParentChildService.getLinkedChildren()` 호출
   - Backend에서 자녀의 device 정보와 JOIN
   - `hasPermission` 필드 포함하여 반환

3. **QR 스캔 시**:
   - 잠금 실행 전 권한 확인
   - 미허용 시 권한 설정 페이지로 안내
   - 허용 시 정상 잠금 진행

### 데이터 모델

#### ChildInfo Interface
```typescript
export interface ChildInfo {
    id: string;
    childName: string;
    deviceName?: string;
    status: 'LOCKED' | 'UNLOCKED' | 'OFFLINE';
    lastSeenAt?: string;
    hasPermission?: boolean; // 새로 추가
}
```

#### Schedule Data
```typescript
{
    name: string;           // 잠금 제목
    startTime: string;      // "HH:mm" 형식
    endTime: string;        // "HH:mm" 형식
    days: string[];         // ['월', '화', '수', ...]
    apps: string[];         // 앱 ID 배열
    isActive: boolean;      // 활성화 여부
}
```

## 백엔드 구현 필요 사항

### 1. API 엔드포인트
- ✅ `GET /parent-child/children` - 권한 상태 포함
- ✅ `POST /parent-child/:childId/schedules` - 스케줄 저장
- ✅ `PATCH /devices/:deviceId/permissions` - 권한 동기화

### 2. 데이터베이스 마이그레이션
- `devices` 테이블에 권한 필드 추가
- `child_schedules` 테이블 생성
- 인덱스 생성 (성능 최적화)

### 3. 비즈니스 로직
- 자녀 조회 시 device 정보 JOIN
- 권한 상태 계산 로직
- 스케줄 CRUD 작업

## 테스트 시나리오

### 시간 설정 UI
- [ ] 시간 선택 시 "시", "분" 단위가 표시되는지 확인
- [ ] 숫자가 박스 중앙에 정렬되는지 확인
- [ ] 분 조정이 5분 단위로 작동하는지 확인

### 예약 저장
- [ ] QR 생성 후 "예약 저장" 버튼 클릭
- [ ] 저장 성공 메시지에 상세 정보 표시 확인
- [ ] 저장된 스케줄이 목록에 나타나는지 확인

### 권한 상태
- [ ] 권한 허용 시 헤더 아이콘이 초록색인지 확인
- [ ] 권한 거부 시 헤더 아이콘이 빨간색인지 확인
- [ ] 권한 미확인 시 헤더 아이콘이 회색인지 확인

### QR 스캔 권한 확인
- [ ] 권한 없이 QR 스캔 시 안내 메시지 표시
- [ ] "권한 설정" 버튼으로 Permissions 화면 이동
- [ ] 권한 허용 후 정상 잠금 실행

### 자녀 목록 권한 표시
- [ ] 자녀 목록에 권한 배지 표시
- [ ] 권한 상태별 색상 및 아이콘 확인
- [ ] 여러 자녀의 권한 상태가 개별적으로 표시되는지 확인

## 주의사항

1. **플랫폼별 권한 체크**:
   - iOS: `checkAuthorization()` → authStatus === 2
   - Android: `checkAccessibilityPermission()` → boolean

2. **권한 동기화 타이밍**:
   - Dashboard 로드 시
   - 권한 설정 변경 후
   - 주기적 백그라운드 동기화 (선택사항)

3. **에러 처리**:
   - API 호출 실패 시 fallback 데이터 사용
   - 권한 체크 실패 시 안전하게 처리
   - 사용자에게 명확한 에러 메시지 제공

## 다음 단계

1. **백엔드 구현**:
   - DATABASE_SCHEMA_UPDATES.md 참조하여 DB 마이그레이션
   - API 엔드포인트 구현
   - 권한 동기화 로직 구현

2. **테스트**:
   - 각 기능별 단위 테스트
   - 통합 테스트 (부모-자녀 연동)
   - 플랫폼별 테스트 (iOS/Android)

3. **최적화**:
   - 권한 상태 캐싱
   - API 호출 최소화
   - 로딩 상태 개선

4. **문서화**:
   - 사용자 가이드 업데이트
   - API 문서 작성
   - 개발자 문서 업데이트
