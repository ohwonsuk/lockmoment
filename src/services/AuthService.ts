import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { login, getProfile } from '@react-native-seoul/kakao-login';

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
    static async loginWithKakao(): Promise<UserInfo | null> {
        try {
            await login();
            const profile = await getProfile();

            // Validate mandatory fields (Phone number is required for AS support)
            if (!profile.phoneNumber) {
                console.warn("Phone number not provided by Kakao. This is a mandatory requirement.");
                // Note: In real production, we might need to prompt for manual input if Kakao doesn't provide it
            }

            const userInfo: UserInfo = {
                id: String(profile.id),
                phoneNumber: profile.phoneNumber || '',
                email: profile.email,
                name: profile.nickname,
                birthYear: profile.birthyear
            };

            const deviceData = await this.getDeviceData();
            const fullProfile = { ...userInfo, ...deviceData };

            console.log("Logged in user with device data:", fullProfile);

            // Save to Storage or Server here (StorageService.saveUser(fullProfile))
            return userInfo;
        } catch (error) {
            console.error("Kakao Login Error:", error);
            return null;
        }
    }
}
