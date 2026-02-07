import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { login, getProfile } from '@react-native-seoul/kakao-login';
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
    static async getDeviceData(): Promise<DeviceData> {
        return {
            platform: Platform.OS,
            osVersion: DeviceInfo.getSystemVersion(),
            brand: DeviceInfo.getBrand(),
            model: DeviceInfo.getModel(),
            deviceId: await DeviceInfo.getUniqueId(),
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

            // 1. Authenticate with Backend
            console.log(`[AuthService] Calling Backend Auth (/auth/kakao) with role: ${role}`);
            try {
                const response = await apiService.post<{ accessToken: string; refreshToken: string; user: any }>('/auth/kakao', {
                    kakaoAccessToken: token.accessToken,
                    role: role
                });

                console.log("[AuthService] Backend Auth Response received:", !!response?.accessToken ? "Success" : "No token");

                if (response?.accessToken) {
                    await StorageService.setAccessToken(response.accessToken);
                    if (response.refreshToken) {
                        await StorageService.setRefreshToken(response.refreshToken);
                    }
                    if (response.user?.role) {
                        await StorageService.setUserRole(response.user.role);
                        console.log("[AuthService] User role saved:", response.user.role);
                    }
                    // 2. Sync Device Info
                    console.log("[AuthService] Syncing device...");
                    await this.syncDevice();
                } else {
                    console.warn("[AuthService] No access token in backend response");
                }
            } catch (apiError) {
                console.error("[AuthService] Backend Authentication Failed:", apiError);
            }

            // Validate mandatory fields
            if (!profile.phoneNumber) {
                console.warn("Phone number not provided by Kakao. This is a mandatory requirement.");
            }

            const userInfo: UserInfo = {
                id: String(profile.id),
                phoneNumber: profile.phoneNumber || '',
                email: profile.email,
                name: profile.nickname,
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
}
