```sql
-- LockMoment Database Schema (PostgreSQL/Supabase compatible)

-- 1. Enums
CREATE TYPE user_type_enum AS ENUM ('STUDENT','PARENT','TEACHER','ORG_ADMIN','INDIVIDUAL');
CREATE TYPE auth_provider_enum AS ENUM ('KAKAO','ANONYMOUS');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE','PENDING','SUSPENDED');
CREATE TYPE org_type_enum AS ENUM ('SCHOOL','ACADEMY');
CREATE TYPE org_status_enum AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE platform_enum AS ENUM ('IOS','ANDROID');
CREATE TYPE relation_enum AS ENUM ('FATHER','MOTHER','GUARDIAN');
CREATE TYPE admin_role_enum AS ENUM ('PRIMARY','SECONDARY');
CREATE TYPE teacher_status_enum AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE student_status_enum AS ENUM ('ACTIVE','LEFT');
CREATE TYPE policy_scope_enum AS ENUM ('CLASS','HOME','PERSONAL');
CREATE TYPE qr_type_enum AS ENUM ('CLASS','HOME','PERSONAL');
CREATE TYPE lock_trigger_enum AS ENUM ('QR','SCHEDULE','ADMIN');
CREATE TYPE lock_status_enum AS ENUM ('LOCKED','UNLOCKED');
CREATE TYPE request_status_enum AS ENUM ('PENDING','APPROVED','REJECTED');

-- 2. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_type user_type_enum NOT NULL,
    auth_provider auth_provider_enum NOT NULL,
    auth_provider_id VARCHAR(255),
    name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    status user_status_enum DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_auth_provider_id ON users(auth_provider_id);

-- 3. Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    org_type org_type_enum NOT NULL,
    business_number VARCHAR(50),
    status org_status_enum DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_uuid TEXT UNIQUE NOT NULL,
  platform platform_enum,
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  permission_status JSONB,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Universal Apps (Cross-platform mapping)
CREATE TABLE universal_apps (
  id SERIAL PRIMARY KEY,
  universal_id TEXT UNIQUE NOT NULL, -- youtube, kakaotalk
  ios_bundle_ids TEXT[],
  android_package_names TEXT[]
);

-- 6. Device Apps Mapping
CREATE TABLE device_apps (
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  universal_app_id TEXT,
  PRIMARY KEY (device_id, universal_app_id)
);

-- 11. Lock Policies
CREATE TABLE lock_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_duration_minutes INT NOT NULL,
  time_window TEXT,               -- "09:00-09:10"
  schedule JSONB,                 -- {days:[MON], start:"18:00"}
  allowed_apps TEXT[],            -- universal_id 기준
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. QR Codes
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_type TEXT CHECK (
    qr_type IN ('CLASS_ATTEND','USER_INSTANT_LOCK','USER_SCHEDULE_LOCK')
  ),
  issuer_id UUID REFERENCES users(id),
  lock_policy_id UUID REFERENCES lock_policies(id),
  expires_at TIMESTAMPTZ,
  hmac_sig TEXT NOT NULL,
  one_device_once BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. QR Device Usage
CREATE TABLE qr_device_usage (
  qr_id UUID REFERENCES qr_codes(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id),
  used_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (qr_id, device_id)
);

-- 14. Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id UUID REFERENCES qr_codes(id),
  device_id UUID REFERENCES devices(id),
  attended_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Lock History
CREATE TABLE lock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id),
    lock_policy_id UUID NOT NULL REFERENCES lock_policies(id),
    trigger lock_trigger_enum NOT NULL,
    status lock_status_enum NOT NULL,
    triggered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Admin Unlock Requests
CREATE TABLE admin_unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    status request_status_enum DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

수정된 데이터베이스 스키마 및 RLS 설정
서비스 시나리오 변경에 따라 업데이트된 스키마입니다. 기존 테이블을 삭제하고 아래 스크립트를 실행하여 재생성할 수 있습니다.

1. 테이블 삭제 (초기화)
```sql
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS qr_device_usage CASCADE;
DROP TABLE IF EXISTS qr_codes CASCADE;
DROP TABLE IF EXISTS lock_history CASCADE; -- 추가 관리를 위해 유지
DROP TABLE IF EXISTS lock_policies CASCADE;
DROP TABLE IF EXISTS device_apps CASCADE;
DROP TABLE IF EXISTS universal_apps CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
```
2. ENUM 및 기초 테이블 유지
기존 users, organizations 등 아래 정의되지 않은 테이블은 유지됩니다. ENUM 타입은 아래 내용을 참조하여 필요 시 업데이트합니다.

```sql
-- 기존 ENUM 유지 및 수정
-- CREATE TYPE policy_scope_enum AS ENUM ('CLASS','HOME','PERSONAL');
-- CREATE TYPE qr_type_enum AS ENUM ('CLASS','HOME','PERSONAL'); -- 테이블에서 TEXT CHECK로 대체됨
-- CREATE TYPE lock_trigger_enum AS ENUM ('QR','SCHEDULE','ADMIN');
-- CREATE TYPE lock_status_enum AS ENUM ('LOCKED','UNLOCKED');
-- CREATE TYPE request_status_enum AS ENUM ('PENDING','APPROVED','REJECTED');
```
3. 신규 테이블 정의
```sql
-- 장치 정보
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- RLS 및 사용자 매핑을 위해 유지 권장
  device_uuid TEXT UNIQUE NOT NULL,
  platform TEXT CHECK (platform IN ('IOS','ANDROID')),
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  permission_status JSONB,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- 유니버설 앱 매핑 (시스템 관리용)
CREATE TABLE universal_apps (
  id SERIAL PRIMARY KEY,
  universal_id TEXT UNIQUE NOT NULL, -- youtube, kakaotalk
  ios_bundle_ids TEXT[],
  android_package_names TEXT[]
);
-- 장치별 설치 앱 / 차단 앱 매핑
CREATE TABLE device_apps (
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  universal_app_id TEXT, -- universal_apps.universal_id 참조
  PRIMARY KEY (device_id, universal_app_id)
);
-- 잠금 정책
CREATE TABLE lock_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_duration_minutes INT NOT NULL,
  time_window TEXT,               -- "09:00-09:10"
  schedule JSONB,                 -- {days:[MON], start:"18:00"}
  allowed_apps TEXT[],            -- universal_id 기준
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- QR 코드 (보안 서명 포함)
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_type TEXT CHECK (
    qr_type IN ('CLASS_ATTEND','USER_INSTANT_LOCK','USER_SCHEDULE_LOCK')
  ),
  issuer_id UUID REFERENCES users(id), -- 발행 일체 (교사/부모/본인)
  lock_policy_id UUID REFERENCES lock_policies(id),
  expires_at TIMESTAMPTZ,
  hmac_sig TEXT NOT NULL,
  one_device_once BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- QR 코드 장치 사용 기록 (1회성 사용 체크)
CREATE TABLE qr_device_usage (
  qr_id UUID REFERENCES qr_codes(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id),
  used_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (qr_id, device_id)
);
-- 출석 기록 (수업용)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id UUID REFERENCES qr_codes(id),
  device_id UUID REFERENCES devices(id),
  attended_at TIMESTAMPTZ DEFAULT now()
);
-- 부모-자녀 관계
CREATE TYPE relation_enum AS ENUM ('PARENT', 'TEACHER', 'OTHER');
CREATE TABLE parent_child (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES users(id),
  child_id UUID NOT NULL REFERENCES users(id),
  relation relation_enum DEFAULT 'PARENT',
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (parent_id, child_id)
);
```
4. RLS (Row Level Security) 설정
AWS RDS 등 일반 PostgreSQL 환경에서는 auth.uid() 대신 세션 변수를 사용하여 RLS를 구현합니다. Lambda나 백엔드에서 쿼리 실행 직전에 SET app.current_user_id = '유저_UUID';를 실행해야 합니다.

```sql
-- 테이블 RLS 활성화
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE universal_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE lock_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_device_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
-- 1. devices: 사용자는 자신의 장치 정보만 조회/수정 가능
CREATE POLICY "Users can only see their own devices" ON devices
  FOR ALL USING (current_setting('app.current_user_id', true)::uuid = user_id);
-- 2. universal_apps: 누구나 조회 가능 (관리자만 수정)
CREATE POLICY "Everyone can read universal_apps" ON universal_apps
  FOR SELECT USING (true);
-- 3. device_apps: 사용자는 자신의 장치에 매핑된 앱 정보만 관리
CREATE POLICY "Users can manage apps for their own devices" ON device_apps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM devices WHERE id = device_id AND user_id = current_setting('app.current_user_id', true)::uuid)
  );
-- 4. lock_policies: 생성자 또는 관련 장치 사용자가 조회 가능
CREATE POLICY "Users can see policies they created" ON lock_policies
  FOR ALL USING (current_setting('app.current_user_id', true)::uuid = created_by);
-- 5. qr_codes: 발급자 또는 모든 사용자가 조회 가능 (스캔 시 필요)
CREATE POLICY "Everyone can read qr_codes for scanning" ON qr_codes
  FOR SELECT USING (true);
-- 6. qr_device_usage: 장치 소유자가 자신의 사용 기록 조회/생성
CREATE POLICY "Users can manage their own qr usage" ON qr_device_usage
  FOR ALL USING (
    EXISTS (SELECT 1 FROM devices WHERE id = device_id AND user_id = current_setting('app.current_user_id', true)::uuid)
  );
-- 7. attendance: 장치 소유자가 자신의 출석 기록 조회/생성
CREATE POLICY "Users can manage their own attendance" ON attendance
  FOR ALL USING (
    EXISTS (SELECT 1 FROM devices WHERE id = device_id AND user_id = current_setting('app.current_user_id', true)::uuid)
  );
-- 8. parent_child: 부모 또는 자녀 본인이 조회 가능
CREATE POLICY "Users can see their own parent-child relations" ON parent_child
  FOR ALL USING (
    current_setting('app.current_user_id', true)::uuid = parent_id OR 
    current_setting('app.current_user_id', true)::uuid = child_id
  );
```


# Database Schema Updates for LockMoment

## Overview
This document outlines the necessary database schema updates to support the new features:
1. Permission status tracking for children
2. Scheduled lock storage from QR generation
3. Permission sync from devices

## Required Tables and Fields

### 1. `devices` Table
**Purpose**: Track device information and permission status

**New/Updated Fields**:
```sql
-- Add permission tracking fields if not already present
ALTER TABLE devices ADD COLUMN IF NOT EXISTS accessibility_permission BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS screen_time_permission BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS notification_permission BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_permission_sync TIMESTAMP;
```

**Notes**:
- `accessibility_permission`: For Android devices (Accessibility Service)
- `screen_time_permission`: For iOS devices (Screen Time/Family Controls)
- `notification_permission`: For both platforms
- `last_permission_sync`: Timestamp of last permission status update

### 2. `parent_child_relations` Table
**Purpose**: Link parents/teachers with children/students

**Existing Fields** (verify these exist):
```sql
CREATE TABLE IF NOT EXISTS parent_child_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relation_type VARCHAR(20) NOT NULL CHECK (relation_type IN ('PARENT', 'TEACHER')),
    approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, child_id)
);
```

### 3. `child_schedules` Table
**Purpose**: Store scheduled locks created by parents for their children

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS child_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days TEXT[] NOT NULL, -- Array of day names: ['월', '화', '수', ...]
    apps TEXT[] NOT NULL, -- Array of app package names/IDs
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure parent has permission to manage this child
    CONSTRAINT fk_parent_child 
        FOREIGN KEY (parent_id, child_id) 
        REFERENCES parent_child_relations(parent_id, child_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_child_schedules_child_id ON child_schedules(child_id);
CREATE INDEX IF NOT EXISTS idx_child_schedules_parent_id ON child_schedules(parent_id);
CREATE INDEX IF NOT EXISTS idx_child_schedules_active ON child_schedules(is_active);
```

### 4. `qr_codes` Table (if not exists)
**Purpose**: Track generated QR codes for audit and expiration

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_id VARCHAR(255) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qr_type VARCHAR(50) NOT NULL CHECK (qr_type IN ('USER_INSTANT_LOCK', 'USER_SCHEDULE_LOCK', 'CHILD_REGISTRATION', 'PARENT_LINK')),
    payload JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    used_by_device_id UUID REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_qr_id ON qr_codes(qr_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
```

## API Endpoints to Implement/Verify

### Permission Sync
```
PATCH /devices/:deviceId/permissions
Body: {
  accessibility?: boolean,
  screenTime?: boolean,
  notification?: boolean
}
```

### Child Schedules
```
GET    /parent-child/:childId/schedules
POST   /parent-child/:childId/schedules
PUT    /parent-child/:childId/schedules/:scheduleId
DELETE /parent-child/:childId/schedules/:scheduleId
```

### Children List with Permissions
```
GET /parent-child/children
Response: {
  success: true,
  data: [
    {
      id: string,
      childName: string,
      deviceName?: string,
      status: 'LOCKED' | 'UNLOCKED' | 'OFFLINE',
      lastSeenAt?: string,
      hasPermission?: boolean  // NEW: Derived from device permissions
    }
  ]
}
```

## Implementation Notes

1. **Permission Status Calculation**:
   - For iOS: `hasPermission = screen_time_permission === true`
   - For Android: `hasPermission = accessibility_permission === true`
   - Unknown/null: Show as grey "미확인" status

2. **Schedule Storage**:
   - When QR is generated with schedule, save to `child_schedules` table
   - Link to specific child or all children based on selection
   - Include all schedule details (time, days, apps)

3. **Permission Sync Flow**:
   - Dashboard checks permissions on load
   - Calls `AuthService.syncPermissions()` to update backend
   - Backend updates `devices` table with permission status
   - Parent queries include JOIN to get child's device permissions

4. **Data Migration**:
   - Run migrations to add new columns to existing tables
   - Set default values for existing records
   - Update API responses to include new fields

## Testing Checklist

- [ ] Verify `devices` table has permission columns
- [ ] Test permission sync from child device to backend
- [ ] Verify parent can see child's permission status
- [ ] Test schedule saving from QR generator
- [ ] Verify schedules appear in child's schedule list
- [ ] Test QR scan permission check and redirect
- [ ] Verify header icon colors change based on permission status
- [ ] Test time picker UI with new layout


