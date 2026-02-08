import { apiService } from './ApiService';
import { AuthService } from './AuthService';

export interface QrGenerateRequest {
    type: 'CLASS_ATTEND' | 'USER_INSTANT_LOCK' | 'USER_SCHEDULE_LOCK' | 'CHILD_REGISTRATION';
    ref_id: string; // class_id, device_id, etc.
    lock_duration_minutes?: number;
    title?: string;
    blocked_apps?: string[];
    time_window?: string;
    days?: string[];
    one_time?: boolean;
}

export interface QrGenerateResponse {
    success: boolean;
    qr_id: string;
    payload: string; // HMAC signed payload
}

export interface QrScanResponse {
    success: boolean;
    message?: string;
    lockPolicy?: {
        name: string;
        durationMinutes: number;
        timeWindow?: string;
        schedule?: any;
        allowedApps?: string[];
        preventAppRemoval?: boolean;
    };
    registrationInfo?: {
        parentId: string;
        parentName: string;
        childName: string;
    };
}

export class QrService {
    static async generateQr(
        type: 'CLASS_ATTEND' | 'USER_INSTANT_LOCK' | 'USER_SCHEDULE_LOCK' | 'CHILD_REGISTRATION' = 'USER_INSTANT_LOCK',
        duration: number = 60,
        title?: string,
        blockedApps?: string[],
        timeWindow?: string,
        days?: string[]
    ): Promise<QrGenerateResponse | null> {
        try {
            const deviceData = await AuthService.getDeviceData();

            const response = await apiService.post<QrGenerateResponse>('/qr/generate', {
                type,
                device_id: deviceData.deviceId,
                duration_minutes: duration,
                title: title,
                blocked_apps: blockedApps,
                time_window: timeWindow,
                days: days,
                one_time: type === 'USER_INSTANT_LOCK'
            });

            return response;
        } catch (error) {
            console.error("[QrService] QR Generation Failed:", error);
            return null;
        }
    }

    static async scanQr(payload: string): Promise<QrScanResponse> {
        try {
            const deviceData = await AuthService.getDeviceData();

            const response = await apiService.post<QrScanResponse>('/qr/scan', {
                qrPayload: payload,
                deviceId: deviceData.deviceId
            });

            return response;
        } catch (error: any) {
            console.error("[QrService] QR Scan Failed:", error);
            // error is likely the message string or { success, message } from ApiService.ts
            if (typeof error === 'object' && error !== null) {
                return {
                    success: false,
                    message: error.message || "스캔 처리에 실패했습니다."
                };
            }
            return {
                success: false,
                message: String(error) || "스캔 처리에 실패했습니다."
            };
        }
    }
}
