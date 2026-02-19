-- 1. 기존 단순 로그용 테이블 삭제 (영향도 고려하여 CASCADE)
DROP TABLE IF EXISTS lock_history CASCADE;

-- 2. 통계 및 사용 시간 합산용 Lock History 테이블 생성
CREATE TABLE lock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  
  lock_name VARCHAR(100) NOT NULL,
  lock_type lock_type_enum NOT NULL,
  
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INT NOT NULL, -- (ended_at - started_at) 계산값 저장
  
  lock_policy_id UUID REFERENCES lock_policies(id) ON DELETE SET NULL,
  preset_id UUID REFERENCES preset_policies(id) ON DELETE SET NULL,
  source VARCHAR(50), -- 'MANUAL', 'SCHEDULED', 'QR'
  initiated_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스 (사용자별/날짜별 조회 최적화)
CREATE INDEX idx_lock_history_user_date ON lock_history(user_id, started_at);
CREATE INDEX idx_lock_history_device ON lock_history(device_id) WHERE device_id IS NOT NULL;
