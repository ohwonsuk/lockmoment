-- ============================================
-- LockMoment Database Migration Script (개발용)
-- DROP 후 재생성 방식
-- ============================================

-- ⚠️ 경고: 이 스크립트는 개발 환경 전용입니다.
-- 프로덕션 환경에서는 사용하지 마세요!

BEGIN;

-- ============================================
-- 1. 기존 테이블 삭제 (CASCADE로 의존성 함께 삭제)
-- ============================================

DROP TABLE IF EXISTS child_schedules CASCADE;
DROP TABLE IF EXISTS parent_child CASCADE;
DROP TABLE IF EXISTS devices CASCADE;

-- ============================================
-- 2. devices 테이블 재생성 (권한 필드 포함)
-- ============================================

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_uuid TEXT UNIQUE NOT NULL,
    platform TEXT CHECK (platform IN ('IOS', 'ANDROID')),
    device_model TEXT,
    os_version TEXT,
    app_version TEXT,
    
    -- 권한 상태 필드 (신규)
    accessibility_permission BOOLEAN DEFAULT NULL,
    screen_time_permission BOOLEAN DEFAULT NULL,
    notification_permission BOOLEAN DEFAULT NULL,
    last_permission_sync TIMESTAMPTZ,
    
    -- 기존 필드 (하위 호환성)
    permission_status JSONB,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- devices 테이블 코멘트
COMMENT ON TABLE devices IS '사용자 디바이스 정보 및 권한 상태';
COMMENT ON COLUMN devices.accessibility_permission IS 'Android Accessibility Service 권한 상태';
COMMENT ON COLUMN devices.screen_time_permission IS 'iOS Screen Time/Family Controls 권한 상태';
COMMENT ON COLUMN devices.notification_permission IS '알림 권한 상태 (iOS/Android 공통)';
COMMENT ON COLUMN devices.last_permission_sync IS '마지막 권한 동기화 시간';
COMMENT ON COLUMN devices.permission_status IS '권한 상태 JSONB (하위 호환성)';

-- ============================================
-- 3. parent_child 테이블 재생성
-- ============================================

-- relation_enum 타입 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relation_enum') THEN
        CREATE TYPE relation_enum AS ENUM ('PARENT', 'TEACHER', 'OTHER');
    END IF;
END $$;

CREATE TABLE parent_child (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relation relation_enum DEFAULT 'PARENT',
    approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (parent_id, child_id)
);

COMMENT ON TABLE parent_child IS '부모-자녀 또는 교사-학생 관계';

-- ============================================
-- 4. child_schedules 테이블 생성
-- ============================================

CREATE TABLE child_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days TEXT[] NOT NULL,
    apps TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE child_schedules IS '부모가 자녀를 위해 생성한 예약 잠금 스케줄';
COMMENT ON COLUMN child_schedules.days IS '반복 요일 배열 (예: {월,화,수,목,금})';
COMMENT ON COLUMN child_schedules.apps IS '차단할 앱 ID 배열 (universal_id 기준)';

-- ============================================
-- 5. 인덱스 생성
-- ============================================

-- devices 테이블 인덱스
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_device_uuid ON devices(device_uuid);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at);
CREATE INDEX idx_devices_platform ON devices(platform);

-- parent_child 테이블 인덱스
CREATE INDEX idx_parent_child_parent_id ON parent_child(parent_id);
CREATE INDEX idx_parent_child_child_id ON parent_child(child_id);
CREATE INDEX idx_parent_child_approved ON parent_child(approved);

-- child_schedules 테이블 인덱스
CREATE INDEX idx_child_schedules_child_id ON child_schedules(child_id);
CREATE INDEX idx_child_schedules_parent_id ON child_schedules(parent_id);
CREATE INDEX idx_child_schedules_active ON child_schedules(is_active);
CREATE INDEX idx_child_schedules_created_at ON child_schedules(created_at DESC);

-- ============================================
-- 6. 트리거 함수 및 트리거 생성
-- ============================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- child_schedules 테이블에 트리거 적용
CREATE TRIGGER update_child_schedules_updated_at 
    BEFORE UPDATE ON child_schedules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. RLS (Row Level Security) 설정
-- ============================================

-- devices 테이블 RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own devices" ON devices
    FOR ALL 
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
    );

-- parent_child 테이블 RLS
ALTER TABLE parent_child ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own relations" ON parent_child
    FOR ALL 
    USING (
        parent_id = current_setting('app.current_user_id', true)::uuid
        OR child_id = current_setting('app.current_user_id', true)::uuid
    );

-- child_schedules 테이블 RLS
ALTER TABLE child_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents and children can manage schedules" ON child_schedules
    FOR ALL 
    USING (
        parent_id = current_setting('app.current_user_id', true)::uuid
        OR child_id = current_setting('app.current_user_id', true)::uuid
    );

-- ============================================
-- 8. qr_codes 테이블 타입 확장 (기존 테이블 수정)
-- ============================================

-- qr_type 체크 제약 조건 업데이트
ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_qr_type_check;

ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_qr_type_check 
CHECK (qr_type IN (
    'CLASS_ATTEND',
    'USER_INSTANT_LOCK',
    'USER_SCHEDULE_LOCK',
    'CHILD_REGISTRATION',
    'PARENT_LINK'
));

-- ============================================
-- 9. 샘플 데이터 (개발용 - 선택사항)
-- ============================================

-- 샘플 데이터가 필요한 경우 주석 해제
/*
-- 샘플 디바이스
INSERT INTO devices (id, device_uuid, platform, device_model, os_version, app_version, accessibility_permission, screen_time_permission)
VALUES 
    (gen_random_uuid(), 'dev-device-001', 'IOS', 'iPhone 14 Pro', '17.2', '1.0.0', NULL, true),
    (gen_random_uuid(), 'dev-device-002', 'ANDROID', 'Galaxy S24', '14.0', '1.0.0', true, NULL);

-- 샘플 부모-자녀 관계 (users 테이블에 데이터가 있다고 가정)
-- INSERT INTO parent_child (parent_id, child_id, relation, approved)
-- VALUES 
--     ('parent-uuid', 'child-uuid', 'PARENT', true);

-- 샘플 스케줄
-- INSERT INTO child_schedules (child_id, parent_id, name, start_time, end_time, days, apps, is_active)
-- VALUES 
--     ('child-uuid', 'parent-uuid', '저녁 공부 시간', '18:00', '20:00', ARRAY['월','화','수','목','금'], ARRAY['youtube','instagram'], true);
*/

-- ============================================
-- 10. 검증 쿼리
-- ============================================

-- 테이블 목록 확인
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN ('devices', 'parent_child', 'child_schedules')
ORDER BY table_name;

-- devices 테이블 컬럼 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'devices'
ORDER BY ordinal_position;

-- 인덱스 확인
SELECT 
    tablename, 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename IN ('devices', 'parent_child', 'child_schedules')
ORDER BY tablename, indexname;

-- RLS 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('devices', 'parent_child', 'child_schedules')
ORDER BY tablename, policyname;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '마이그레이션 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '생성된 테이블:';
    RAISE NOTICE '  - devices (권한 필드 포함)';
    RAISE NOTICE '  - parent_child';
    RAISE NOTICE '  - child_schedules';
    RAISE NOTICE '';
    RAISE NOTICE '생성된 인덱스: 12개';
    RAISE NOTICE '생성된 RLS 정책: 3개';
    RAISE NOTICE '생성된 트리거: 1개';
    RAISE NOTICE '========================================';
    RAISE NOTICE '완료 시간: %', NOW();
    RAISE NOTICE '========================================';
END $$;

COMMIT;
