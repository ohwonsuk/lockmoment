import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

export const handler = async (event) => {
    // 디버깅을 위해 전체 이벤트 로그 기록 (CloudWatch에서 확인 가능)
    console.log("Full Event:", JSON.stringify(event));

    // API 유형에 따른 필드 추출 (REST v1 vs HTTP v2 호환)
    const httpMethod = (event.requestContext?.http?.method || event.httpMethod || "").toUpperCase();
    const requestPath = event.rawPath || event.path || event.resource || "";
    const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : "{}";
    const data = JSON.parse(body);

    console.log(`Method: ${httpMethod}, Path: ${requestPath}`);


    try {
        // 1. 기기 등록 (경로에 /devices/register가 포함된 경우)
        if (httpMethod === 'POST' && requestPath.endsWith('/devices/register')) {
            const { id, device_uuid, platform, device_model, os_version, app_version } = data;

            const query = `
                INSERT INTO devices (id, device_uuid, platform, device_model, os_version, app_version, last_seen_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (device_uuid) 
                DO UPDATE SET 
                    device_model = EXCLUDED.device_model,
                    os_version = EXCLUDED.os_version,
                    app_version = EXCLUDED.app_version,
                    last_seen_at = NOW()
                RETURNING *;
            `;

            const result = await pool.query(query, [id, device_uuid, platform, device_model, os_version, app_version]);
            return response(200, { success: true, message: "Device registered", device: result.rows[0] });
        }

        // 2. 권한 동기화 (경로에 /permissions가 포함된 경우)
        if (httpMethod === 'PATCH' && requestPath.includes('/permissions')) {
            const pathParts = requestPath.split('/');
            const deviceId = pathParts[pathParts.length - 2]; // /devices/{id}/permissions 구조 가정

            const query = `
                UPDATE devices 
                SET permission_status = $1, last_seen_at = NOW() 
                WHERE id::text = $2 OR device_uuid = $2
                RETURNING *;
            `;
            const result = await pool.query(query, [JSON.stringify(data), deviceId]);
            return response(200, { success: true, message: "Permissions updated", device: result.rows[0] });
        }


        // 3. QR 생성 (POST /qr/generate)
        if (httpMethod === 'POST' && requestPath.endsWith('/qr/generate')) {
            const { type, device_id, duration_minutes, one_time } = data;

            // 3.1 잠금 정책 먼저 생성 (임시로 전체 차단 정책)
            const policyQuery = `
                INSERT INTO lock_policies (scope, lock_duration_minutes) 
                VALUES ($1, $2) RETURNING id;
            `;
            const policyResult = await pool.query(policyQuery, [type, duration_minutes || 60]);
            const policyId = policyResult.rows[0].id;

            // 3.2 QR 코드 레코드 생성
            const qrQuery = `
                INSERT INTO qr_codes (type, ref_id, lock_policy_id, one_time, valid_to)
                VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour')
                RETURNING id;
            `;
            // ref_id는 일단 device_id로 설정
            const qrResult = await pool.query(qrQuery, [type, device_id, policyId, one_time || false]);
            const qrId = qrResult.rows[0].id;

            return response(200, {
                success: true,
                qr_id: qrId,
                payload: qrId // 앱에서는 이 ID를 QR로 만듦
            });
        }

        // 4. QR 스캔 및 검증 (POST /qr/scan)
        if (httpMethod === 'POST' && requestPath.endsWith('/qr/scan')) {
            const { qrPayload, deviceId } = data;

            // QR 코드와 연결된 정책 조회
            const query = `
                SELECT q.*, p.lock_duration_minutes, p.blocked_categories, p.allowed_apps
                FROM qr_codes q
                JOIN lock_policies p ON q.lock_policy_id = p.id
                WHERE q.id::text = $1 AND (q.valid_to > NOW() OR q.valid_to IS NULL);
            `;
            const result = await pool.query(query, [qrPayload]);

            if (result.rows.length === 0) {
                return response(404, { success: false, message: "유효하지 않거나 만료된 QR입니다." });
            }

            const qrData = result.rows[0];

            // (선택) 출석 레코드 생성 (CLASS 타입일 경우)
            if (qrData.type === 'CLASS') {
                await pool.query(
                    `INSERT INTO attendance (qr_id, student_id) 
                    VALUES ($1, (SELECT user_id FROM devices WHERE device_uuid = $2 LIMIT 1))`,
                    [qrData.id, deviceId]
                );
            }

            return response(200, {
                success: true,
                lockPolicy: {
                    durationMinutes: qrData.lock_duration_minutes,
                    blockedCategories: qrData.blocked_categories || [],
                    allowedApps: qrData.allowed_apps || []
                }
            });
        }


        // 어떤 조건에도 맞지 않을 경우 (현재 발생 중인 현상 방지용 로그 포함)
        return response(200, {
            message: "Heartbeat Success (No route matched)",
            debug: { httpMethod, requestPath },
            now: new Date().toISOString()
        });

    } catch (error) {
        console.error("DB Error:", error);
        return response(500, { success: false, error: error.message });
    }
};

function response(statusCode, body) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(body),
    };
}