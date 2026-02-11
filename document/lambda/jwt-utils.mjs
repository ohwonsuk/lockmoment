import * as jose from 'jose';

// JWT_SECRET은 최소 256비트(32바이트) 이상이어야 HS256 알고리즘을 사용할 수 있습니다.
// 환경 변수가 없거나 짧을 경우를 대비해 폴백(fallback)을 제공하거나 에러를 방지합니다.
const rawSecret = process.env.JWT_SECRET || 'default_secret_key_at_least_32_characters_long_for_hs256';
const JWT_SECRET = new TextEncoder().encode(rawSecret.padEnd(32, '0'));

const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/**
 * 액세스 토큰 생성
 * @param {string} userId - 사용자 ID
 * @param {string} role - 사용자 역할 (PARENT, TEACHER, STUDENT, ANONYMOUS)
 * @returns {Promise<string>} JWT 액세스 토큰
 */
export async function generateAccessToken(userId, role) {
    return await new jose.SignJWT({
        userId,
        role,
        type: 'access'
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRES_IN)
        .sign(JWT_SECRET);
}

/**
 * 리프레시 토큰 생성
 * @param {string} userId - 사용자 ID
 * @returns {Promise<string>} JWT 리프레시 토큰
 */
export async function generateRefreshToken(userId) {
    return await new jose.SignJWT({
        userId,
        type: 'refresh'
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(REFRESH_TOKEN_EXPIRES_IN)
        .sign(JWT_SECRET);
}

/**
 * JWT 토큰 검증
 * @param {string} token - 검증할 JWT 토큰
 * @returns {Promise<object|null>} 디코딩된 페이로드 또는 null
 */
export async function verifyToken(token) {
    try {
        const { payload } = await jose.jwtVerify(token, JWT_SECRET);
        return payload;
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return null;
    }
}

/**
 * API Gateway 이벤트에서 사용자 ID 추출
 * @param {object} event - API Gateway 이벤트 객체
 * @returns {Promise<string|null>} 사용자 ID 또는 null
 */
export async function extractUserIdFromEvent(event) {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const decoded = await verifyToken(token);

    return decoded?.userId || null;
}

/**
 * API Gateway 이벤트에서 사용자 정보 추출
 * @param {object} event - API Gateway 이벤트 객체
 * @returns {Promise<object|null>} 사용자 정보 (userId, role) 또는 null
 */
export async function extractUserFromEvent(event) {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const decoded = await verifyToken(token);

    if (!decoded || decoded.type !== 'access') {
        return null;
    }

    return {
        userId: decoded.userId,
        role: decoded.role
    };
}

