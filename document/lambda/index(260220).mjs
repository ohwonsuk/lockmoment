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
        if (!process.env.DB_HOST || !process.env.DB_NAME) {
            console.warn('[Warning] Missing environment variables: DB_HOST or DB_NAME');
        }

        // ========================================
        // 1. 인증 및 사용자 관리
        // ========================================

        // POST /auth/apple - Apple Sign-In
        if (httpMethod === 'POST' && path === '/auth/apple') {
            const { identityToken, user: appleUser, appleSub: appleSubFromData } = data;
            const appleId = appleSubFromData || appleUser?.user;

            if (!appleId) {
                return response(400, { success: false, message: 'Apple identity (sub) is missing' });
            }

            let userResult = await client.query(
                `SELECT u.*, ur.role 
                 FROM users u 
                 LEFT JOIN user_roles ur ON u.id = ur.user_id 
                 WHERE u.apple_sub = $1
                 ORDER BY ur.assigned_at DESC`,
                [appleId]
            );

            let dbUser = userResult.rows[0];
            const phoneNumber = data.phone || appleUser?.phone; // Get phone if provided in data

            if (!dbUser && phoneNumber) {
                // Phone matching logic (260220)
                const phoneMatch = await client.query(`SELECT * FROM users WHERE phone_number = $1`, [phoneNumber]);
                if (phoneMatch.rows.length > 0) {
                    dbUser = phoneMatch.rows[0];
                    await client.query(`UPDATE users SET apple_sub = $1, auth_provider = 'APPLE', updated_at = NOW() WHERE id = $2`, [appleId, dbUser.id]);
                }
            }

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

        // POST /auth/register - 회원가입
        if (httpMethod === 'POST' && path === '/auth/register') {
            const { appleSub, kakaoUserId, name, phone, email, role, provider, birthYear } = data;
            if (!name || !phone || !role || !provider) {
                return response(400, { success: false, message: '필수 정보가 누락되었습니다.' });
            }

            let checkQuery = provider === 'APPLE' ? 'SELECT id FROM users WHERE apple_sub = $1' : 'SELECT id FROM users WHERE kakao_user_id = $1';
            let checkParam = provider === 'APPLE' ? appleSub : kakaoUserId;

            if (checkParam) {
                const checkResult = await client.query(checkQuery, [checkParam]);
                if (checkResult.rows.length > 0) {
                    const existingUserId = checkResult.rows[0].id;
                    await client.query(
                        `UPDATE users SET display_name = $1, phone_number = $2, email = $3, birth_year = $4, updated_at = NOW() WHERE id = $5`,
                        [name, phone, email, birthYear, existingUserId]
                    );
                    await client.query(
                        `INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, $2, NULL, 'GLOBAL')
                         ON CONFLICT (user_id, role, scope_id) DO NOTHING`,
                        [existingUserId, role]
                    );
                    const dbUser = (await client.query(`SELECT u.*, ur.role FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE u.id = $1`, [existingUserId])).rows[0];
                    return response(200, {
                        success: true,
                        accessToken: await generateAccessToken(dbUser.id, dbUser.role),
                        refreshToken: await generateRefreshToken(dbUser.id),
                        user: { ...dbUser, name: dbUser.display_name, phone: dbUser.phone_number, role: dbUser.role }
                    });
                }
            }

            const userId = getUUID();
            let insertQuery = provider === 'APPLE'
                ? `INSERT INTO users (id, auth_provider, apple_sub, email, display_name, phone_number, birth_year, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`
                : `INSERT INTO users (id, auth_provider, kakao_user_id, email, display_name, phone_number, birth_year, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`;

            const result = await client.query(insertQuery, [userId, provider, checkParam, email, name, phone, birthYear]);
            const dbUser = result.rows[0];

            await client.query(`INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, $2, NULL, 'GLOBAL')`, [userId, role]);

            return response(200, {
                success: true,
                accessToken: await generateAccessToken(dbUser.id, role),
                refreshToken: await generateRefreshToken(dbUser.id),
                user: { ...dbUser, name: dbUser.display_name, phone: dbUser.phone_number, role }
            });
        }

        // POST /auth/kakao - 카카오 로그인
        if (httpMethod === 'POST' && path === '/auth/kakao') {
            const { kakaoUserId, email, name, phoneNumber, role } = data;
            if (!kakaoUserId) return response(400, { success: false, message: 'kakaoUserId is required' });

            let userResult = await client.query(
                `SELECT u.*, ur.role FROM users u LEFT JOIN user_roles ur ON u.id = ur.user_id WHERE u.kakao_user_id = $1 ORDER BY ur.assigned_at DESC`,
                [kakaoUserId]
            );

            if (userResult.rows.length === 0) {
                let userId = getUUID();
                const newUserRole = role || 'PARENT';

                if (phoneNumber) {
                    // Phone matching logic (260220)
                    const phoneMatch = await client.query(`SELECT id FROM users WHERE phone_number = $1`, [phoneNumber]);
                    if (phoneMatch.rows.length > 0) {
                        userId = phoneMatch.rows[0].id;
                        await client.query(
                            `UPDATE users SET kakao_user_id = $1, auth_provider = 'KAKAO', email = COALESCE(email, $2), display_name = COALESCE(display_name, $3), updated_at = NOW() WHERE id = $4`,
                            [kakaoUserId, email || null, name || 'Kakao User', userId]
                        );
                    } else {
                        await client.query(
                            `INSERT INTO users (id, auth_provider, kakao_user_id, email, display_name, phone_number, created_at, updated_at)
                             VALUES ($1, 'KAKAO', $2, $3, $4, $5, NOW(), NOW())`,
                            [userId, kakaoUserId, email || null, name || 'Kakao User', phoneNumber || null]
                        );
                    }
                } else {
                    await client.query(
                        `INSERT INTO users (id, auth_provider, kakao_user_id, email, display_name, phone_number, created_at, updated_at)
                         VALUES ($1, 'KAKAO', $2, $3, $4, $5, NOW(), NOW())`,
                        [userId, kakaoUserId, email || null, name || 'Kakao User', phoneNumber || null]
                    );
                }

                await client.query(`INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, $2, NULL, 'GLOBAL') ON CONFLICT DO NOTHING`, [userId, newUserRole]);
                userResult = await client.query(`SELECT u.*, ur.role FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE u.id = $1`, [userId]);
            }

            const dbUser = userResult.rows[0];
            return response(200, {
                success: true,
                accessToken: await generateAccessToken(dbUser.id, dbUser.role),
                refreshToken: await generateRefreshToken(dbUser.id),
                user: { id: dbUser.id, email: dbUser.email, name: dbUser.display_name, role: dbUser.role, phone: dbUser.phone_number, auth_provider: dbUser.auth_provider }
            });
        }

        // POST /auth/anonymous - 익명 로그인
        if (httpMethod === 'POST' && path === '/auth/anonymous') {
            const { deviceData } = data;
            let userId = null;
            let isLinked = false;
            let role = 'CHILD';

            if (deviceData?.deviceId) {
                const deviceResult = await client.query(
                    `SELECT d.user_id, ur.role FROM devices d JOIN user_roles ur ON d.user_id = ur.user_id 
                     WHERE d.device_uuid = $1 AND ur.role = 'CHILD' LIMIT 1`, [deviceData.deviceId]
                );
                if (deviceResult.rows.length > 0) {
                    const potentialUserId = deviceResult.rows[0].user_id;
                    const relationResult = await client.query(`SELECT 1 FROM parent_child_relations WHERE child_user_id = $1 LIMIT 1`, [potentialUserId]);
                    if (relationResult.rows.length > 0) {
                        userId = potentialUserId;
                        role = deviceResult.rows[0].role;
                        isLinked = true;
                    }
                }
            }

            if (!userId) {
                userId = getUUID();
                await client.query(`INSERT INTO users (id, auth_provider, created_at, updated_at) VALUES ($1, 'ANONYMOUS', NOW(), NOW())`, [userId]);
                await client.query(`INSERT INTO user_roles (user_id, role, scope_id, scope_type) VALUES ($1, 'CHILD', NULL, 'GLOBAL')`, [userId]);
            }

            if (deviceData) {
                await client.query(
                    `INSERT INTO devices (id, user_id, device_uuid, platform, device_model, os_version, status, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
                     ON CONFLICT (device_uuid) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()`,
                    [getUUID(), userId, deviceData.deviceId, deviceData.platform?.toUpperCase(), deviceData.model, deviceData.osVersion]
                );
            }

            return response(200, {
                success: true,
                accessToken: await generateAccessToken(userId, role),
                refreshToken: await generateRefreshToken(userId),
                user: { id: userId, role, auth_provider: 'ANONYMOUS', is_linked: isLinked }
            });
        }

        // POST /auth/refresh - 토큰 갱신
        if (httpMethod === 'POST' && path === '/auth/refresh') {
            const { refreshToken: token } = data;
            const decoded = await verifyToken(token);
            if (!decoded || decoded.type !== 'refresh') return response(401, { success: false, message: '유효하지 않은 리프레시 토큰' });

            const userResult = await client.query(
                `SELECT u.id, ur.role, u.auth_provider, EXISTS(SELECT 1 FROM parent_child_relations WHERE child_user_id = u.id OR parent_user_id = u.id) as is_linked
                 FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE u.id = $1`, [decoded.userId]
            );

            if (userResult.rows.length === 0) return response(404, { success: false, message: '사용자를 찾을 수 없습니다' });
            const dbUser = userResult.rows[0];

            return response(200, {
                success: true,
                accessToken: await generateAccessToken(dbUser.id, dbUser.role),
                user: { id: dbUser.id, role: dbUser.role, auth_provider: dbUser.auth_provider, is_linked: dbUser.is_linked }
            });
        }

        // POST /auth/pin/set - PIN 설정
        if (httpMethod === 'POST' && path === '/auth/pin/set') {
            const user = await requireAuth(event);
            const { pin } = data;
            if (pin === null || pin === "") {
                await client.query(`UPDATE users SET pin_code = NULL, updated_at = NOW() WHERE id = $1`, [user.userId]);
                return response(200, { success: true, message: 'PIN이 삭제되었습니다.' });
            }
            if (!pin || !/^\d{6}$/.test(pin)) return response(400, { success: false, message: 'PIN은 숫자 6자리여야 합니다.' });
            await client.query(`UPDATE users SET pin_code = $1, updated_at = NOW() WHERE id = $2`, [pin, user.userId]);
            return response(200, { success: true, message: 'PIN이 설정되었습니다.' });
        }

        // POST /auth/pin/verify - PIN 검증
        if (httpMethod === 'POST' && path === '/auth/pin/verify') {
            const user = await requireAuth(event);
            const { pin } = data;
            const result = await client.query(`SELECT pin_code FROM users WHERE id = $1`, [user.userId]);
            if (result.rows[0]?.pin_code === pin) return response(200, { success: true, message: 'PIN 검증 성공' });
            return response(400, { success: false, message: 'PIN이 일치하지 않습니다.' });
        }

        // ========================================
        // 2. 프로필 및 다중 관계 (v260220 신규)
        // ========================================

        // GET /users/profile - 상세 프로필 조회
        if (httpMethod === 'GET' && path === '/users/profile') {
            const authUser = await requireAuth(event);
            const userRes = await client.query(`SELECT id, auth_provider, display_name, email, phone_number, birth_year, restrict_my_info, created_at FROM users WHERE id = $1`, [authUser.userId]);
            const user = userRes.rows[0];
            if (!user) return response(404, { success: false, message: '사용자를 찾을 수 없습니다.' });

            const parentsRes = await client.query(
                `SELECT u.id, u.display_name, u.email, pc.nickname, pc.is_primary FROM parent_child_relations pc JOIN users u ON pc.parent_user_id = u.id WHERE pc.child_user_id = $1`, [authUser.userId]
            );
            const childrenRes = await client.query(
                `SELECT u.id, u.display_name, u.email, pc.nickname, pc.is_primary FROM parent_child_relations pc JOIN users u ON pc.child_user_id = u.id WHERE pc.parent_user_id = $1`, [authUser.userId]
            );
            const rolesRes = await client.query(
                `SELECT ur.role, ur.scope_type, ur.scope_id, o.name as org_name FROM user_roles ur LEFT JOIN organizations o ON ur.scope_id = o.id AND ur.scope_type = 'ORG' WHERE ur.user_id = $1`, [authUser.userId]
            );

            return response(200, {
                success: true,
                data: {
                    user: { ...user, role: authUser.role },
                    relations: {
                        parents: parentsRes.rows,
                        children: childrenRes.rows,
                        organizations: rolesRes.rows.filter(r => r.scope_type === 'ORG').map(r => ({ id: r.scope_id, name: r.org_name, role: r.role }))
                    }
                }
            });
        }

        // PATCH /users/restriction - 자녀 접근 제한
        if (httpMethod === 'PATCH' && path === '/users/restriction') {
            const user = await requireAuth(event);
            const { childId, restrict } = data;
            const authCheck = await client.query('SELECT 1 FROM parent_child_relations WHERE parent_user_id = $1 AND child_user_id = $2', [user.userId, childId]);
            if (authCheck.rows.length === 0) return response(403, { success: false, message: '권한이 없습니다.' });
            await client.query(`UPDATE users SET restrict_my_info = $1, updated_at = NOW() WHERE id = $2`, [!!restrict, childId]);
            return response(200, { success: true, message: restrict ? '접근이 제한되었습니다.' : '제한이 해제되었습니다.' });
        }

        // POST /users/reset-pin - 자녀 PIN 초기화 (부모 전용)
        if (httpMethod === 'POST' && path === '/users/reset-pin') {
            const user = await requireAuth(event);
            const { childId } = data;
            const authCheck = await client.query('SELECT 1 FROM parent_child_relations WHERE parent_user_id = $1 AND child_user_id = $2', [user.userId, childId]);
            if (authCheck.rows.length === 0) return response(403, { success: false, message: '권한이 없습니다.' });
            await client.query(`UPDATE users SET pin_code = NULL, updated_at = NOW() WHERE id = $1`, [childId]);
            return response(200, { success: true, message: 'PIN이 초기화되었습니다.' });
        }

        // ========================================
        // 3. 디바이스 및 잠금
        // ========================================

        // POST /devices/register
        if (httpMethod === 'POST' && path === '/devices/register') {
            const user = await requireAuth(event);
            const { device_uuid, platform, device_model, os_version, app_version } = data;
            const result = await client.query(
                `INSERT INTO devices (id, user_id, device_uuid, platform, device_model, os_version, app_version, status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW())
                 ON CONFLICT (device_uuid) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW() RETURNING *`,
                [getUUID(), user.userId, device_uuid, platform?.toUpperCase() === 'IOS' ? 'IOS' : 'ANDROID', device_model, os_version, app_version]
            );
            return response(200, { success: true, device: result.rows[0] });
        }

        // PATCH /devices/{deviceId}/permissions
        if (httpMethod === 'PATCH' && path.includes('/devices/') && path.includes('/permissions')) {
            const user = await requireAuth(event);
            const deviceUuid = path.split('/')[2];
            const { accessibility, screenTime, notification } = data;
            const mapPerm = (v) => v === true ? 'GRANTED' : (v === false ? 'DENIED' : 'NOT_DETERMINED');
            const result = await client.query(
                `UPDATE devices SET accessibility_permission = CASE WHEN platform = 'ANDROID' THEN $1::permission_state_enum ELSE NULL END,
                 screen_time_permission = CASE WHEN platform = 'IOS' THEN $2::permission_state_enum ELSE NULL END,
                 notification_permission = $3::permission_state_enum, last_permission_sync = NOW(), updated_at = NOW()
                 WHERE LOWER(device_uuid) = LOWER($4) AND user_id = $5 RETURNING *`,
                [mapPerm(accessibility), mapPerm(screenTime), mapPerm(notification), deviceUuid, user.userId]
            );
            if (result.rows.length === 0) return response(404, { success: false, message: '디바이스를 찾을 수 없습니다' });
            return response(200, { success: true, device: result.rows[0] });
        }

        // POST /locks/start
        if (httpMethod === 'POST' && path === '/locks/start') {
            const user = await requireAuth(event);
            const { device_id, lock_name, lock_type, duration_minutes, lock_policy_id, preset_id, allowed_apps, blocked_apps, prevent_app_removal, source, initiated_by } = data;

            let dbDeviceId = null;
            if (device_id) {
                const deviceRes = await client.query(`SELECT id FROM devices WHERE device_uuid = $1`, [device_id]);
                if (deviceRes.rows.length > 0) dbDeviceId = deviceRes.rows[0].id;
            }

            const endsAt = new Date(Date.now() + (duration_minutes || 60) * 60 * 1000);
            await client.query(`DELETE FROM active_locks WHERE user_id = $1 AND ends_at > NOW()`, [user.userId]);
            const result = await client.query(
                `INSERT INTO active_locks (user_id, device_id, lock_name, lock_type, ends_at, lock_policy_id, preset_id, allowed_apps, blocked_apps, prevent_app_removal, source, initiated_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                [user.userId, dbDeviceId, lock_name, lock_type, endsAt, lock_policy_id, preset_id, allowed_apps ? JSON.stringify(allowed_apps) : null, blocked_apps ? JSON.stringify(blocked_apps) : null, !!prevent_app_removal, source || 'MANUAL', initiated_by || user.userId]
            );
            return response(201, { success: true, lock: result.rows[0] });
        }

        // POST /locks/stop
        if (httpMethod === 'POST' && path === '/locks/stop') {
            const user = await requireAuth(event);
            const activeResult = await client.query(`SELECT * FROM active_locks WHERE user_id = $1 AND (ends_at > NOW() OR ends_at IS NULL)`, [user.userId]);
            if (activeResult.rows.length === 0) return response(404, { success: false, message: '활성화된 잠금이 없습니다' });

            const endedAt = new Date();
            for (const lock of activeResult.rows) {
                const startTime = new Date(lock.created_at);
                const durationMinutes = Math.max(1, Math.round((endedAt - startTime) / 60000));
                await client.query(
                    `INSERT INTO lock_history (user_id, device_id, lock_name, lock_type, started_at, ended_at, duration_minutes, lock_policy_id, preset_id, source, initiated_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [lock.user_id, lock.device_id, lock.lock_name, lock.lock_type, startTime, endedAt, durationMinutes, lock.lock_policy_id, lock.preset_id, lock.source, lock.initiated_by]
                );
            }
            await client.query(`DELETE FROM active_locks WHERE user_id = $1 AND (ends_at > NOW() OR ends_at IS NULL)`, [user.userId]);
            return response(200, { success: true, message: '잠금이 종료되었습니다.' });
        }

        // GET /locks/status
        if (httpMethod === 'GET' && path === '/locks/status') {
            const user = await requireAuth(event);
            const result = await client.query(`SELECT * FROM active_locks WHERE user_id = $1 AND ends_at > NOW() ORDER BY created_at DESC LIMIT 1`, [user.userId]);
            return response(200, { success: true, isLocked: result.rows.length > 0, lock: result.rows[0] || null });
        }

        // ========================================
        // 4. 프리셋 및 QR
        // ========================================

        // [GET/POST/DELETE] /personal-presets
        if (path === '/personal-presets') {
            const user = await requireAuth(event);
            if (httpMethod === 'GET') {
                const res = await client.query('SELECT * FROM personal_presets WHERE user_id = $1 ORDER BY created_at DESC', [user.userId]);
                return response(200, { success: true, presets: res.rows });
            }
            if (httpMethod === 'POST') {
                const { id, name, description, lock_type, preset_type, allowed_apps, blocked_apps, duration_minutes, days } = data;
                if (id) {
                    const res = await client.query(`UPDATE personal_presets SET name=$1, description=$2, lock_type=$3, allowed_apps=$4, blocked_apps=$5, duration_minutes=$6, days=$7, updated_at=NOW() WHERE id=$8 AND user_id=$9 RETURNING *`,
                        [name, description, lock_type, JSON.stringify(allowed_apps), JSON.stringify(blocked_apps), duration_minutes, JSON.stringify(days), id, user.userId]);
                    return response(200, { success: true, preset: res.rows[0] });
                } else {
                    const res = await client.query(`INSERT INTO personal_presets (id, user_id, name, description, lock_type, preset_type, allowed_apps, blocked_apps, duration_minutes, days) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                        [getUUID(), user.userId, name, description, lock_type || 'FULL', preset_type || 'INSTANT', JSON.stringify(allowed_apps), JSON.stringify(blocked_apps), duration_minutes, JSON.stringify(days)]);
                    return response(201, { success: true, preset: res.rows[0] });
                }
            }
        }
        if (httpMethod === 'DELETE' && path.startsWith('/personal-presets/')) {
            const user = await requireAuth(event);
            await client.query('DELETE FROM personal_presets WHERE id = $1 AND user_id = $2', [path.split('/').pop(), user.userId]);
            return response(200, { success: true, message: '삭제되었습니다' });
        }

        // GET /presets (시스템/기관 프리셋)
        if (httpMethod === 'GET' && path === '/presets') {
            const user = await requireAuth(event);
            const { scope } = event.queryStringParameters || {};
            let query = "SELECT *, name as title FROM preset_policies WHERE is_active = true";
            let params = [];
            if (scope) {
                params.push(scope);
                query += ` AND scope = $${params.length}`;
            } else {
                params.push(user.userId);
                query += ` AND (scope = 'SYSTEM' OR (scope = 'USER' AND owner_id = $${params.length}))`;
            }

            query += " ORDER BY name";
            const result = await client.query(query, params);
            return response(200, {
                success: true,
                presets: result.rows.map(r => ({ ...r, title: r.name }))
            });
        }

        // POST /qr/generate
        if (httpMethod === 'POST' && path === '/qr/generate') {
            const user = await requireAuth(event);
            let { preset_id, title, duration_minutes, target_type, target_id, schedule_mode, allowed_apps, allowed_categories, blocked_categories, time_window, days } = data;

            let finalPurpose = data.purpose || 'LOCK_AND_ATTENDANCE';
            let policyId = null;

            if (preset_id) {
                const pr = await client.query('SELECT * FROM preset_policies WHERE id = $1', [preset_id]);
                if (pr.rows.length === 0) return response(404, { success: false, message: '프리셋을 찾을 수 없습니다' });
                const prs = pr.rows[0];
                if (prs.purpose) finalPurpose = prs.purpose;

                policyId = getUUID();
                await client.query(
                    `INSERT INTO lock_policies (id, preset_id, lock_type, duration_minutes, allowed_apps, allowed_categories, blocked_categories, time_window, days, title, created_by) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        policyId, preset_id, prs.lock_type, duration_minutes || prs.default_duration_minutes,
                        JSON.stringify(allowed_apps || prs.allowed_apps || []),
                        JSON.stringify(allowed_categories || prs.allowed_categories || []),
                        JSON.stringify(blocked_categories || prs.blocked_categories || []),
                        time_window || prs.time_window,
                        days ? JSON.stringify(days) : (prs.days ? JSON.stringify(prs.days) : null),
                        title || prs.name,
                        user.userId
                    ]
                );
            } else if (allowed_apps || allowed_categories || blocked_categories || time_window) {
                policyId = getUUID();
                await client.query(
                    `INSERT INTO lock_policies (id, lock_type, duration_minutes, allowed_apps, allowed_categories, blocked_categories, time_window, days, title, created_by) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        policyId, data.lock_type || 'APP_ONLY', duration_minutes || 60,
                        JSON.stringify(allowed_apps || []),
                        JSON.stringify(allowed_categories || []),
                        JSON.stringify(blocked_categories || []),
                        time_window || null,
                        days ? JSON.stringify(days) : null,
                        title || '직접 설정 잠금',
                        user.userId
                    ]
                );
            }

            const qrId = getUUID();
            const exp = Math.floor(Date.now() / 1000) + 86400;
            const sig = generateHMAC(qrId, exp);
            await client.query(`INSERT INTO qr_codes (id, qr_type, purpose, preset_id, lock_policy_id, target_type, target_id, schedule_mode, hmac_sig, status, created_by) VALUES ($1, 'DYNAMIC', $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)`,
                [
                    qrId, finalPurpose.toUpperCase(), preset_id || null, policyId,
                    (target_type || 'STUDENT').toUpperCase(),
                    target_id || user.userId,
                    (schedule_mode || 'IMMEDIATE').toUpperCase(),
                    sig, user.userId
                ]
            );

            return response(200, { success: true, qr_id: qrId, payload: JSON.stringify({ qr_id: qrId, exp, sig }) });
        }

        // GET /qr/{qrId} - QR 상세 조회
        if (httpMethod === 'GET' && path.startsWith('/qr/') && !path.includes('/scan')) {
            const user = await requireAuth(event);
            const qrId = path.split('/')[2];
            const result = await client.query(
                `SELECT q.*, p.lock_type, p.duration_minutes, p.allowed_apps, p.title as policy_title
                 FROM qr_codes q LEFT JOIN lock_policies p ON q.lock_policy_id = p.id
                 WHERE q.id = $1 AND q.created_by = $2`,
                [qrId, user.userId]
            );
            if (result.rows.length === 0) return response(404, { success: false, message: 'QR 코드를 찾을 수 없습니다' });
            return response(200, { success: true, qr: result.rows[0] });
        }

        // POST /parent-child/registration-qr (260220 추가)
        if (httpMethod === 'POST' && path === '/parent-child/registration-qr') {
            const user = await requireAuth(event);
            const { type, name, birthYear, phone } = data;

            const qrId = getUUID();
            const exp = Math.floor(Date.now() / 1000) + 86400; // 24h
            const payloadValue = {
                type: type === 'CHILD' ? 'CHILD_REGISTRATION' : 'PARENT_LINK',
                issuerId: user.userId,
                issuerName: name,
                birthYear,
                phone,
                qrId,
                exp
            };
            const sig = crypto.createHmac('sha256', QR_SECRET_KEY).update(JSON.stringify(payloadValue)).digest('hex');
            const payload = JSON.stringify({ ...payloadValue, sig });

            return response(200, { success: true, data: { payload } });
        }

        // POST /qr/scan
        if (httpMethod === 'POST' && path === '/qr/scan') {
            const { qrPayload, deviceId } = data;
            let p; try { p = JSON.parse(qrPayload); } catch (e) { return response(400, { success: false, message: "잘못된 QR 형식" }); }

            if (p.type === 'CHILD_REGISTRATION' || p.type === 'PARENT_LINK') {
                const v = { type: p.type, issuerId: p.issuerId, issuerName: p.issuerName, birthYear: p.birthYear, phone: p.phone, qrId: p.qrId, exp: p.exp };
                if (crypto.createHmac('sha256', QR_SECRET_KEY).update(JSON.stringify(v)).digest('hex') !== p.sig) return response(401, { success: false, message: "위변조된 QR" });
                if (p.exp < Date.now() / 1000) return response(400, { success: false, message: "만료된 QR" });
                const iss = await client.query('SELECT display_name FROM users WHERE id = $1', [p.issuerId]);
                return response(200, { success: true, registrationInfo: { parentId: p.issuerId, parentName: iss.rows[0]?.display_name, childName: p.issuerName, birthYear: p.birthYear, phone: p.phone, childId: p.type === 'PARENT_LINK' ? p.issuerId : null } });
            }

            if (generateHMAC(p.qr_id || p.qrId, p.exp) !== p.sig) return response(401, { success: false, message: "위변조된 QR" });
            const qrResult = await client.query(
                `SELECT q.*, p.lock_type, p.duration_minutes, p.allowed_apps, p.allowed_categories, p.blocked_categories, 
                        p.time_window, p.days, p.title as policy_title
                 FROM qr_codes q LEFT JOIN lock_policies p ON q.lock_policy_id = p.id 
                 WHERE q.id = $1 AND q.status = 'ACTIVE'`,
                [p.qr_id || p.qrId]
            );
            if (qrResult.rows.length === 0) return response(404, { success: false, message: "비활성 QR" });
            const qr = qrResult.rows[0];

            const dev = await client.query(`SELECT d.* FROM devices d WHERE d.device_uuid = $1 OR d.id::text = $1`, [deviceId]);
            if (dev.rows.length === 0) return response(404, { success: false, message: "미등록 기기" });
            const device = dev.rows[0];

            // 출석 처리 (ATTENDANCE_ONLY 또는 LOCK_AND_ATTENDANCE)
            if (qr.purpose === 'ATTENDANCE_ONLY' || qr.purpose === 'LOCK_AND_ATTENDANCE') {
                const targetClassId = qr.target_type === 'CLASS' ? qr.target_id : null;
                if (targetClassId) {
                    await client.query(
                        `INSERT INTO attendance (id, qr_id, class_id, student_id, device_id, status, created_at)
                         VALUES ($1, $2, $3, $4, $5, 'PRESENT', NOW())
                         ON CONFLICT (qr_id, student_id) DO UPDATE SET status = 'PRESENT', created_at = NOW()`,
                        [getUUID(), qr.id, targetClassId, device.user_id, device.id]
                    );
                }
            }

            await client.query(`INSERT INTO qr_device_usage (id, qr_id, user_id, device_id, scanned_at) VALUES ($1, $2, $3, $4, NOW())`, [getUUID(), qr.id, device.user_id, device.id]);

            return response(200, {
                success: true,
                purpose: qr.purpose,
                lockPolicy: qr.lock_policy_id ? {
                    name: qr.policy_title || qr.title || '잠금 모드',
                    lock_type: qr.lock_type,
                    durationMinutes: qr.duration_minutes,
                    allowedApps: Array.isArray(qr.allowed_apps) ? qr.allowed_apps : [],
                    allowedCategories: Array.isArray(qr.allowed_categories) ? qr.allowed_categories : [],
                    blockedCategories: Array.isArray(qr.blocked_categories) ? qr.blocked_categories : [],
                    timeWindow: qr.time_window,
                    days: Array.isArray(qr.days) ? qr.days : (typeof qr.days === 'string' ? JSON.parse(qr.days) : qr.days)
                } : null
            });
        }

        // ========================================
        // 5. 관계 및 스케줄
        // ========================================

        // GET /parent-child/children - 자녀 목록 조회 (잠금 상태 포함)
        if (httpMethod === 'GET' && path === '/parent-child/children') {
            const user = await requireAuth(event);

            const result = await client.query(
                `SELECT DISTINCT ON (pc.child_user_id)
                    pc.child_user_id, 
                    COALESCE(pc.nickname, u.display_name) as child_name, 
                    u.email as child_email,
                    u.birth_year,
                    u.restrict_my_info,
                    (u.pin_code IS NOT NULL) as has_pin,
                    d.id as device_id, 
                    d.platform, 
                    d.device_model, 
                    d.accessibility_permission,
                    d.screen_time_permission, 
                    d.notification_permission, 
                    d.status as device_status,
                    d.updated_at as device_updated_at,
                    al.id as active_lock_id,
                    al.lock_name,
                    al.ends_at as lock_ends_at
                 FROM parent_child_relations pc
                 JOIN users u ON pc.child_user_id = u.id
                 LEFT JOIN devices d ON d.user_id = pc.child_user_id
                 LEFT JOIN active_locks al ON al.user_id = pc.child_user_id 
                    AND al.ends_at > NOW()
                 WHERE pc.parent_user_id = $1
                 ORDER BY pc.child_user_id, d.updated_at DESC NULLS LAST`,
                [user.userId]
            );

            // 스케줄 기반 잠금 상태 확인 (KST 기준)
            if (result.rows.length > 0) {
                const childIds = result.rows.map(c => c.child_user_id);
                const schedulesRes = await client.query(
                    `SELECT child_user_id, name, start_time, end_time, days 
                     FROM child_schedules 
                     WHERE child_user_id = ANY($1) AND is_active = TRUE`,
                    [childIds]
                );

                const now = new Date();
                const kstOffset = 9 * 60 * 60 * 1000;
                const kstDate = new Date(now.getTime() + kstOffset);
                const currentDay = ['일', '월', '화', '수', '목', '금', '토'][kstDate.getDay()];
                const currentMinutes = kstDate.getHours() * 60 + kstDate.getMinutes();

                result.rows.forEach(child => {
                    if (child.active_lock_id) return;
                    const childSchedules = schedulesRes.rows.filter(s => s.child_user_id === child.child_user_id);
                    for (const s of childSchedules) {
                        if (s.days.includes(currentDay)) {
                            const [startH, startM] = s.start_time.split(':').map(Number);
                            const [endH, endM] = s.end_time.split(':').map(Number);
                            const startTotal = startH * 60 + startM;
                            const endTotal = endH * 60 + endM;
                            if (currentMinutes >= startTotal && currentMinutes < endTotal) {
                                child.active_lock_id = 'SCHEDULED';
                                child.lock_name = s.name;
                                break;
                            }
                        }
                    }
                });
            }

            return response(200, {
                success: true,
                data: result.rows.map(row => {
                    let lockStatus = 'UNLOCKED';
                    if (row.active_lock_id) lockStatus = 'LOCKED';
                    else if (row.device_status !== 'ACTIVE') lockStatus = 'OFFLINE';

                    return {
                        id: row.child_user_id,
                        childName: row.child_name,
                        email: row.child_email,
                        birthYear: row.birth_year,
                        deviceName: row.platform ? `${row.platform}` : null,
                        deviceModel: row.device_model,
                        status: lockStatus,
                        lockName: row.lock_name || null,
                        lockEndsAt: row.lock_ends_at || null,
                        lastSeenAt: row.device_updated_at,
                        restrictMyInfo: row.restrict_my_info,
                        hasPin: row.has_pin,
                        hasPermission: row.platform === 'IOS'
                            ? row.screen_time_permission === 'GRANTED'
                            : row.accessibility_permission === 'GRANTED'
                    };
                })
            });
        }

        // GET /parent-child/{childId}/usage-stats - 오늘의 사용량 통계 (260221 반영)
        if (httpMethod === 'GET' && path.startsWith('/parent-child/') && path.endsWith('/usage-stats')) {
            const user = await requireAuth(event);
            const childId = path.split('/')[2];

            // 1. 오늘 완료된 잠금 시간 합산 (KST 기준 오늘의 시작부터)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const historyResult = await client.query(
                `SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
                 FROM lock_history
                 WHERE user_id = $1 AND started_at >= $2`,
                [childId, todayStart]
            );

            let totalUsage = parseInt(historyResult.rows[0].total_minutes || 0);

            // 2. 현재 진행 중인 잠금이 있다면 경과 시간 추가
            const activeResult = await client.query(
                `SELECT created_at FROM active_locks 
                 WHERE user_id = $1 AND (ends_at > NOW() OR ends_at IS NULL)
                 LIMIT 1`,
                [childId]
            );

            if (activeResult.rows.length > 0) {
                const startTime = new Date(activeResult.rows[0].created_at);
                const currentMs = new Date() - startTime;
                totalUsage += Math.floor(currentMs / 1000 / 60);
            }

            // 3. 오늘의 총 스케줄 제한 시간 계산 (단위: 분)
            // 요일 체크 (KST 기준)
            const daysKST = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const todayDay = daysKST[new Date().getDay()];

            const scheduleResult = await client.query(
                `SELECT start_time, end_time 
                 FROM child_schedules
                 WHERE child_user_id = $1 AND is_active = true 
                 AND days @> $2::jsonb`,
                [childId, JSON.stringify([todayDay])]
            );

            let totalLimit = 0;
            scheduleResult.rows.forEach(s => {
                const [sH, sM] = s.start_time.split(':').map(Number);
                const [eH, eM] = s.end_time.split(':').map(Number);

                let startMins = sH * 60 + sM;
                let endMins = eH * 60 + eM;

                if (endMins < startMins) {
                    totalLimit += (1440 - startMins) + endMins;
                } else {
                    totalLimit += (endMins - startMins);
                }
            });

            return response(200, {
                success: true,
                stats: {
                    totalUsage,
                    limit: totalLimit || 120 // 스케줄 없으면 기본 2시간 (예시)
                }
            });
        }

        // GET /reports/usage/{childId} - 주간 사용 리포트 데이터 (260221 반영)
        if (httpMethod === 'GET' && path.startsWith('/reports/usage/')) {
            const user = await requireAuth(event);
            const childId = path.split('/')[3];

            // 최근 7일간의 일별 통계
            const result = await client.query(
                `SELECT 
                    TO_CHAR(started_at, 'YYYY-MM-DD') as date,
                    COALESCE(SUM(duration_minutes), 0) as total_minutes
                 FROM lock_history
                 WHERE user_id = $1 AND started_at >= NOW() - INTERVAL '7 days'
                 GROUP BY TO_CHAR(started_at, 'YYYY-MM-DD')
                 ORDER BY date ASC`,
                [childId]
            );

            // 지난 7일 날짜 배열 생성 (빈 날짜 채우기용)
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                last7Days.push(date.toISOString().split('T')[0]);
            }

            const data = last7Days.map(date => {
                const dayData = result.rows.find(r => r.date === date);
                return {
                    date,
                    minutes: dayData ? parseInt(dayData.total_minutes) : 0
                };
            });

            return response(200, {
                success: true,
                report: data
            });
        }

        // GET /parent-child/parents - 보호자 목록 조회
        if (httpMethod === 'GET' && path === '/parent-child/parents') {
            const user = await requireAuth(event);
            const res = await client.query(
                `SELECT DISTINCT u.id, u.display_name as "parentName", u.email, pc.is_primary as "isPrimary"
                 FROM parent_child_relations pc
                 JOIN users u ON pc.parent_user_id = u.id
                 WHERE pc.child_user_id IN (
                     SELECT child_user_id FROM parent_child_relations WHERE parent_user_id = $1
                 )
                 OR u.id = $1`,
                [user.userId]
            );
            return response(200, { success: true, data: res.rows });
        }

        // POST /parent-child/link (기기 이전 로직 포함 필수)
        if (httpMethod === 'POST' && path === '/parent-child/link') {
            const authUser = await extractUserFromEvent(event);
            const { payload, childId, nickname, deviceId } = data;
            let pId, cId;
            let initialTokens = null;

            if (payload) {
                const p = JSON.parse(payload);
                const v = { type: p.type, issuerId: p.issuerId, issuerName: p.issuerName, birthYear: p.birthYear, phone: p.phone, qrId: p.qrId, exp: p.exp };
                if (crypto.createHmac('sha256', QR_SECRET_KEY).update(JSON.stringify(v)).digest('hex') !== p.sig) return response(401, { success: false, message: "위변조" });

                if (p.type === 'CHILD_REGISTRATION') {
                    pId = p.issuerId;
                    cId = authUser?.userId;

                    // [260220] 인증되지 않은 경우 (신규 자녀 기기) deviceId 기반으로 사용자 식별/생성
                    if (!cId) {
                        if (!deviceId) return response(401, { success: false, message: "인증 정보 또는 기기 식별자가 필요합니다." });
                        const devRes = await client.query(`SELECT user_id FROM devices WHERE device_uuid = $1`, [deviceId]);
                        if (devRes.rows.length > 0) {
                            cId = devRes.rows[0].user_id;
                        } else {
                            cId = getUUID();
                            await client.query(`INSERT INTO users (id, auth_provider) VALUES ($1, 'ANONYMOUS')`, [cId]);
                            await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'CHILD')`);
                            await client.query(`INSERT INTO devices (id, user_id, device_uuid, platform, status) VALUES ($1, $2, $3, 'UNKNOWN', 'ACTIVE')`, [getUUID(), cId, deviceId]);
                        }
                        // 신규/비인증 기기인 경우 토큰 발급
                        initialTokens = {
                            accessToken: await generateAccessToken(cId, 'CHILD'),
                            refreshToken: await generateRefreshToken(cId)
                        };
                    }

                    if (p.birthYear || p.phone) {
                        await client.query(`UPDATE users SET birth_year = COALESCE(birth_year, $1), phone_number = COALESCE(phone_number, $2), updated_at = NOW() WHERE id = $3`, [p.birthYear, p.phone, cId]);
                    }

                    const ex = await client.query(`SELECT child_user_id FROM parent_child_relations WHERE parent_user_id = $1 AND nickname = $2`, [pId, p.issuerName]);
                    if (ex.rows.length > 0) {
                        const existingId = ex.rows[0].child_user_id;
                        // 기존 자녀 계정이 있을 경우 현재 기기의 소유권을 기존 계정으로 이전
                        await client.query(`UPDATE devices SET is_active=FALSE WHERE user_id=$1`, [existingId]);
                        await client.query(`UPDATE devices SET user_id=$1 WHERE user_id=$2`, [existingId, cId]);

                        return response(200, {
                            success: true,
                            data: {
                                id: existingId,
                                accessToken: await generateAccessToken(existingId, 'CHILD'),
                                refreshToken: await generateRefreshToken(existingId),
                                user: { id: existingId, role: 'CHILD', name: p.issuerName }
                            }
                        });
                    }
                    await client.query(`INSERT INTO parent_child_relations (id, parent_user_id, child_user_id, nickname) VALUES ($1, $2, $3, $4)`, [getUUID(), pId, cId, p.issuerName]);

                    return response(200, {
                        success: true,
                        message: "연결 성공",
                        data: {
                            id: cId,
                            ...(initialTokens || {}),
                            user: initialTokens ? { id: cId, role: 'CHILD', name: p.issuerName } : null
                        }
                    });
                } else {
                    // PARENT_LINK는 인증된 사용자(보호자)만 가능
                    if (!authUser) return response(401, { success: false, message: "인증 필요" });
                    const ch = await client.query(`SELECT child_user_id FROM parent_child_relations WHERE parent_user_id = $1`, [p.issuerId]);
                    for (let r of ch.rows) await client.query(`INSERT INTO parent_child_relations (id, parent_user_id, child_user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [getUUID(), authUser.userId, r.child_user_id]);
                }
            } else {
                // 일반 링크 (legacy/manual)는 인증 필수
                if (!authUser) return response(401, { success: false, message: "인증 필요" });
                await client.query(`INSERT INTO parent_child_relations (id, parent_user_id, child_user_id, nickname) VALUES ($1, $2, $3, $4)`, [getUUID(), authUser.userId, childId, nickname]);
            }
            return response(200, { success: true, message: "연결 성공" });
        }

        // [GET/POST/PUT/DELETE] /parent-child/{childId}/schedules
        if (path.includes('/schedules')) {
            const user = await requireAuth(event);
            const pathParts = path.split('/');
            const childId = pathParts[pathParts.indexOf('parent-child') + 1];
            const scheduleId = pathParts.length > pathParts.indexOf('schedules') + 1 ? pathParts[pathParts.indexOf('schedules') + 1] : null;

            // 권한 확인: 부모이거나, 자녀 본인이어야 함
            const isParent = (await client.query('SELECT 1 FROM parent_child_relations WHERE parent_user_id = $1 AND child_user_id = $2', [user.userId, childId])).rows.length > 0;
            const isSelf = user.userId === childId;
            if (!isParent && !isSelf) return response(403, { success: false, message: '권한이 없습니다' });

            if (httpMethod === 'GET') {
                const res = await client.query(`SELECT * FROM child_schedules WHERE child_user_id = $1`, [childId]);
                return response(200, { success: true, schedules: res.rows });
            }
            if (httpMethod === 'POST') {
                const { name, start_time, end_time, days, lock_type, allowed_apps, blocked_apps, allowed_categories, blocked_categories, is_active } = data;
                const res = await client.query(
                    `INSERT INTO child_schedules (child_user_id, name, start_time, end_time, days, lock_type, allowed_apps, blocked_apps, allowed_categories, blocked_categories, is_active, created_by) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                    [childId, name, start_time, end_time, JSON.stringify(days), lock_type || 'FULL',
                        allowed_apps ? JSON.stringify(allowed_apps) : null,
                        blocked_apps ? JSON.stringify(blocked_apps) : null,
                        allowed_categories ? JSON.stringify(allowed_categories) : null,
                        blocked_categories ? JSON.stringify(blocked_categories) : null,
                        is_active !== false, user.userId]
                );
                return response(201, { success: true, schedule: res.rows[0] });
            }
            if (httpMethod === 'PUT' && scheduleId) {
                const { name, start_time, end_time, days, lock_type, allowed_apps, blocked_apps, allowed_categories, blocked_categories, is_active } = data;
                const res = await client.query(
                    `UPDATE child_schedules SET
                        name = COALESCE($1, name), start_time = COALESCE($2, start_time), end_time = COALESCE($3, end_time),
                        days = COALESCE($4, days), lock_type = COALESCE($5, lock_type),
                        allowed_apps = COALESCE($6, allowed_apps), blocked_apps = COALESCE($7, blocked_apps),
                        allowed_categories = COALESCE($8, allowed_categories), blocked_categories = COALESCE($9, blocked_categories),
                        is_active = COALESCE($10, is_active), updated_at = NOW()
                     WHERE id = $11 AND child_user_id = $12 RETURNING *`,
                    [name, start_time, end_time, days ? JSON.stringify(days) : null, lock_type,
                        allowed_apps ? JSON.stringify(allowed_apps) : null, blocked_apps ? JSON.stringify(blocked_apps) : null,
                        allowed_categories ? JSON.stringify(allowed_categories) : null, blocked_categories ? JSON.stringify(blocked_categories) : null,
                        is_active, scheduleId, childId]
                );
                return response(200, { success: true, schedule: res.rows[0] });
            }
            if (httpMethod === 'PATCH' && scheduleId && path.includes('/status')) {
                const { is_active } = data;
                await client.query(`UPDATE child_schedules SET is_active = $1, updated_at = NOW() WHERE id = $2 AND child_user_id = $3`, [is_active, scheduleId, childId]);
                return response(200, { success: true });
            }
            if (httpMethod === 'DELETE' && scheduleId) {
                await client.query(`DELETE FROM child_schedules WHERE id = $1 AND child_user_id = $2`, [scheduleId, childId]);
                return response(200, { success: true });
            }
        }

        // GET /attendance/class/{classId}
        if (httpMethod === 'GET' && path.includes('/attendance/class/')) {
            const user = await requireAuth(event);
            const classId = path.split('/').pop();
            const res = await client.query(`SELECT a.*, u.display_name as student_name FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.class_id = $1 ORDER BY a.created_at DESC`, [classId]);
            return response(200, { success: true, data: res.rows });
        }

        // GET /attendance/student/{studentId}
        if (httpMethod === 'GET' && path.includes('/attendance/student/')) {
            const user = await requireAuth(event);
            const studentId = path.split('/').pop();
            const res = await client.query(`SELECT a.*, q.purpose FROM attendance a JOIN qr_codes q ON a.qr_id = q.id WHERE a.student_id = $1 ORDER BY a.created_at DESC`, [studentId]);
            return response(200, { success: true, data: res.rows });
        }

        // GET /meta/categories
        if (httpMethod === 'GET' && path === '/meta/categories') {
            const res = await client.query(`SELECT * FROM app_categories ORDER BY display_name`);
            return response(200, { success: true, categories: res.rows });
        }

        // GET /meta/apps
        if (httpMethod === 'GET' && path === '/meta/apps') {
            const res = await client.query(`SELECT app_name, array_agg(package_name) as package_names, MAX(category) as category FROM app_category_map GROUP BY app_name ORDER BY app_name`);
            return response(200, { success: true, apps: res.rows.map(r => ({ name: r.app_name, packageNames: r.package_names, category: r.category })) });
        }

        return response(404, { success: false, message: 'Not Found', path });

    } catch (error) {
        console.error(error);
        if (error.message === 'UNAUTHORIZED') return response(401, { success: false, message: '인증 필요' });
        return response(500, { success: false, message: error.message });
    } finally {
        if (client) client.release();
    }
};
