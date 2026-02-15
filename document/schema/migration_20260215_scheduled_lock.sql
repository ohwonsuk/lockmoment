-- QR 예약 잠금 기능을 위한 lock_policies 테이블 컬럼 추가 (2026-02-15)

DO $$ 
BEGIN 
    -- 1. time_window 컬럼 추가 (예: "09:00-10:00")
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'lock_policies' AND column_name = 'time_window') THEN
        ALTER TABLE lock_policies ADD COLUMN time_window VARCHAR(50);
    END IF;

    -- 2. days 컬럼 추가 (예: ["월", "화"])
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'lock_policies' AND column_name = 'days') THEN
        ALTER TABLE lock_policies ADD COLUMN days JSONB;
    END IF;

    -- 3. title 컬럼 추가 (이미 존재할 수 있으나 정합성 위해 체크)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'lock_policies' AND column_name = 'title') THEN
        ALTER TABLE lock_policies ADD COLUMN title VARCHAR(100);
    END IF;
END $$;

COMMENT ON COLUMN lock_policies.time_window IS '예약 잠금 시간대 (HH:mm-HH:mm)';
COMMENT ON COLUMN lock_policies.days IS '예약 잠금 요율 (JSON Array)';
