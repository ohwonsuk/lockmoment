import { apiService } from './ApiService';
import { AuthService } from './AuthService';

export interface QrGenerateRequest {
    type?: string;
    qr_type?: 'DYNAMIC' | 'STATIC';
    purpose?: 'LOCK_ONLY' | 'ATTENDANCE_ONLY' | 'LOCK_AND_ATTENDANCE';
    preset_id?: string;
    target_type?: 'STUDENT' | 'CLASS';
    target_id?: string;
    duration_minutes?: number;
    title?: string;
    blocked_apps?: string[];
    time_window?: string;
    days?: string[];
    one_time?: boolean;
    max_uses?: number;
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
    /**
     * QR 코드 생성
     * @param options - QR 생성 옵션
     */
    static async generateQr(options: QrGenerateRequest): Promise<QrGenerateResponse | null> {
        try {
            const deviceData = await AuthService.getDeviceData();

            const response = await apiService.post<QrGenerateResponse>('/qr/generate', {
                ...options,
                device_id: deviceData.deviceId,
                one_time: options.one_time ?? options.type === 'USER_INSTANT_LOCK'
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
