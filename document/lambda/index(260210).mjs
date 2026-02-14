import pg from 'pg';
import crypto from 'crypto';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    extractUserFromEvent
} from './jwt-utils.mjs';

const { Pool } = pg;
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

const QR_SECRET_KEY = process.env.QR_SECRET_KEY || 'default-secret-key';

// 응답 헬퍼
const response = (statusCode, body) => ({
    statusCode,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    },
    body: JSON.stringify(body)
});

/**
 * HMAC 서명 생성 (QR 코드 보안)
 */
function generateHMAC(qrId, exp) {
    const message = `${qrId}:${exp}`;
    return crypto.createHmac('sha256', QR_SECRET_KEY)
        .update(message)
        .digest('hex');
}

/**
 * JWT 인증 필수 체크
 */
async function requireAuth(event) {
    const user = await extractUserFromEvent(event);
    if (!user) {
        throw new Error('UNAUTHORIZED');
    }
    return user;
}

/**
 * 시간 윈도우 체크 (예약 시간 검증)
 */
function checkTimeWindow(validFrom, validTo) {
    if (!validFrom && !validTo) return { valid: true };

    const now = new Date();

    if (validFrom) {
        const from = new Date(validFrom);
        if (now < from) {
            return { valid: false, message: '아직 사용 가능 시간이 아닙니다.' };
        }
    }

    if (validTo) {
        const to = new Date(validTo);
        if (now > to) {
            return { valid: false, message: '사용 가능 시간이 지났습니다.' };
        }
    }

    return { valid: true };
}

export const handler = async (event) => {
    const httpMethod = (event.requestContext?.http?.method || event.httpMethod || "").toUpperCase();
    const path = event.rawPath || event.path || event.resource || "";
    const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : "{}";

    let data = {};
    try {
        data = JSON.parse(body);
    } catch (e) {
        // body가 비어있거나 JSON이 아닌 경우
    }

    // CORS preflight
    let client = null;
    try {
        // CORS preflight
        if (httpMethod === 'OPTIONS') {
            return response(200, { message: 'OK' });
        }

        // getUUID() 폴백 (Node.js 버전에 따라 다를 수 있음)
        const getUUID = () => {
            if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
            return crypto.randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
        };

        client = await pool.connect();

        console.log(`[Request] ${httpMethod} ${path}`, JSON.stringify({
            data,
            headers: {
                authorization: !!(event.headers?.Authorization || event.headers?.authorization),
                host: event.headers?.Host || event.headers?.host
            }
        }));

        // 환경 변수 체크 (디버깅용)
        if (!process.env.DB_HOST || !process.env.JWT_SECRET) {
            console.warn('[Warning] Missing environment variables: DB_HOST or JWT_SECRET');
        }

        // POST /auth/apple - Apple Sign-In
        if (httpMethod === 'POST' && path === '/auth/apple') {
            const { identityToken, user: appleUser, appleSub: appleSubFromData } = data;

            // Apple sub 추출 (프론트엔드 전달 구조: data.user.user 또는 data.appleSub)
            const appleId = appleSubFromData || appleUser?.user;

            if (!appleId) {
                return response(400, { success: false, message: 'Apple identity (sub) is missing' });
            }

            // 사용자 및 역할 조회 (가장 최근 등록된 역할 우선)
            let userResult = await client.query(
                `SELECT u.*, ur.role 
                 FROM users u 
                 LEFT JOIN user_roles ur ON u.id = ur.user_id 
                 WHERE u.apple_sub = $1
                 ORDER BY ur.assigned_at DESC`,
                [appleId]
            );

            let dbUser = userResult.rows[0];

            // 신규 사용자이거나 필수 정보(이름, 전화번호)가 없는 경우
            if (!dbUser || !dbUser.phone_number || !dbUser.display_name) {
                return response(200, {
                    success: true,
                    status: 'NEW_USER',
                    appleSub: appleId,
                    email: appleUser?.email || dbUser?.email,
                    name: appleUser?.fullName?.givenName || appleUser?.fullName?.familyName
                        ? `${appleUser?.fullName?.familyName || ''}${appleUser?.fullName?.givenName || ''}`.trim()
                        : dbUser?.display_name
                });
            }

            // 기존 사용자: JWT 토큰 생성
            // 역할이 없는 경우를 대비해 기본값 설정
            const userRole = dbUser.role || 'PARENT';
            const accessToken = await generateAccessToken(dbUser.id, userRole);
            const refreshToken = await generateRefreshToken(dbUser.id);

            return response(200, {
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: dbUser.id,
                    email: dbUser.email,
                    name: dbUser.display_name,
                    role: userRole,
                    phone: dbUser.phone_number,
                    auth_provider: dbUser.auth_provider
                }
            });
        }

        // POST /auth/register - 회원가입 (Apple 등 필수 정보 입력 후)
        if (httpMethod === 'POST' && path === '/auth/register') {
            const { appleSub, kakaoUserId, name, phone, email, role, provider } = data;
            const userRole = role;

            if (!name || !phone || !userRole || !provider) {
                return response(400, { success: false, message: '필수 정보가 누락되었습니다.' });
            }

            // 중복 가입 체크
            let checkQuery = '';
            let checkParam = '';
            if (provider === 'APPLE') {
                checkQuery = 'SELECT id FROM users WHERE apple_sub = $1';
                checkParam = appleSub;
            } else if (provider === 'KAKAO') {
                checkQuery = 'SELECT id FROM users WHERE kakao_user_id = $1';
                checkParam = kakaoUserId;
            }

            if (checkQuery) {
                const checkResult = await client.query(checkQuery, [checkParam]);
                if (checkResult.rows.length > 0) {
                    const existingUserId = checkResult.rows[0].id;
                    // 이미 가입된 경우 정보 업데이트
                    await client.query(
                        `UPDATE users SET display_name = $1, phone_number = $2, email = $3, updated_at = NOW() WHERE id = $4`,
                        [name, phone, email, existingUserId]
                    );

                    // 역할 업데이트 또는 추가 (본인 사용용 GLOBAL 권한)
                    await client.query(
                        `INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, $2, NULL, 'GLOBAL')
                         ON CONFLICT (user_id, role, scope_id) DO NOTHING`,
                        [existingUserId, userRole]
                    );

                    const dbUser = (await client.query(
                        `SELECT u.*, ur.role FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE u.id = $1`,
                        [existingUserId]
                    )).rows[0];

                    const accessToken = await generateAccessToken(dbUser.id, dbUser.role);
                    const refreshToken = await generateRefreshToken(dbUser.id);

                    return response(200, {
                        success: true,
                        accessToken,
                        refreshToken,
                        user: {
                            ...dbUser,
                            name: dbUser.display_name,
                            phone: dbUser.phone_number,
                            role: dbUser.role
                        }
                    });
                }
            }

            // 신규 가입
            const userId = getUUID();
            let insertQuery = '';
            let insertParams = [];

            if (provider === 'APPLE') {
                insertQuery = `INSERT INTO users (id, auth_provider, apple_sub, email, display_name, phone_number, created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`;
                insertParams = [userId, provider, appleSub, email, name, phone];
            } else if (provider === 'KAKAO') {
                insertQuery = `INSERT INTO users (id, auth_provider, kakao_user_id, email, display_name, phone_number, created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`;
                insertParams = [userId, provider, kakaoUserId, email, name, phone];
            }

            const result = await client.query(insertQuery, insertParams);
            const dbUser = result.rows[0];

            // 역할 등록 (본인 사용용 GLOBAL 권한)
            await client.query(
                `INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, $2, NULL, 'GLOBAL')`,
                [userId, userRole]
            );

            const accessToken = await generateAccessToken(dbUser.id, userRole);
            const refreshToken = await generateRefreshToken(dbUser.id);

            return response(200, {
                success: true,
                accessToken,
                refreshToken,
                user: {
                    ...dbUser,
                    name: dbUser.display_name,
                    phone: dbUser.phone_number,
                    role: userRole
                }
            });
        }

        // POST /auth/kakao - 카카오 로그인
        if (httpMethod === 'POST' && path === '/auth/kakao') {
            const { kakaoAccessToken, role, name } = data;

            console.log(`[Auth/Kakao] Fetching profile from Kakao... Token: ${kakaoAccessToken?.substring(0, 10)}...`);

            // 카카오 API로 사용자 정보 조회
            let kakaoUser;
            try {
                const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
                    headers: { 'Authorization': `Bearer ${kakaoAccessToken}` }
                });

                if (!kakaoResponse.ok) {
                    const errTxt = await kakaoResponse.text();
                    console.error('[Auth/Kakao] Kakao API Error:', errTxt);
                    return response(401, { success: false, message: '카카오 인증 실패', detail: errTxt });
                }

                kakaoUser = await kakaoResponse.json();
                console.log(`[Auth/Kakao] Kakao ID: ${kakaoUser.id}`);
            } catch (fetchError) {
                console.error('[Auth/Kakao] Fetch Error:', fetchError);
                return response(500, { success: false, message: '카카오 서버 통신 오류', detail: fetchError.message });
            }

            const kakaoUserId = kakaoUser.id.toString();

            // 사용자 및 역할 조회 (가장 최근 등록된 역할 우선)
            let userResult = await client.query(
                `SELECT u.*, ur.role 
                 FROM users u 
                 LEFT JOIN user_roles ur ON u.id = ur.user_id 
                 WHERE u.kakao_user_id = $1
                 ORDER BY ur.assigned_at DESC`,
                [kakaoUserId]
            );

            console.log(`[Auth/Kakao] DB Lookup result: ${userResult.rows.length} rows found`);

            if (userResult.rows.length === 0) {
                console.log(`[Auth/Kakao] Registering new user... Role: ${role}`);
                const userId = getUUID();
                const newUserRole = role || 'PARENT';
                // 신규 사용자 생성
                await client.query(
                    `INSERT INTO users (id, auth_provider, kakao_user_id, email, display_name, phone_number, created_at, updated_at)
                     VALUES ($1, 'KAKAO', $2, $3, $4, $5, NOW(), NOW())`,
                    [
                        userId,
                        kakaoUserId,
                        kakaoUser.kakao_account?.email,
                        kakaoUser.kakao_account?.profile?.nickname || kakaoUser.properties?.nickname || name || 'Kakao User',
                        kakaoUser.kakao_account?.phone_number
                    ]
                );

                // 역할 등록 (본인 사용용 GLOBAL 권한)
                await client.query(
                    `INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, $2, NULL, 'GLOBAL')`,
                    [userId, newUserRole]
                );

                userResult = await client.query(
                    `SELECT u.*, ur.role 
                     FROM users u 
                     JOIN user_roles ur ON u.id = ur.user_id 
                     WHERE u.id = $1`,
                    [userId]
                );
                console.log('[Auth/Kakao] New user registered successfully');
            }

            const dbUser = userResult.rows[0];

            // JWT 토큰 생성
            const accessToken = await generateAccessToken(dbUser.id, dbUser.role);
            const refreshToken = await generateRefreshToken(dbUser.id);

            return response(200, {
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: dbUser.id,
                    email: dbUser.email,
                    name: dbUser.display_name,
                    role: dbUser.role,
                    phone: dbUser.phone_number,
                    auth_provider: dbUser.auth_provider
                }
            });
        }

        // POST /auth/anonymous - 익명 사용자 생성
        if (httpMethod === 'POST' && path === '/auth/anonymous') {
            const { deviceData } = data;

            // 익명 사용자 생성
            const userId = getUUID();
            await client.query(
                `INSERT INTO users (id, auth_provider, created_at, updated_at)
                 VALUES ($1, 'ANONYMOUS', NOW(), NOW())`,
                [userId]
            );

            // 역할 등록 (STUDENT -> CHILD 매핑 등 성격에 맞춰 ROLE_TYPE_ENUM 사용)
            await client.query(
                `INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, 'CHILD', NULL, 'GLOBAL')`,
                [userId]
            );

            // 디바이스도 함께 등록
            if (deviceData) {
                await client.query(
                    `INSERT INTO devices (id, user_id, device_uuid, platform, device_model, os_version, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
           ON CONFLICT (device_uuid) DO UPDATE SET user_id = $2, updated_at = NOW()`,
                    [
                        getUUID(),
                        userId,
                        deviceData.deviceId,
                        deviceData.platform?.toUpperCase(),
                        deviceData.model,
                        deviceData.osVersion
                    ]
                );
            }

            // JWT 토큰 생성
            const accessToken = await generateAccessToken(userId, 'CHILD');
            const refreshToken = await generateRefreshToken(userId);

            return response(200, {
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: userId,
                    role: 'CHILD',
                    auth_provider: 'ANONYMOUS'
                }
            });
        }

        // POST /auth/refresh - 토큰 갱신
        if (httpMethod === 'POST' && path === '/auth/refresh') {
            const { refreshToken: token } = data;

            const decoded = await verifyToken(token);
            if (!decoded || decoded.type !== 'refresh') {
                return response(401, { success: false, message: '유효하지 않은 리프레시 토큰' });
            }

            // 사용자 조회 (역할 포함)
            const userResult = await client.query(
                `SELECT u.id, ur.role 
                 FROM users u 
                 JOIN user_roles ur ON u.id = ur.user_id 
                 WHERE u.id = $1`,
                [decoded.userId]
            );

            if (userResult.rows.length === 0) {
                return response(404, { success: false, message: '사용자를 찾을 수 없습니다' });
            }

            const dbUser = userResult.rows[0];

            // 새 액세스 토큰 생성
            const accessToken = await generateAccessToken(dbUser.id, dbUser.role);

            return response(200, {
                success: true,
                accessToken
            });
        }

        // ========================================
        // 디바이스 엔드포인트
        // ========================================

        // POST /devices/register - 디바이스 등록 (JWT 필요)
        if (httpMethod === 'POST' && path === '/devices/register') {
            const user = await requireAuth(event);
            const { device_uuid, platform, device_model, os_version, app_version } = data;
            const finalUserId = user.userId || data.userId;

            if (!finalUserId) {
                return response(400, { success: false, message: 'UserId is required' });
            }

            const deviceId = getUUID();
            const result = await client.query(
                `INSERT INTO devices (id, user_id, device_uuid, platform, device_model, os_version, app_version, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW())
         ON CONFLICT (device_uuid) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           os_version = EXCLUDED.os_version,
           app_version = EXCLUDED.app_version,
           updated_at = NOW()
         RETURNING *`,
                [deviceId, finalUserId, device_uuid, platform?.toUpperCase() === 'IOS' ? 'IOS' : 'ANDROID', device_model, os_version, app_version]
            );

            return response(200, {
                success: true,
                message: 'Device registered',
                device: result.rows[0]
            });
        }

        // PATCH /devices/{deviceId}/permissions - 권한 업데이트 (JWT 필요)
        if (httpMethod === 'PATCH' && path.includes('/devices/') && path.includes('/permissions')) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const deviceId = pathParts[pathParts.indexOf('devices') + 1];

            const accPerm = data.accessibility_permission !== undefined ? data.accessibility_permission : data.accessibility;
            const screenPerm = data.screen_time_permission !== undefined ? data.screen_time_permission : data.screenTime;
            const knotPerm = data.notification_permission !== undefined ? data.notification_permission : data.notification;

            const mapPerm = (v) => {
                if (v === true) return 'GRANTED';
                if (v === false) return 'DENIED';
                return 'NOT_DETERMINED';
            };

            // 플랫폼 중복 체크 제약 조건(chk_ios_permissions)을 피하기 위해 CASE 문 사용
            const result = await client.query(
                `UPDATE devices
                 SET accessibility_permission = CASE WHEN platform = 'ANDROID' THEN $1::permission_state_enum ELSE NULL END,
                     screen_time_permission = CASE WHEN platform = 'IOS' THEN $2::permission_state_enum ELSE NULL END,
                     notification_permission = $3::permission_state_enum,
                     last_permission_sync = NOW(),
                     updated_at = NOW()
                 WHERE LOWER(device_uuid) = LOWER($4) AND user_id = $5
                 RETURNING *`,
                [mapPerm(accPerm), mapPerm(screenPerm), mapPerm(knotPerm), deviceId, user.userId]
            );

            if (result.rows.length === 0) {
                return response(404, { success: false, message: '디바이스를 찾을 수 없습니다' });
            }

            return response(200, {
                success: true,
                device: result.rows[0]
            });
        }

        // ========================================
        // Preset 엔드포인트 (모두 JWT 필요)
        // ========================================

        // GET /presets - Preset 목록 조회
        if (httpMethod === 'GET' && path === '/presets') {
            const user = await requireAuth(event);
            const queryParams = event.queryStringParameters || {};
            const scope = queryParams.scope;

            let query = 'SELECT * FROM preset_policies WHERE 1=1';
            const params = [];

            if (scope) {
                params.push(scope);
                query += ` AND scope = $${params.length}`;
            } else {
                // scope 지정 안 하면 SYSTEM과 자신의 USER preset만
                params.push(user.userId);
                query += ` AND (scope = 'SYSTEM' OR (scope = 'USER' AND created_by = $${params.length}))`;
            }

            query += ' ORDER BY scope, name';

            const result = await client.query(query, params);

            return response(200, {
                success: true,
                presets: result.rows
            });
        }

        // POST /presets - 사용자 Preset 생성
        if (httpMethod === 'POST' && path === '/presets') {
            const user = await requireAuth(event);

            const {
                name,
                description,
                purpose,
                lock_type,
                allowed_categories,
                blocked_categories,
                allowed_apps,
                default_duration_minutes
            } = data;

            const presetId = getUUID();
            const result = await client.query(
                `INSERT INTO preset_policies (
          id, scope, name, description, purpose, lock_type,
          allowed_categories, blocked_categories, allowed_apps,
          default_duration_minutes, created_by, created_at, updated_at
        ) VALUES ($1, 'USER', $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
                [
                    presetId, name, description, purpose, lock_type,
                    allowed_categories, blocked_categories, allowed_apps,
                    default_duration_minutes, user.userId
                ]
            );

            return response(201, {
                success: true,
                preset: result.rows[0]
            });
        }

        // POST /presets/{presetId}/apply - Preset 적용
        if (httpMethod === 'POST' && path.includes('/presets/') && path.includes('/apply')) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const presetId = pathParts[pathParts.indexOf('presets') + 1];

            const { target_type, target_id, duration_minutes, overrides } = data;

            // Preset 조회
            const presetResult = await client.query(
                'SELECT * FROM preset_policies WHERE id = $1',
                [presetId]
            );

            if (presetResult.rows.length === 0) {
                return response(404, { success: false, message: 'Preset을 찾을 수 없습니다' });
            }

            const preset = presetResult.rows[0];

            // Lock policy 생성
            const policyId = getUUID();
            const finalDuration = duration_minutes || preset.default_duration_minutes;
            const finalAllowedApps = overrides?.allowed_apps || preset.allowed_apps;
            const finalBlockedCategories = overrides?.blocked_categories || preset.blocked_categories;

            await client.query(
                `INSERT INTO lock_policies (
          id, preset_id, lock_type, duration_minutes,
          allowed_categories, blocked_categories, allowed_apps,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                [
                    policyId, presetId, preset.lock_type, finalDuration,
                    preset.allowed_categories, finalBlockedCategories, finalAllowedApps,
                    user.userId
                ]
            );

            // Preset 사용 기록
            await client.query(
                `INSERT INTO preset_usage (id, preset_id, used_by, target_type, target_id, purpose, applied_policy_id, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [getUUID(), presetId, user.userId, target_type || 'STUDENT', target_id, preset.purpose, policyId]
            );

            return response(200, {
                success: true,
                policy_id: policyId,
                message: 'Preset이 적용되었습니다'
            });
        }

        // ========================================
        // QR 엔드포인트
        // ========================================

        // POST /qr/generate - QR 생성 (JWT 필요)
        if (httpMethod === 'POST' && path === '/qr/generate') {
            const user = await requireAuth(event);

            const {
                purpose,
                preset_id,
                target_type,
                target_id,
                duration_minutes,
                schedule_mode,
                valid_from,
                valid_to,
                class_id,
                max_uses
            } = data;

            let policyId = null;

            // Preset 사용하는 경우
            if (preset_id) {
                const presetResult = await client.query(
                    'SELECT * FROM preset_policies WHERE id = $1',
                    [preset_id]
                );

                if (presetResult.rows.length === 0) {
                    return response(404, { success: false, message: 'Preset을 찾을 수 없습니다' });
                }

                const preset = presetResult.rows[0];

                // Lock policy 생성
                policyId = getUUID();
                await client.query(
                    `INSERT INTO lock_policies (
            id, preset_id, lock_type, duration_minutes,
            allowed_categories, blocked_categories, allowed_apps,
            created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                    [
                        policyId, preset_id, preset.lock_type, duration_minutes || preset.default_duration_minutes,
                        preset.allowed_categories, preset.blocked_categories, preset.allowed_apps,
                        user.userId
                    ]
                );
            }

            // QR 코드 생성
            const qrId = getUUID();
            const exp = Math.floor(Date.now() / 1000) + (24 * 3600); // 24시간 유효
            const sig = generateHMAC(qrId, exp);

            await client.query(
                `INSERT INTO qr_codes (
          id, qr_type, purpose, preset_id, lock_policy_id, target_type, target_id,
          schedule_mode, valid_from, valid_to, max_scan_count,
          hmac_sig, status, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', $13, NOW())`,
                [
                    qrId, 'DYNAMIC', purpose, preset_id || null, policyId, target_type || (class_id ? 'CLASS' : 'DEVICE'), target_id || class_id,
                    schedule_mode || 'IMMEDIATE', valid_from, valid_to, max_uses,
                    sig, user.userId
                ]
            );

            return response(200, {
                success: true,
                qr_id: qrId,
                payload: JSON.stringify({ qr_id: qrId, exp, sig })
            });
        }

        // POST /qr/scan - QR 스캔 (JWT 불필요)
        if (httpMethod === 'POST' && path === '/qr/scan') {
            const { qrPayload, deviceId } = data;
            const parsedPayload = JSON.parse(qrPayload);
            const { type, sig, exp, qrId } = parsedPayload;

            // 1. 등록/연결용 QR (Stateless) 처리
            if (type === 'CHILD_REGISTRATION' || type === 'PARENT_LINK') {
                // 서명 검증 (전체 페이로드 HMAC)
                const { sig: _, ...payloadWithoutSig } = parsedPayload;
                const expectedSig = crypto.createHmac('sha256', QR_SECRET_KEY)
                    .update(JSON.stringify(payloadWithoutSig))
                    .digest('hex');

                if (expectedSig !== sig) {
                    return response(401, { success: false, message: '위변조된 QR 코드입니다 (R)' });
                }

                if (exp < Math.floor(Date.now() / 1000)) {
                    return response(400, { success: false, message: '만료된 QR 코드입니다' });
                }

                // 등록 정보 반환
                return response(200, {
                    success: true,
                    registrationInfo: {
                        parentId: parsedPayload.issuerId,
                        parentName: parsedPayload.issuerName,
                        childName: 'Target Child' // 클라이언트에서 입력받거나 설정?
                    }
                });
            }

            // 2. 일반 잠금/출석 QR (Stateful) 처리
            const { qr_id } = parsedPayload;
            const qrIdToUse = qr_id || qrId;

            // HMAC 검증
            if (generateHMAC(qrIdToUse, exp) !== sig) {
                return response(401, { success: false, message: '위변조된 QR 코드입니다' });
            }

            // 만료 확인
            if (exp < Math.floor(Date.now() / 1000)) {
                return response(400, { success: false, message: '만료된 QR 코드입니다' });
            }

            // QR 정보 조회
            const qrResult = await client.query(
                `SELECT q.*, p.lock_type, p.duration_minutes, p.allowed_apps, p.allowed_categories, p.blocked_categories,
                 (SELECT COUNT(*) FROM qr_device_usage WHERE qr_id = q.id) as current_uses
          FROM qr_codes q
          LEFT JOIN lock_policies p ON q.lock_policy_id = p.id
          WHERE q.id = $1 AND q.status = 'ACTIVE'`,
                [qr_id]
            );

            if (qrResult.rows.length === 0) {
                return response(404, { success: false, message: '존재하지 않거나 비활성화된 QR입니다' });
            }

            const qrInfo = qrResult.rows[0];

            // 시간 윈도우 체크
            const timeCheck = checkTimeWindow(qrInfo.valid_from, qrInfo.valid_to);
            if (!timeCheck.valid) {
                return response(403, { success: false, message: timeCheck.message });
            }

            // 최대 사용 횟수 체크
            if (qrInfo.max_scan_count && qrInfo.current_uses >= qrInfo.max_scan_count) {
                return response(403, { success: false, message: '사용 가능 횟수를 초과했습니다' });
            }

            // 디바이스 조회
            const deviceResult = await client.query(
                'SELECT * FROM devices WHERE id = $1 OR device_uuid = $1',
                [deviceId]
            );

            const device = deviceResult.rows[0];

            // 출석 처리 (ATTENDANCE_ONLY 또는 LOCK_AND_ATTENDANCE)
            if (qrInfo.purpose === 'ATTENDANCE_ONLY' || qrInfo.purpose === 'LOCK_AND_ATTENDANCE') {
                const targetClassId = qrInfo.target_type === 'CLASS' ? qrInfo.target_id : null;
                if (device && targetClassId) {
                    await client.query(
                        `INSERT INTO attendance (id, qr_id, class_id, student_id, device_id, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'PRESENT', NOW())
             ON CONFLICT (qr_id, student_id) DO UPDATE SET status = 'PRESENT', created_at = NOW()`,
                        [getUUID(), qr_id, targetClassId, device?.user_id, device?.id]
                    );
                }
            }

            // 사용 기록 추가 (qr_device_usage)
            await client.query(
                `INSERT INTO qr_device_usage (id, qr_id, user_id, device_id, used_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [getUUID(), qr_id, device?.user_id || '00000000-0000-0000-0000-000000000000', device?.id]
            );

            // 응답 구성
            const responseData = {
                success: true,
                purpose: qrInfo.purpose
            };

            // 잠금 정보 포함 (LOCK_ONLY 또는 LOCK_AND_ATTENDANCE)
            if (qrInfo.purpose === 'LOCK_ONLY' || qrInfo.purpose === 'LOCK_AND_ATTENDANCE') {
                responseData.lockPolicy = {
                    lock_type: qrInfo.lock_type,
                    durationMinutes: qrInfo.duration_minutes,
                    allowedApps: qrInfo.allowed_apps || [],
                    allowedCategories: qrInfo.allowed_categories || [],
                    blockedCategories: qrInfo.blocked_categories || []
                };
            }

            return response(200, responseData);
        }

        // GET /qr/{qrId} - QR 상세 조회 (JWT 필요)
        if (httpMethod === 'GET' && path.includes('/qr/') && !path.includes('/scan')) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const qrId = pathParts[pathParts.indexOf('qr') + 1];

            const result = await client.query(
                `SELECT q.*, p.lock_type, p.duration_minutes, p.allowed_apps
          FROM qr_codes q
          LEFT JOIN lock_policies p ON q.lock_policy_id = p.id
          WHERE q.id = $1 AND q.created_by = $2`,
                [qrId, user.userId]
            );

            if (result.rows.length === 0) {
                return response(404, { success: false, message: 'QR 코드를 찾을 수 없습니다' });
            }

            return response(200, {
                success: true,
                qr: result.rows[0]
            });
        }

        // ========================================
        // 부모-자녀 엔드포인트 (모두 JWT 필요)
        // ========================================

        // GET /parent-child/children - 자녀 목록 조회
        if (httpMethod === 'GET' && path === '/parent-child/children') {
            const user = await requireAuth(event);

            const result = await client.query(
                `SELECT pc.*, u.display_name as child_name, u.email as child_email,
                d.id as device_id, d.platform, d.accessibility_permission,
                d.screen_time_permission, d.notification_permission, d.status as device_status
         FROM parent_child_relations pc
         JOIN users u ON pc.child_user_id = u.id
         LEFT JOIN devices d ON d.user_id = pc.child_user_id
         WHERE pc.parent_user_id = $1
         ORDER BY u.display_name`,
                [user.userId]
            );

            return response(200, {
                success: true,
                data: result.rows.map(row => ({
                    id: row.child_user_id,
                    childName: row.child_name,
                    email: row.child_email,
                    deviceName: row.platform ? `${row.platform}` : null,
                    status: row.device_status === 'ACTIVE' ? 'ONLINE' : 'OFFLINE',
                    lastSeenAt: row.last_seen_at,
                    hasPermission: row.platform === 'IOS' ? row.screen_time_permission === 'GRANTED' : row.accessibility_permission === 'GRANTED'
                }))
            });
        }

        // GET /parent-child/parents - 보호자 목록 조회
        if (httpMethod === 'GET' && path === '/parent-child/parents') {
            const user = await requireAuth(event);

            // 본인 및 동일한 자녀를 관리하는 다른 보호자 목록
            const result = await client.query(
                `SELECT DISTINCT u.id, u.display_name, u.email, pc.is_primary
                 FROM users u
                 JOIN parent_child_relations pc ON u.id = pc.parent_user_id
                 WHERE pc.child_user_id IN (
                     SELECT child_user_id FROM parent_child_relations WHERE parent_user_id = $1
                 ) OR u.id = $1`,
                [user.userId]
            );

            return response(200, {
                success: true,
                data: result.rows.map(row => ({
                    id: row.id,
                    parentName: row.display_name,
                    email: row.email,
                    isPrimary: row.is_primary || (row.id === user.userId) // 임시: 본인은 우선 관리자로 표시
                }))
            });
        }

        // POST /parent-child/registration-qr - 등록/초대 QR 생성
        if (httpMethod === 'POST' && path === '/parent-child/registration-qr') {
            const user = await requireAuth(event);
            const { type, name } = data; // type: 'CHILD' | 'PARENT'

            const exp = Math.floor(Date.now() / 1000) + (60 * 60); // 1시간 유효
            const qrId = getUUID();

            const payloadObj = {
                type: type === 'CHILD' ? 'CHILD_REGISTRATION' : 'PARENT_LINK',
                issuerId: user.userId,
                issuerName: name,
                qrId,
                exp
            };

            const sig = crypto.createHmac('sha256', QR_SECRET_KEY)
                .update(JSON.stringify(payloadObj))
                .digest('hex');

            return response(200, {
                success: true,
                data: {
                    payload: JSON.stringify({ ...payloadObj, sig })
                }
            });
        }

        // POST /parent-child/link - 부모-자녀 연결
        if (httpMethod === 'POST' && path === '/parent-child/link') {
            const user = await requireAuth(event);
            const { childId, nickname } = data;

            const linkId = getUUID();
            await client.query(
                `INSERT INTO parent_child_relations (id, parent_user_id, child_user_id, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (parent_user_id, child_user_id) DO NOTHING`,
                [linkId, user.userId, childId]
            );

            // 해당 자녀에 대한 PARENT 권한 추가 (CHILD scope)
            await client.query(
                `INSERT INTO user_roles (user_id, role, scope_type, scope_id)
                 VALUES ($1, 'PARENT', 'CHILD', $2)
                 ON CONFLICT (user_id, role, scope_id) DO NOTHING`,
                [user.userId, childId]
            );

            return response(200, {
                success: true,
                message: '자녀가 연결되었습니다'
            });
        }

        // GET /parent-child/{childId}/schedules - 자녀 스케줄 조회
        if (httpMethod === 'GET' && path.includes('/parent-child/') && path.includes('/schedules')) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const childId = pathParts[pathParts.indexOf('parent-child') + 1];

            // 권한 확인
            const authCheck = await client.query(
                'SELECT 1 FROM parent_child_relations WHERE parent_user_id = $1 AND child_user_id = $2',
                [user.userId, childId]
            );

            if (authCheck.rows.length === 0) {
                return response(403, { success: false, message: '권한이 없습니다' });
            }

            const result = await client.query(
                'SELECT * FROM child_schedules WHERE child_user_id = $1 AND status = \'ACTIVE\' ORDER BY start_time',
                [childId]
            );

            return response(200, {
                success: true,
                data: result.rows
            });
        }

        // POST /parent-child/{childId}/schedules - 스케줄 생성
        if (httpMethod === 'POST' && path.includes('/parent-child/') && path.includes('/schedules') && !path.match(/\/schedules\/[^/]+$/)) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const childId = pathParts[pathParts.indexOf('parent-child') + 1];

            // 권한 확인
            const authCheck = await client.query(
                'SELECT 1 FROM parent_child_relations WHERE parent_user_id = $1 AND child_user_id = $2',
                [user.userId, childId]
            );

            if (authCheck.rows.length === 0) {
                return response(403, { success: false, message: '권한이 없습니다' });
            }

            const { name, start_time, end_time, days_of_week, allowed_apps, blocked_categories } = data;

            const scheduleId = getUUID();
            const result = await client.query(
                `INSERT INTO child_schedules (
          id, child_user_id, name, start_time, end_time, status, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, NOW(), NOW())
        RETURNING *`,
                [scheduleId, childId, name, start_time, end_time, user.userId]
            );

            // 요일 정보 저장 (child_schedule_days 테이블)
            if (days_of_week && Array.isArray(days_of_week)) {
                for (const day of days_of_week) {
                    await client.query(
                        `INSERT INTO child_schedule_days (schedule_id, day) VALUES ($1, $2)`,
                        [scheduleId, day]
                    );
                }
            }

            return response(201, {
                success: true,
                schedule: result.rows[0]
            });
        }

        // ========================================
        // 출석 엔드포인트 (모두 JWT 필요)
        // ========================================

        // GET /attendance/class/{classId} - 수업 출석 조회
        if (httpMethod === 'GET' && path.includes('/attendance/class/')) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const classId = pathParts[pathParts.length - 1];

            const result = await client.query(
                `SELECT a.*, u.display_name as student_name, u.email as student_email
         FROM attendance a
         JOIN users u ON a.student_id = u.id
         WHERE a.class_id = $1
         ORDER BY a.created_at DESC`,
                [classId]
            );

            return response(200, {
                success: true,
                data: result.rows
            });
        }

        // GET /attendance/student/{studentId} - 학생 출석 이력
        if (httpMethod === 'GET' && path.includes('/attendance/student/')) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const studentId = pathParts[pathParts.length - 1];

            const result = await client.query(
                `SELECT a.*, q.purpose, q.class_id
         FROM attendance a
         JOIN qr_codes q ON a.qr_id = q.id
         WHERE a.student_id = $1
         ORDER BY a.created_at DESC
         LIMIT 100`,
                [studentId]
            );

            return response(200, {
                success: true,
                data: result.rows
            });
        }

        // ========================================
        // 기본 응답
        // ========================================

        return response(404, {
            success: false,
            message: 'Not Found',
            path,
            method: httpMethod
        });

    } catch (error) {
        if (error.message === 'UNAUTHORIZED') {
            return response(401, {
                success: false,
                message: '인증이 필요합니다'
            });
        }

        console.error('Handler Error:', error);
        return response(500, {
            success: false,
            message: error.message || '서버 내부 오류가 발생했습니다.',
            detail: error.stack,
            path,
            method: httpMethod
        });
    } finally {
        if (client) client.release();
    }
};
