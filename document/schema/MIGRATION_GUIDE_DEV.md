# 개발 환경 데이터베이스 마이그레이션 가이드

## ⚠️ 중요 안내

이 가이드는 **개발 환경 전용**입니다. 프로덕션 환경에서는 사용하지 마세요!

---

## 🚀 빠른 시작

### 1. 마이그레이션 실행

```bash
# PostgreSQL 접속 및 마이그레이션 실행
psql -h your-rds-endpoint.amazonaws.com \
     -U postgres \
     -d lockmoment \
     -f backup/schema/migration_20260208.sql
```

### 2. 실행 결과 확인

성공 시 다음과 같은 메시지가 표시됩니다:

```
NOTICE:  ========================================
NOTICE:  마이그레이션 완료!
NOTICE:  ========================================
NOTICE:  생성된 테이블:
NOTICE:    - devices (권한 필드 포함)
NOTICE:    - parent_child
NOTICE:    - child_schedules
NOTICE:  
NOTICE:  생성된 인덱스: 12개
NOTICE:  생성된 RLS 정책: 3개
NOTICE:  생성된 트리거: 1개
NOTICE:  ========================================
NOTICE:  완료 시간: 2026-02-08 23:05:22.123456+09
NOTICE:  ========================================
COMMIT
```

---

## 📋 변경 사항

### DROP된 테이블
- ❌ `devices` (기존 데이터 삭제)
- ❌ `parent_child` (기존 데이터 삭제)
- ❌ `child_schedules` (기존 데이터 삭제)

### 재생성된 테이블

#### 1. devices
```sql
- id (UUID)
- user_id (UUID)
- device_uuid (TEXT, UNIQUE)
- platform (TEXT)
- device_model (TEXT)
- os_version (TEXT)
- app_version (TEXT)
- accessibility_permission (BOOLEAN) ← 신규
- screen_time_permission (BOOLEAN) ← 신규
- notification_permission (BOOLEAN) ← 신규
- last_permission_sync (TIMESTAMPTZ) ← 신규
- permission_status (JSONB)
- last_seen_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
```

#### 2. parent_child
```sql
- id (UUID)
- parent_id (UUID)
- child_id (UUID)
- relation (relation_enum)
- approved (BOOLEAN)
- created_at (TIMESTAMPTZ)
```

#### 3. child_schedules (신규)
```sql
- id (UUID)
- child_id (UUID)
- parent_id (UUID)
- name (VARCHAR)
- start_time (TIME)
- end_time (TIME)
- days (TEXT[])
- apps (TEXT[])
- is_active (BOOLEAN)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### 생성된 인덱스 (12개)

**devices**:
- idx_devices_user_id
- idx_devices_device_uuid
- idx_devices_last_seen
- idx_devices_platform

**parent_child**:
- idx_parent_child_parent_id
- idx_parent_child_child_id
- idx_parent_child_approved

**child_schedules**:
- idx_child_schedules_child_id
- idx_child_schedules_parent_id
- idx_child_schedules_active
- idx_child_schedules_created_at

### RLS 정책 (3개)

1. **devices**: "Users can manage their own devices"
2. **parent_child**: "Users can see their own relations"
3. **child_schedules**: "Parents and children can manage schedules"

### 트리거 (1개)

- **update_child_schedules_updated_at**: child_schedules의 updated_at 자동 업데이트

---

## 🔍 검증 방법

### 테이블 확인
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('devices', 'parent_child', 'child_schedules');
```

### 컬럼 확인
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'devices' 
  AND column_name LIKE '%permission%';
```

### 인덱스 확인
```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('devices', 'parent_child', 'child_schedules');
```

### RLS 정책 확인
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('devices', 'parent_child', 'child_schedules');
```

---

## 🧪 테스트 데이터 삽입 (선택사항)

마이그레이션 스크립트에 샘플 데이터 섹션이 주석 처리되어 있습니다.
필요한 경우 주석을 해제하고 실행하세요.

```sql
-- 샘플 디바이스
INSERT INTO devices (id, device_uuid, platform, device_model, os_version, app_version, accessibility_permission, screen_time_permission)
VALUES 
    (gen_random_uuid(), 'dev-device-001', 'IOS', 'iPhone 14 Pro', '17.2', '1.0.0', NULL, true),
    (gen_random_uuid(), 'dev-device-002', 'ANDROID', 'Galaxy S24', '14.0', '1.0.0', true, NULL);
```

---

## 🐛 문제 해결

### 에러: relation "users" does not exist
**원인**: users 테이블이 없음
**해결**: users 테이블을 먼저 생성하거나, 외래 키 제약 조건을 임시로 제거

```sql
-- 외래 키 없이 테이블 생성 (임시)
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_user_id_fkey;
```

### 에러: type "relation_enum" already exists
**원인**: relation_enum 타입이 이미 존재
**해결**: 스크립트가 자동으로 처리하므로 무시 가능

### 에러: permission denied
**원인**: 권한 부족
**해결**: SUPERUSER 또는 테이블 소유자로 실행

```bash
# postgres 사용자로 실행
psql -h your-rds.amazonaws.com -U postgres -d lockmoment
```

---

## 📝 다음 단계

1. ✅ 마이그레이션 완료
2. ⬜ Lambda 함수 업데이트 (`backup/lambda/index_updated.mjs`)
3. ⬜ API Gateway 라우트 추가
4. ⬜ 프론트엔드 테스트

---

## 🔄 롤백 방법

개발 환경이므로 롤백이 필요한 경우:

### 방법 1: 테이블 삭제
```sql
DROP TABLE IF EXISTS child_schedules CASCADE;
DROP TABLE IF EXISTS parent_child CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
```

### 방법 2: 이전 스키마로 복원
기존 백업이 있다면 해당 스크립트 실행

---

## 📞 지원

문제가 발생하면:
1. 에러 메시지 전체 복사
2. 실행한 SQL 명령어 확인
3. PostgreSQL 로그 확인

---

**마지막 업데이트**: 2026-02-08
**스크립트 버전**: 1.0 (개발용)
