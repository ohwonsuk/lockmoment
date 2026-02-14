import { apiService } from './ApiService';

export interface Preset {
    id: string;
    scope: 'SYSTEM' | 'ORG' | 'USER';
    owner_id?: string;
    name: string;
    description?: string;
    category?: 'HOME' | 'SCHOOL' | 'COMMON';
    purpose: 'LOCK_ONLY' | 'ATTENDANCE_ONLY' | 'LOCK_AND_ATTENDANCE';
    lock_type?: 'FULL' | 'APP_ONLY';
    allowed_categories?: string[];
    blocked_categories?: string[];
    allowed_apps?: string[];
    default_duration_minutes?: number;
    isActive?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CreatePresetRequest {
    scope: 'ORG' | 'USER';
    name: string;
    description?: string;
    purpose: 'LOCK_ONLY' | 'ATTENDANCE_ONLY' | 'LOCK_AND_ATTENDANCE';
    lock_type?: 'FULL' | 'APP_ONLY';
    allowed_categories?: string[];
    blocked_categories?: string[];
    allowed_apps?: string[];
    default_duration_minutes?: number;
}

export interface ApplyPresetRequest {
    target_type: 'STUDENT' | 'DEVICE' | 'CLASS';
    target_id: string;
    duration_minutes?: number;
    overrides?: {
        allowed_apps?: string[];
        blocked_categories?: string[];
    };
}

export interface ApplyPresetResponse {
    success: boolean;
    qr_id?: string;
    qr_payload?: string;
    lock_policy_id?: string;
    message?: string;
}

/**
 * Preset 정책 관리 서비스
 */
export class PresetService {
    /**
     * Preset 목록 조회
     * @param scope - 조회할 Preset 범위 (SYSTEM, ORG, USER)
     * @param purpose - 필터링할 목적
     * @returns Preset 목록
     */
    static async getPresets(scope?: 'SYSTEM' | 'ORG' | 'USER', purpose?: string): Promise<Preset[]> {
        try {
            let url = '/presets';
            const params = [];
            if (scope) params.push(`scope=${scope}`);
            if (purpose) params.push(`purpose=${purpose}`);
            if (params.length > 0) url += `?${params.join('&')}`;

            const response = await apiService.get<{ success: boolean; presets: Preset[] }>(url);
            return response.presets || [];
        } catch (error) {
            console.error('[PresetService] getPresets failed:', error);
            throw error;
        }
    }

    /**
     * Preset 상세 조회
     */
    static async getPresetById(presetId: string): Promise<Preset> {
        try {
            const response = await apiService.get<{ success: boolean; preset: Preset }>(`/presets/${presetId}`);
            return response.preset;
        } catch (error) {
            console.error('[PresetService] getPresetById failed:', error);
            throw error;
        }
    }

    /**
     * 사용자 Preset 생성
     * @param preset - 생성할 Preset 정보
     */
    static async createPreset(preset: CreatePresetRequest): Promise<Preset> {
        try {
            const response = await apiService.post<{ success: boolean; preset: Preset }>('/presets', preset);
            return response.preset;
        } catch (error) {
            console.error('[PresetService] createPreset failed:', error);
            throw error;
        }
    }

    /**
     * Preset 비활성화
     */
    static async deactivatePreset(presetId: string): Promise<boolean> {
        try {
            const response = await apiService.patch<{ success: boolean }>(`/presets/${presetId}/deactivate`, {});
            return response.success;
        } catch (error) {
            console.error('[PresetService] deactivatePreset failed:', error);
            throw error;
        }
    }

    /**
     * Preset 적용
     * @param presetId - 적용할 Preset ID
     * @param target - 적용 대상 정보
     * @returns 적용 결과 (QR 정보 포함)
     */
    static async applyPreset(presetId: string, target: ApplyPresetRequest): Promise<ApplyPresetResponse> {
        try {
            const response = await apiService.post<ApplyPresetResponse>(`/presets/${presetId}/apply`, target);
            return response;
        } catch (error) {
            console.error('[PresetService] applyPreset failed:', error);
            throw error;
        }
    }

    /**
     * 추천 Preset 조회
     */
    static async getRecommendedPresets(): Promise<Preset[]> {
        try {
            const response = await apiService.get<{ success: boolean; presets: Preset[] }>('/presets/recommended');
            return response.presets || [];
        } catch (error) {
            console.error('[PresetService] getRecommendedPresets failed:', error);
            return [];
        }
    }

    /**
     * 시스템 Preset 목록 조회
     */
    static async getSystemPresets(): Promise<Preset[]> {
        return this.getPresets('SYSTEM');
    }
}
