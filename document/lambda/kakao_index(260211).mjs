import axios from 'axios';

const KAKAO_USERINFO_URL = process.env.KAKAO_USERINFO_URL || 'https://kapi.kakao.com/v2/user/me';

export const handler = async (event) => {
    // 1. 디버깅 로그 (CloudWatch에서 확인 가능)
    console.log('[KakaoAuth] Received event:', JSON.stringify({
        httpMethod: event.httpMethod || event.requestContext?.http?.method,
        path: event.path || event.rawPath,
        isBase64Encoded: event.isBase64Encoded
    }));

    try {
        const method = (event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();

        // 2. CORS 사전 요청 처리
        if (method === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
                },
                body: JSON.stringify({ message: 'OK' })
            };
        }

        // 3. Body 파싱 (Base64 인코딩 및 Proxy Integration 완벽 대응)
        let body = {};
        if (event.body) {
            let bodyStr = event.body;
            if (event.isBase64Encoded) {
                bodyStr = Buffer.from(event.body, 'base64').toString('utf8');
            }
            try {
                body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
            } catch (e) {
                console.error('[KakaoAuth] JSON Parse Error:', e.message);
            }
        }

        const { kakaoAccessToken } = body;

        if (!kakaoAccessToken) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'kakaoAccessToken is required' })
            };
        }

        // 4. 카카오 API 호출 (Axios)
        console.log('[KakaoAuth] Calling Kakao API...');
        const kakaoRes = await axios.get(KAKAO_USERINFO_URL, {
            headers: {
                Authorization: `Bearer ${kakaoAccessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
            },
            timeout: 10000
        });

        const kakaoUser = kakaoRes.data;
        console.log('[KakaoAuth] Success:', kakaoUser.id);

        // 5. 성공 응답 (핸드폰 번호 포함)
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                provider: 'KAKAO',
                providerUserId: String(kakaoUser.id),
                email: kakaoUser.kakao_account?.email ?? null,
                phoneNumber: kakaoUser.kakao_account?.phone_number ?? null,
                name: kakaoUser.kakao_account?.name ?? kakaoUser.properties?.nickname ?? null
            })
        };

    } catch (err) {
        console.error('[KakaoAuth] Error Log:', err.response?.data || err.message);
        return {
            statusCode: err.response?.status || 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                message: 'Kakao Auth Error',
                error: err.response?.data || err.message
            })
        };
    }
};