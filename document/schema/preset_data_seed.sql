-- LockMoment 시스템 Preset 초기 데이터 시드 쿼리
-- 파일 위치: /Volumes/SSD/development/LockMoment/document/schema/preset_data_seed.sql

-- 1. 기존 데이터 정리 (필요시 주석을 해제하여 사용)
-- DELETE FROM app_category_map;
-- DELETE FROM app_categories;
-- DELETE FROM preset_policies WHERE scope = 'SYSTEM';

-- 2. 시스템 Preset 데이터 입력
INSERT INTO preset_policies (
    id, 
    scope, 
    owner_id, 
    name, 
    description, 
    purpose, 
    lock_type, 
    allowed_categories, 
    blocked_categories, 
    allowed_apps, 
    default_duration_minutes, 
    is_active
) VALUES 
-- 1. 수업 집중 모드 (학습 관련 앱/카테고리만 허용)
(
    gen_random_uuid(), 
    'SYSTEM', 
    NULL, 
    '수업 집중', 
    '학습 및 도구 관련 앱만 허용하여 수업 중 몰입도를 높입니다.', 
    'LOCK_AND_ATTENDANCE', 
    'APP_ONLY', 
    '["EDUCATION", "UTILITIES", "PRODUCTIVITY"]'::jsonb, 
    '["GAMES", "SOCIAL", "ENTERTAINMENT"]'::jsonb, 
    '[]'::jsonb, 
    60, 
    TRUE
),
-- 2. 시험 모드 (모든 앱 차단)
(
    gen_random_uuid(), 
    'SYSTEM', 
    NULL, 
    '시험 모드', 
    '시험 중 모든 외부 연락 및 앱 사용을 완벽하게 차단합니다.', 
    'LOCK_AND_ATTENDANCE', 
    'FULL', 
    '[]'::jsonb, 
    '[]'::jsonb, 
    '[]'::jsonb, 
    90, 
    TRUE
),
-- 3. 자율 학습 (교육 + 참고서 앱 허용)
(
    gen_random_uuid(), 
    'SYSTEM', 
    NULL, 
    '자율 학습', 
    '교육용 앱과 참고 도구 사용을 허용하면서 오락성 앱을 차단합니다.', 
    'LOCK_AND_ATTENDANCE', 
    'APP_ONLY', 
    '["EDUCATION", "REFERENCE"]'::jsonb, 
    '["GAMES", "SOCIAL", "ENTERTAINMENT", "SHOPPING"]'::jsonb, 
    '[]'::jsonb, 
    120, 
    TRUE
),
-- 4. 취침 시간 (필수 통신 앱만 허용)
(
    gen_random_uuid(), 
    'SYSTEM', 
    NULL, 
    '취침 시간', 
    '수면 중 스마트폰 사용을 제한하고 긴급 상황을 위해 전화만 허용합니다.', 
    'LOCK_ONLY', 
    'APP_ONLY', 
    '["COMMUNICATION"]'::jsonb, 
    '["GAMES", "SOCIAL", "ENTERTAINMENT", "EDUCATION"]'::jsonb, 
    '[]'::jsonb, 
    480, 
    TRUE
),
-- 5. 출석 전용 (잠금 없이 출석만 체크)
(
    gen_random_uuid(), 
    'SYSTEM', 
    NULL, 
    '출석 체크 전용', 
    '별도의 앱 잠금 없이 등원/등교 출석 정보만 기록합니다.', 
    'ATTENDANCE_ONLY', 
    NULL, 
    NULL, 
    NULL, 
    NULL, 
    NULL, 
    TRUE
);

-- 인덱스 및 제약 조건 확인용 쿼리 (디버깅)
-- SELECT * FROM preset_policies WHERE scope = 'SYSTEM';

-- 3. 서버 공통 카테고리 정의 초기 데이터
INSERT INTO app_categories (id, display_name, ios_category, android_label) VALUES
('EDUCATION', '교육', '.education', 'Play Store: Education'),
('PRODUCTIVITY', '생산성', '.productivity', 'Productivity'),
('UTILITIES', '유틸리티', '.utilities', 'Tools / Utilities'),
('REFERENCE', '도서/참고', '.reference', 'Books / Reference'),
('ENTERTAINMENT', '엔터테인먼트', '.entertainment', 'Entertainment'),
('GAMES', '게임', '.games', 'Games'),
('SOCIAL', '소셜', '.socialNetworking', 'Social'),
('HEALTHVITALITY', '건강', '.healthAndFitness', 'Health & Fitness'),
('FINANCE', '금융', '.finance', 'Finance'),
('COMMUNICATION', '연락/통신', '.socialNetworking', 'Communication'),
('OTHERS', '기타', NULL, 'Others')
ON CONFLICT (id) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  ios_category = EXCLUDED.ios_category,
  android_label = EXCLUDED.android_label;

-- 4. 앱 카테고리 매핑 초기 데이터 (샘플)
INSERT INTO app_category_map (platform, package_name, app_name, category) VALUES
-- EDUCATION (교육)
('ANDROID', 'com.google.android.classroom', 'Google Classroom', 'EDUCATION'),
('ANDROID', 'com.duolingo', 'Duolingo', 'EDUCATION'),
('ANDROID', 'com.kahoot.app', 'Kahoot!', 'EDUCATION'),
('IOS', 'com.google.classroom', 'Google Classroom', 'EDUCATION'),
('IOS', 'com.duolingo.Duolingo', 'Duolingo', 'EDUCATION'),

-- SOCIAL (SNS/네트워킹)
('ANDROID', 'com.kakao.talk', '카카오톡', 'SOCIAL'),
('ANDROID', 'com.instagram.android', 'Instagram', 'SOCIAL'),
('ANDROID', 'com.facebook.katana', 'Facebook', 'SOCIAL'),
('IOS', 'com.iwilab.KakaoTalk', '카카오톡', 'SOCIAL'),
('IOS', 'com.burbn.instagram', 'Instagram', 'SOCIAL'),

-- GAMES (게임)
('ANDROID', 'com.supercell.brawlstars', '브롤스타즈', 'GAMES'),
('ANDROID', 'com.roblox.client', 'Roblox', 'GAMES'),
('IOS', 'com.supercell.brawlstars', '브롤스타즈', 'GAMES'),
('IOS', 'com.roblox.robloxmobile', 'Roblox', 'GAMES'),

-- UTILITIES (유틸리티)
('ANDROID', 'com.google.android.calculator', '계산기', 'UTILITIES'),
('ANDROID', 'com.android.chrome', 'Chrome', 'UTILITIES'),
('IOS', 'com.apple.calculator', '계산기', 'UTILITIES'),
('IOS', 'com.apple.mobilesafari', 'Safari', 'UTILITIES')
ON CONFLICT (platform, package_name) DO UPDATE SET 
  app_name = EXCLUDED.app_name,
  category = EXCLUDED.category;

