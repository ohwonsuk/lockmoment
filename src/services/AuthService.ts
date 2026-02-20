import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { login, getProfile } from '@react-native-seoul/kakao-login';
import appleAuth from '@invertase/react-native-apple-authentication';
// @ts-ignore
import { decode as base64Decode } from 'base-64';
import { apiService } from './ApiService';
import { StorageService } from './StorageService';

export interface UserInfo {
    id: string;
    phoneNumber: string; // Mandatory
    email?: string;
    name?: string;
    birthYear?: string;
}

export interface DeviceData {
    platform: string;
    osVersion: string;
    brand: string;
    model: string;
    deviceId: string; // UUID
}

export class AuthService {
    /**
     * Convert device ID to valid UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
     * PostgreSQL requires proper UUID format with hyphens
     */
    private static formatAsUUID(deviceId: string): string {
        // Remove all non-alphanumeric characters
        const cleaned = deviceId.replace(/[^a-f0-9]/gi, '');

        // Pad to 32 characters if needed
        const padded = cleaned.padEnd(32, '0').substring(0, 32);

        // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        return `${padded.substring(0, 8)}-${padded.substring(8, 12)}-${padded.substring(12, 16)}-${padded.substring(16, 20)}-${padded.substring(20, 32)}`;
    }

    static async getDeviceData(): Promise<DeviceData> {
        const rawDeviceId = await DeviceInfo.getUniqueId();
        return {
            platform: Platform.OS,
            osVersion: DeviceInfo.getSystemVersion(),
            brand: DeviceInfo.getBrand(),
            model: DeviceInfo.getModel(),
            deviceId: this.formatAsUUID(rawDeviceId),
        };
    }

    /**
     * Kakao Login logic
     */
    static async loginWithKakao(role: 'PARENT' | 'TEACHER' = 'PARENT'): Promise<UserInfo | null> {
        try {
            console.log("[AuthService] Starting Kakao Login...");
            const token = await login();
            console.log("[AuthService] Kakao Login Success, token received");

            console.log("[AuthService] Fetching Kakao Profile...");
            const profile = await getProfile();
            console.log("[AuthService] Kakao Profile fetched:", JSON.stringify(profile, null, 2));

            // 1. Verify with Auth Lambda (Internet accessible)
            // Note: Replace this URL with your actual lockmoment-auth-kakao endpoint
            const AUTH_VERIFY_URL = 'https://18gffqu5rb.execute-api.ap-northeast-2.amazonaws.com/auth/kakao/verify';

            console.log("[AuthService] Verifying Kakao Token with Auth Lambda...");
            let verifiedData;
            try {
                // Using axios directly for the external auth lambda if it has a different base URL
                const verifyResponse = await apiService.post<any>(AUTH_VERIFY_URL, {
                    kakaoAccessToken: token.accessToken
                });
                verifiedData = verifyResponse;
                console.log("[AuthService] Kakao verification successful:", verifiedData.providerUserId);
            } catch (verifyError) {
                console.error("[AuthService] Kakao Verification Failed:", verifyError);
                return null;
            }

            // 2. Authenticate with Main Backend (VPC restricted)
            console.log(`[AuthService] Calling Main Backend Auth (/auth/kakao) with role: ${role}`);
            try {
                const response = await apiService.post<{ accessToken: string; refreshToken: string; user: any }>('/auth/kakao', {
                    kakaoUserId: verifiedData.providerUserId,
                    email: verifiedData.email,
                    name: verifiedData.name, // Use 'name' instead of 'nickname'
                    phoneNumber: verifiedData.phoneNumber,
                    role: role
                });

                console.log("[AuthService] Main Backend Auth Response received:", !!response?.accessToken ? "Success" : "No token");

                if (!response?.accessToken) {
                    console.warn("[AuthService] No access token in backend response");
                    return null;
                }

                await StorageService.setAccessToken(response.accessToken);
                if (response.refreshToken) {
                    await StorageService.setRefreshToken(response.refreshToken);
                }
                if (response.user?.role) {
                    await StorageService.setUserRole(response.user.role);
                    console.log("[AuthService] User role saved:", response.user.role);
                }

                if (response.user) {
                    await StorageService.setUserProfile(response.user);
                }

                // 3. Sync Device Info
                console.log("[AuthService] Syncing device...");
                await this.syncDevice();

            } catch (apiError) {
                console.error("[AuthService] Main Backend Authentication Failed:", apiError);
                return null;
            }

            // Validate mandatory fields
            if (!profile.phoneNumber) {
                console.warn("Phone number not provided by Kakao. This is a mandatory requirement.");
            }

            const userInfo: UserInfo = {
                id: verifiedData.providerUserId,
                phoneNumber: verifiedData.phoneNumber || profile.phoneNumber || '',
                email: verifiedData.email,
                name: verifiedData.name,
                birthYear: profile.birthyear
            };

            const deviceData = await this.getDeviceData();
            console.log("Logged in user with device data:", { ...userInfo, ...deviceData });

            return userInfo;
        } catch (error) {
            console.error("Kakao Login Error:", error);
            return null;
        }
    }

    static async syncDevice() {
        try {
            const deviceData = await this.getDeviceData();
            const response = await apiService.post('/devices/register', {
                id: deviceData.deviceId,
                device_uuid: deviceData.deviceId,
                platform: deviceData.platform.toUpperCase(),
                device_model: deviceData.model,
                os_version: deviceData.osVersion,
                app_version: DeviceInfo.getVersion(),
            });
            console.log("[AuthService] Device Synced Successfully, Response:", JSON.stringify(response, null, 2));
        } catch (error) {
            console.error("Device Sync Failed:", error);
        }
    }

    static async syncPermissions(permissions: any) {
        try {
            const deviceData = await this.getDeviceData();
            await apiService.patch(`/devices/${deviceData.deviceId}/permissions`, permissions);
            console.log("Permissions Synced:", permissions);
        } catch (error) {
            console.error("Permission Sync Failed:", error);
        }
    }

    /**
     * Apple Sign-In
     */
    static async loginWithApple(): Promise<UserInfo | { status: 'NEW_USER'; appleSub: string; email?: string; name?: string } | null> {
        try {
            console.log("[AuthService] Starting Apple Sign-In...");

            const appleAuthRequestResponse = await appleAuth.performRequest({
                requestedOperation: appleAuth.Operation.LOGIN,
                requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
            });

            const { identityToken, user, email, fullName } = appleAuthRequestResponse;

            console.log("[AuthService] Apple Sign-In Success");

            // 백엔드로 identityToken 전송
            console.log("[AuthService] Calling Backend Auth (/auth/apple)");
            const response = await apiService.post<{
                success: boolean;
                status?: 'NEW_USER';
                appleSub?: string;
                accessToken?: string;
                refreshToken?: string;
                user?: any;
                email?: string;
                name?: string;
            }>('/auth/apple', {
                identityToken,
                user: {
                    user,
                    email,
                    fullName
                }
            });

            if (response?.status === 'NEW_USER') {
                return {
                    status: 'NEW_USER',
                    appleSub: response.appleSub || '',
                    email: response.email,
                    name: response.name
                };
            }

            if (response?.accessToken) {
                await StorageService.setAccessToken(response.accessToken);
                if (response.refreshToken) {
                    await StorageService.setRefreshToken(response.refreshToken);
                }
                if (response.user?.role) {
                    await StorageService.setUserRole(response.user.role);
                    console.log("[AuthService] User role saved:", response.user.role);
                }

                if (response.user) {
                    await StorageService.setUserProfile(response.user);
                }

                // 디바이스 동기화
                console.log("[AuthService] Syncing device...");
                await this.syncDevice();

                return {
                    id: response.user.id,
                    phoneNumber: response.user.phone || '',
                    email: response.user.email,
                    name: response.user.name,
                };
            }

            return null;
        } catch (error) {
            console.error("[AuthService] Apple Sign-In failed:", error);
            return null;
        }
    }

    /**
     * 회원가입 처리 (추가 정보 입력 후)
     */
    static async registerUser(data: {
        provider: 'APPLE' | 'KAKAO';
        appleSub?: string;
        kakaoUserId?: string;
        name: string;
        phone: string;
        role: 'PARENT' | 'TEACHER';
        email?: string;
    }): Promise<UserInfo | null> {
        try {
            console.log("[AuthService] Starting User Registration...");
            const response = await apiService.post<{ accessToken: string; refreshToken: string; user: any }>('/auth/register', data);

            if (response?.accessToken) {
                await StorageService.setAccessToken(response.accessToken);
                if (response.refreshToken) {
                    await StorageService.setRefreshToken(response.refreshToken);
                }
                if (response.user?.role) {
                    await StorageService.setUserRole(response.user.role);
                }

                if (response.user) {
                    await StorageService.setUserProfile(response.user);
                }

                // 디바이스 동기화
                await this.syncDevice();

                return {
                    id: response.user.id,
                    phoneNumber: response.user.phone,
                    email: response.user.email,
                    name: response.user.name,
                };
            }
            return null;
        } catch (error) {
            console.error("[AuthService] Registration failed:", error);
            return null;
        }
    }

    /**
     * 익명 사용자 로그인 (게스트 모드)
     */
    static async loginAsGuest(): Promise<UserInfo | null> {
        try {
            console.log("[AuthService] Starting Guest Login...");

            const deviceData = await this.getDeviceData();

            const response = await apiService.post<{ accessToken: string; refreshToken: string; user: any }>('/auth/anonymous', {
                deviceData,
            });

            console.log("[AuthService] Guest Login Response received:", !!response?.accessToken ? "Success" : "No token");

            if (response?.accessToken) {
                await StorageService.setAccessToken(response.accessToken);
                if (response.refreshToken) {
                    await StorageService.setRefreshToken(response.refreshToken);
                }
                if (response.user?.role) {
                    await StorageService.setUserRole(response.user.role);
                }

                if (response.user) {
                    await StorageService.setUserProfile(response.user);
                }

                return {
                    id: response.user.id,
                    phoneNumber: '',
                    name: 'Guest',
                };
            }

            return null;
        } catch (error) {
            console.error("[AuthService] Guest login failed:", error);
            return null;
        }
    }

    /**
     * 액세스 토큰 갱신
     */
    static async refreshAccessToken(): Promise<boolean> {
        try {
            const refreshToken = await StorageService.getRefreshToken();
            if (!refreshToken) {
                console.log("[AuthService] No refresh token available");
                return false;
            }

            console.log("[AuthService] Refreshing access token...");
            const response = await apiService.post<{ accessToken: string }>('/auth/refresh', {
                refreshToken,
            });

            if (response?.accessToken) {
                await StorageService.setAccessToken(response.accessToken);
                console.log("[AuthService] Access token refreshed successfully");
                return true;
            }

            return false;
        } catch (error) {
            console.error("[AuthService] Token refresh failed:", error);
            return false;
        }
    }

    /**
     * 유효한 토큰 가져오기 (만료 시 자동 갱신)
     */
    static async getValidToken(): Promise<string | null> {
        const token = await StorageService.getAccessToken();
        if (!token) {
            return null;
        }

        try {
            // JWT 디코딩하여 만료 확인
            const payload = JSON.parse(base64Decode(token.split('.')[1]));
            const expiresAt = payload.exp * 1000;

            // 5분 이내 만료 예정이면 갱신
            if (expiresAt - Date.now() < 5 * 60 * 1000) {
                console.log("[AuthService] Token expiring soon, refreshing...");
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    return await StorageService.getAccessToken();
                }
                return null;
            }

            return token;
        } catch (error) {
            // 디코딩 실패 시 그냥 토큰 반환
            console.warn("[AuthService] Token decode failed, returning token as-is");
            return token;
        }
    }

    /**
     * 로그아웃
     */
    static async logout(): Promise<void> {
        try {
            await StorageService.setAccessToken(null);
            await StorageService.setRefreshToken(null);
            await StorageService.setUserRole(null);
            await StorageService.setUserProfile(null);
            console.log("[AuthService] Logged out successfully");
        } catch (error) {
            console.error("[AuthService] Logout failed:", error);
        }
    }

    static async fetchUserProfile(): Promise<any | null> {
        try {
            const response = await apiService.get<any>('/users/profile');
            if (response && response.success) {
                const profileData = response.data;
                await StorageService.setUserProfile(profileData);

                // Sync restriction status if present (for children)
                const userData = profileData.user || profileData;
                const restrictionValue = userData.restrict_my_info ?? userData.restrictMyInfo;
                if (restrictionValue !== undefined) {
                    await StorageService.setMyInfoRestricted(!!restrictionValue);
                }

                return profileData;
            }
            return null;
        } catch (error) {
            console.error("[AuthService] Fetch profile failed:", error);
            return null;
        }
    }

    static async getUserProfile(): Promise<UserInfo | any> {
        return await StorageService.getUserProfile();
    }

    // PIN and Restriction (260219 추가)
    /**
     * PIN 설정/변경
     */
    static async setPin(pin: string): Promise<boolean> {
        try {
            await apiService.post('/auth/pin/set', { pin });
            await StorageService.setHasPin(true);
            return true;
        } catch (error) {
            console.error("[AuthService] Set PIN failed:", error);
            return false;
        }
    }

    /**
     * PIN 검증
     */
    static async verifyPin(pin: string): Promise<boolean> {
        try {
            await apiService.post('/auth/pin/verify', { pin });
            return true;
        } catch (error) {
            console.error("[AuthService] Verify PIN failed:", error);
            return false;
        }
    }
}
