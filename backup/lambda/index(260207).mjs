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
 * HMCA 서명 로직 (qr_id + exp)
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

export const handler = async (event) => {
    const httpMethod = (event.requestContext?.http?.method || event.httpMethod || "").toUpperCase();
    const requestPath = event.rawPath || event.path || event.resource || "";
    const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : "{}";
    const data = JSON.parse(body);

    const client = await pool.connect();

    try {
        // 1. 기기 등록 (POST /devices/register)
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

        // 2. 권한 업데이트 (PATCH /devices/{id}/permissions)
        if (httpMethod === 'PATCH' && requestPath.includes('/permissions')) {
            const pathParts = requestPath.split('/');
            const deviceId = pathParts[pathParts.length - 2];
            const query = `UPDATE devices SET permission_status = $1, last_seen_at = NOW() WHERE id = $2 RETURNING *;`;
            const result = await client.query(query, [JSON.stringify(data), deviceId]);
            return response(200, { success: true, device: result.rows[0] });
        }

        // 3. QR 생성 (POST /qr/generate)
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
                [qrId, type, userId || null, policyId, sig, exp] // issuer_id, policyId 모두 포함
            );

            return response(200, {
                success: true,
                qr_id: qrId,
                payload: JSON.stringify({ qr_id: qrId, exp, sig })
            });
        }

        // 4. QR 스캔 검증 (POST /qr/scan)
        if (httpMethod === 'POST' && requestPath.endsWith('/qr/scan')) {
            const { qrPayload, deviceId } = data;
            const { qr_id, exp, sig } = JSON.parse(qrPayload);

            if (generateHMAC(qr_id, exp) !== sig) {
                return response(401, { success: false, message: "위변조된 QR 코드입니다." });
            }

            if (exp < Math.floor(Date.now() / 1000)) {
                return response(400, { success: false, message: "만료된 QR 코드입니다." });
            }

            const res = await client.query(
                `SELECT q.qr_type, p.* 
                 FROM qr_codes q 
                 JOIN lock_policies p ON q.lock_policy_id = p.id 
                 WHERE q.id = $1`,
                [qr_id]
            );

            if (res.rows.length === 0) return response(404, { success: false, message: "존재하지 않는 QR입니다." });
            const qrInfo = res.rows[0];

            const timeCheck = checkTimeWindow(qrInfo.time_window);
            if (!timeCheck.valid) {
                return response(403, { success: false, message: timeCheck.message });
            }

            const deviceCheck = await client.query(`SELECT id FROM devices WHERE id = $1 OR device_uuid = $1::text LIMIT 1`, [deviceId]);
            const dbDeviceId = deviceCheck.rows[0]?.id;

            if (qrInfo.one_device_once && dbDeviceId) {
                const uRes = await client.query(
                    `SELECT 1 FROM qr_device_usage WHERE qr_id = $1 AND device_id = $2`,
                    [qr_id, dbDeviceId]
                );
                if (uRes.rows.length > 0) return response(403, { success: false, message: "이미 사용된 QR 코드입니다." });
                await client.query(`INSERT INTO qr_device_usage (qr_id, device_id) VALUES ($1, $2)`, [qr_id, dbDeviceId]);
            }

            if (qrInfo.qr_type === 'CLASS_ATTEND' && dbDeviceId) {
                await client.query(`INSERT INTO attendance (qr_id, device_id) VALUES ($1, $2)`, [qr_id, dbDeviceId]);
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

        return response(200, { message: "LockMoment Core Engine Active", timestamp: new Date().toISOString() });
    } catch (e) {
        console.error("Handler Error:", e);
        return response(500, { success: false, message: e.message });
    } finally {
        client.release();
    }
};