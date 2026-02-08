import pg from 'pg';
import crypto from 'crypto';

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

const response = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
});

/**
 * HMAC 서명 로직 (qr_id + exp)
 */
function generateHMAC(qrId, exp) {
    const message = `${qrId}:${exp}`;
    return crypto.createHmac('sha256', QR_SECRET_KEY)
        .update(message)
        .digest('hex');
}

/**
 * time_window 체크 ("HH:mm-HH:mm" + days)
 */
function checkTimeWindow(windowStr) {
    if (!windowStr) return { valid: true };
    try {
        const [timePart, daysPart] = windowStr.split('|');

        // Convert UTC to KST (UTC+9)
        const nowUtc = new Date();
        const now = new Date(nowUtc.getTime() + (9 * 60 * 60 * 1000));
        const kstTimeStr = now.toISOString().replace('T', ' ').substring(0, 19);

        // 1. Day Check
        if (daysPart) {
            const dayMap = { 0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" };
            const currentDay = dayMap[now.getDay()];
            const allowedDays = daysPart.split(',');
            if (!allowedDays.includes(currentDay)) {
                return {
                    valid: false,
                    message: `오늘은 예약된 요일이 아닙니다. (현재: ${currentDay}, 허용: ${daysPart})`
                };
            }
        }

        // 2. Time Check
        const [startStr, endStr] = timePart.split('-');
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [sH, sM] = startStr.split(':').map(Number);
        const [eH, eM] = endStr.split(':').map(Number);

        // Allow 10 minutes lead time
        let startTime = sH * 60 + sM - 10;
        let endTime = eH * 60 + eM;

        let isWithin = false;
        if (endTime < startTime) {
            // Midnight wrap case (e.g. 23:00 to 01:00)
            isWithin = (currentTime >= startTime) || (currentTime <= endTime);
        } else {
            // Normal case
            isWithin = currentTime >= startTime && currentTime <= endTime;
        }

        if (!isWithin) {
            const h = Math.floor(currentTime / 60);
            const m = currentTime % 60;
            return {
                valid: false,
                message: `예약 시간이 아닙니다.\n(현재: ${h}:${m.toString().padStart(2, '0')}, 범위: ${startStr}~${endStr})\n[서버시간(KST): ${kstTimeStr}]`
            };
        }
        return { valid: true };
    } catch (e) {
        console.error("checkTimeWindow Error:", e);
        return { valid: false, message: `검증 중 오류: ${e.message}` };
    }
}

/**
 * JWT에서 userId 추출 (간단한 구현, 실제로는 jwt.verify 사용 권장)
 */
function getUserIdFromEvent(event) {
    // API Gateway Authorizer에서 설정한 userId
    return event.requestContext?.authorizer?.userId || null;
}

export const handler = async (event) => {
    const httpMethod = (event.requestContext?.http?.method || event.httpMethod || "").toUpperCase();
    const requestPath = event.rawPath || event.path || event.resource || "";
    const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : "{}";
    const data = JSON.parse(body);
    const queryParams = event.queryStringParameters || {};

    const client = await pool.connect();

    try {
        // ============================================
        // 1. 기기 등록 (POST /devices/register)
        // ============================================
        if (httpMethod === 'POST' && requestPath.endsWith('/devices/register')) {
            const { id, device_uuid, platform, device_model, os_version, app_version } = data;
            const query = `
                INSERT INTO devices (id, device_uuid, platform, device_model, os_version, app_version, last_seen_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (device_uuid) DO UPDATE SET 
                    os_version = EXCLUDED.os_version,
                    app_version = EXCLUDED.app_version,
                    last_seen_at = NOW()
                RETURNING *;
            `;
            const result = await client.query(query, [id, device_uuid, platform, device_model, os_version, app_version]);
            return response(200, { success: true, message: "Device registered", device: result.rows[0] });
        }

        // ============================================
        // 2. 권한 업데이트 (PATCH /devices/{id}/permissions)
        // ============================================
        if (httpMethod === 'PATCH' && requestPath.includes('/permissions')) {
            const pathParts = requestPath.split('/');
            const deviceId = pathParts[pathParts.length - 2];

            const { accessibility, screenTime, notification } = data;

            const query = `
                UPDATE devices 
                SET 
                    accessibility_permission = COALESCE($1, accessibility_permission),
                    screen_time_permission = COALESCE($2, screen_time_permission),
                    notification_permission = COALESCE($3, notification_permission),
                    permission_status = $4,
                    last_permission_sync = NOW(),
                    last_seen_at = NOW()
                WHERE id = $5 OR device_uuid = $5::text
                RETURNING *;
            `;

            const result = await client.query(query, [
                accessibility,
                screenTime,
                notification,
                JSON.stringify(data), // 하위 호환성을 위해 JSONB도 유지
                deviceId
            ]);

            if (result.rows.length === 0) {
                return response(404, { success: false, message: "Device not found" });
            }

            return response(200, {
                success: true,
                device: result.rows[0],
                message: "Permissions updated successfully"
            });
        }

        // ============================================
        // 3. QR 생성 (POST /qr/generate)
        // ============================================
        if (httpMethod === 'POST' && requestPath.endsWith('/qr/generate')) {
            const { type, duration_minutes, blocked_apps, time_window, days, userId } = data;

            // Combine time and days for storage if days are provided
            let finalWindow = time_window;
            if (time_window && days && days.length > 0) {
                finalWindow = `${time_window}|${days.join(',')}`;
            }

            // 정책 저장
            const pRes = await client.query(
                `INSERT INTO lock_policies (lock_duration_minutes, allowed_apps, time_window, created_by) 
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [duration_minutes, blocked_apps || [], finalWindow || null, userId || null]
            );
            const policyId = pRes.rows[0].id;

            // QR 생성 및 HMAC 서명
            const qrId = crypto.randomUUID();
            const exp = Math.floor(Date.now() / 1000) + (24 * 3600);
            const sig = generateHMAC(qrId, exp);

            await client.query(
                `INSERT INTO qr_codes (id, qr_type, issuer_id, lock_policy_id, hmac_sig, expires_at) 
                 VALUES ($1, $2, $3, $4, $5, to_timestamp($6))`,
                [qrId, type, userId || null, policyId, sig, exp]
            );

            return response(200, {
                success: true,
                qr_id: qrId,
                payload: JSON.stringify({ qr_id: qrId, exp, sig })
            });
        }

        // ============================================
        // 4. QR 스캔 검증 (POST /qr/scan)
        // ============================================
        if (httpMethod === 'POST' && requestPath.endsWith('/qr/scan')) {
            const { qrPayload, deviceId } = data;
            const { qr_id, exp, sig } = JSON.parse(qrPayload);

            // HMAC 검증
            if (generateHMAC(qr_id, exp) !== sig) {
                return response(401, { success: false, message: "위변조된 QR 코드입니다." });
            }

            // 만료 확인
            if (exp < Math.floor(Date.now() / 1000)) {
                return response(400, { success: false, message: "만료된 QR 코드입니다." });
            }

            // 디바이스 및 권한 확인
            const deviceCheck = await client.query(`
                SELECT 
                    id, 
                    platform,
                    accessibility_permission,
                    screen_time_permission
                FROM devices 
                WHERE id = $1 OR device_uuid = $1::text 
                LIMIT 1
            `, [deviceId]);

            if (deviceCheck.rows.length === 0) {
                return response(404, {
                    success: false,
                    message: "Device not found"
                });
            }

            const device = deviceCheck.rows[0];
            const dbDeviceId = device.id;

            // 플랫폼별 권한 확인
            let hasPermission = false;
            if (device.platform === 'IOS') {
                hasPermission = device.screen_time_permission === true;
            } else if (device.platform === 'ANDROID') {
                hasPermission = device.accessibility_permission === true;
            }

            // 권한 없으면 에러 반환
            if (!hasPermission) {
                return response(403, {
                    success: false,
                    requiresPermission: true,
                    message: "Required permissions not granted",
                    platform: device.platform
                });
            }

            // QR 정보 조회
            const res = await client.query(
                `SELECT q.qr_type, q.one_device_once, p.* 
                 FROM qr_codes q 
                 JOIN lock_policies p ON q.lock_policy_id = p.id 
                 WHERE q.id = $1`,
                [qr_id]
            );

            if (res.rows.length === 0) {
                return response(404, { success: false, message: "존재하지 않는 QR입니다." });
            }

            const qrInfo = res.rows[0];

            // 시간 윈도우 체크
            const timeCheck = checkTimeWindow(qrInfo.time_window);
            if (!timeCheck.valid) {
                return response(403, { success: false, message: timeCheck.message });
            }

            // 1회성 사용 체크
            if (qrInfo.one_device_once) {
                const uRes = await client.query(
                    `SELECT 1 FROM qr_device_usage WHERE qr_id = $1 AND device_id = $2`,
                    [qr_id, dbDeviceId]
                );
                if (uRes.rows.length > 0) {
                    return response(403, { success: false, message: "이미 사용된 QR 코드입니다." });
                }
                await client.query(
                    `INSERT INTO qr_device_usage (qr_id, device_id) VALUES ($1, $2)`,
                    [qr_id, dbDeviceId]
                );
            }

            // 출석 기록
            if (qrInfo.qr_type === 'CLASS_ATTEND') {
                await client.query(
                    `INSERT INTO attendance (qr_id, device_id) VALUES ($1, $2)`,
                    [qr_id, dbDeviceId]
                );
            }

            return response(200, {
                success: true,
                lockPolicy: {
                    name: qrInfo.name || "집중 모드",
                    durationMinutes: qrInfo.lock_duration_minutes,
                    allowedApps: Array.isArray(qrInfo.allowed_apps) ? qrInfo.allowed_apps : []
                }
            });
        }

        // ============================================
        // 5. 자녀 목록 조회 (GET /parent-child/children)
        // ============================================
        if (httpMethod === 'GET' && requestPath.endsWith('/parent-child/children')) {
            const userId = getUserIdFromEvent(event) || data.userId;

            if (!userId) {
                return response(401, { success: false, message: "Unauthorized" });
            }

            const query = `
                SELECT 
                    u.id,
                    u.name as child_name,
                    d.device_model as device_name,
                    d.last_seen_at,
                    CASE 
                        WHEN d.platform = 'IOS' THEN d.screen_time_permission
                        WHEN d.platform = 'ANDROID' THEN d.accessibility_permission
                        ELSE NULL
                    END as has_permission,
                    CASE
                        WHEN d.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 'ONLINE'
                        WHEN d.last_seen_at > NOW() - INTERVAL '1 hour' THEN 'OFFLINE'
                        ELSE 'OFFLINE'
                    END as status
                FROM parent_child pc
                JOIN users u ON pc.child_id = u.id
                LEFT JOIN devices d ON d.user_id = u.id
                WHERE pc.parent_id = $1 AND pc.approved = TRUE
                ORDER BY u.name;
            `;

            const result = await client.query(query, [userId]);

            return response(200, {
                success: true,
                data: result.rows.map(row => ({
                    id: row.id,
                    childName: row.child_name,
                    deviceName: row.device_name,
                    status: row.status,
                    lastSeenAt: row.last_seen_at,
                    hasPermission: row.has_permission
                }))
            });
        }

        // ============================================
        // 6. 자녀 스케줄 조회 (GET /parent-child/{childId}/schedules)
        // ============================================
        if (httpMethod === 'GET' && requestPath.includes('/parent-child/') && requestPath.endsWith('/schedules')) {
            const pathParts = requestPath.split('/');
            const childId = pathParts[pathParts.indexOf('parent-child') + 1];
            const userId = getUserIdFromEvent(event) || data.userId;

            if (!userId) {
                return response(401, { success: false, message: "Unauthorized" });
            }

            // 부모-자녀 관계 확인 또는 본인 확인
            const authCheck = await client.query(
                `SELECT 1 FROM parent_child 
                 WHERE (parent_id = $1 AND child_id = $2) OR $2 = $1`,
                [userId, childId]
            );

            if (authCheck.rows.length === 0) {
                return response(403, {
                    success: false,
                    message: "Access denied"
                });
            }

            const query = `
                SELECT * FROM child_schedules
                WHERE child_id = $1
                ORDER BY created_at DESC;
            `;

            const result = await client.query(query, [childId]);

            return response(200, {
                success: true,
                data: result.rows
            });
        }

        // ============================================
        // 7. 자녀 스케줄 저장 (POST /parent-child/{childId}/schedules)
        // ============================================
        if (httpMethod === 'POST' && requestPath.includes('/parent-child/') && requestPath.endsWith('/schedules')) {
            const pathParts = requestPath.split('/');
            const childId = pathParts[pathParts.indexOf('parent-child') + 1];
            const userId = getUserIdFromEvent(event) || data.userId;

            if (!userId) {
                return response(401, { success: false, message: "Unauthorized" });
            }

            const { name, startTime, endTime, days, apps, isActive } = data;

            // 유효성 검사
            if (!name || !startTime || !endTime || !days || !apps) {
                return response(400, {
                    success: false,
                    message: "Missing required fields: name, startTime, endTime, days, apps"
                });
            }

            // 부모-자녀 관계 확인
            const relationCheck = await client.query(
                `SELECT 1 FROM parent_child 
                 WHERE parent_id = $1 AND child_id = $2 AND approved = TRUE`,
                [userId, childId]
            );

            if (relationCheck.rows.length === 0) {
                return response(403, {
                    success: false,
                    message: "You don't have permission to manage this child's schedule"
                });
            }

            // 스케줄 저장
            const insertQuery = `
                INSERT INTO child_schedules 
                (child_id, parent_id, name, start_time, end_time, days, apps, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *;
            `;

            const result = await client.query(insertQuery, [
                childId,
                userId,
                name,
                startTime,
                endTime,
                days,
                apps,
                isActive !== undefined ? isActive : true
            ]);

            return response(201, {
                success: true,
                data: result.rows[0],
                message: "Schedule created successfully"
            });
        }

        // ============================================
        // 기본 응답
        // ============================================
        return response(200, {
            message: "LockMoment Core Engine Active",
            timestamp: new Date().toISOString(),
            path: requestPath,
            method: httpMethod
        });

    } catch (e) {
        console.error("Handler Error:", e);
        return response(500, { success: false, message: e.message, stack: e.stack });
    } finally {
        client.release();
    }
};
