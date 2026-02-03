import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
// Note: We'll assume @react-native-seoul/kakao-login will be installed
// import { login, getProfile, Logout } from '@react-native-seoul/kakao-login';

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
            osVersion: await DeviceInfo.getSystemVersion(),
            brand: await DeviceInfo.getBrand(),
            model: await DeviceInfo.getModel(),
            deviceId: await DeviceInfo.getUniqueId(),
        };
    }

    /**
     * Kakao Login logic placeholder
     * In a real implementation, this would call @react-native-seoul/kakao-login
     */
    static async loginWithKakao(): Promise<UserInfo | null> {
        try {
            // const token = await login();
            // const profile = await getProfile();

            // Mock data for now until native libs are confirmed
            const mockUser: UserInfo = {
                id: "kakao_12345",
                phoneNumber: "010-1234-5678", // Must be retrieved from Kakao
                email: "test@kakao.com",
                name: "홍길동",
                birthYear: "1995"
            };

            const deviceData = await this.getDeviceData();
            console.log("Saving user with device data:", { ...mockUser, ...deviceData });

            // Save to Storage or Server here
            return mockUser;
        } catch (error) {
            console.error("Kakao Login Error:", error);
            return null;
        }
    }
}
