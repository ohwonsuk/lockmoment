import { apiService } from './ApiService';
import { StorageService } from './StorageService';

/**
 * 실제 로그인 사용자 여부 판단
 * 기준: auth_provider가 'ANONYMOUS'가 아닌 경우 (KAKAO, APPLE 등)
 *
 * - ANONYMOUS 사용자: users 테이블에 존재하나 auth_provider='ANONYMOUS',
 *   role='CHILD'로 저장됨. device_id와 매칭된 관계만 있고 실제 로그인 계정 없음.
 * - 로그인 사용자: auth_provider='KAKAO' 또는 'APPLE', users 테이블에 실제 계정 존재.
 *
 * ⚠️ role만으로 판단 불가 — 서버가 ANONYMOUS 사용자에게도 role='CHILD'를 부여함.
 */
async function isLoggedInUser(): Promise<boolean> {
    const token = await StorageService.getAccessToken();
    if (!token) return false;

    const profile = await StorageService.getUserProfile();
    // auth_provider가 없거나 'ANONYMOUS'이면 게스트 사용자
    if (!profile || !profile.auth_provider || profile.auth_provider === 'ANONYMOUS') {
        return false;
    }
    // 'KAKAO', 'APPLE' 등 실제 소셜 로그인 사용자만 true
    return true;
}

export interface Preset {
    id: string;
    scope: 'SYSTEM' | 'ORG' | 'USER';
    owner_id?: string;
    name: string;
    description?: string;
    category?: 'HOME' | 'SCHOOL' | 'COMMON';
    purpose: 'LOCK_ONLY' | 'ATTENDANCE_ONLY' | 'LOCK_AND_ATTENDANCE';
    lock_type?: 'FULL' | 'APP_ONLY';
    preset_type?: 'INSTANT' | 'SCHEDULED'; // For personal presets
    allowed_categories?: string[];
    blocked_categories?: string[];
    allowed_apps?: string[];
    default_duration_minutes?: number;
    duration_minutes?: number; // For personal presets (INSTANT)
    start_time?: string;      // For personal presets (SCHEDULED)
    end_time?: string;        // For personal presets (SCHEDULED)
    days?: string[];           // For personal presets (SCHEDULED)
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
     * Lambda에서 /presets 엔드포인트를 사용하며, 역할에 따라 자동으로 필터링됨
     */
    static async getRecommendedPresets(): Promise<Preset[]> {
        try {
            // /presets 엔드포인트는 사용자 역할에 따라 자동으로 HOME/SCHOOL/COMMON 필터링
            const response = await apiService.get<{ success: boolean; presets: Preset[] }>('/presets');
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

    /**
     * 개인용 Preset 목록 조회 (개인용 테이블 사용)
     */
    static async getPersonalPresets(): Promise<Preset[]> {
        try {
            // 카카오/애플 로그인 사용자만 서버 사용 (익명/게스트 제외)
            const loggedIn = await isLoggedInUser();

            if (loggedIn) {
                // Logged in: fetch from server
                const response = await apiService.get<{ success: boolean; presets: Preset[] }>('/personal-presets');
                const serverPresets = response.presets || [];

                // Sync to local storage
                await StorageService.savePersonalPresets(serverPresets);
                return serverPresets;
            } else {
                // Not logged in (or guest): use local storage only
                const localPresets = await StorageService.getPersonalPresets();
                return localPresets;
            }
        } catch (error) {
            console.error('[PresetService] getPersonalPresets failed:', error);
            // Fallback to local storage on error
            const localPresets = await StorageService.getPersonalPresets();
            return localPresets;
        }
    }

    /**
     * 개인용 Preset 생성/수정
     */
    static async savePersonalPreset(preset: Partial<Preset>): Promise<Preset> {
        try {
            // 카카오/애플 로그인 사용자만 서버 사용
            const loggedIn = await isLoggedInUser();

            if (loggedIn) {
                // Logged in: save to server
                const response = await apiService.post<{ success: boolean; preset: Preset }>('/personal-presets', preset);

                // Sync to local storage
                const allPresets = await this.getPersonalPresets();
                await StorageService.savePersonalPresets(allPresets);

                return response.preset;
            } else {
                // Guest / Not logged in: save to local storage only
                const localPresets = await StorageService.getPersonalPresets();
                const newPreset = {
                    ...preset,
                    id: preset.id || `local_${Date.now()}`,
                    scope: 'USER' as const,
                    purpose: 'LOCK_ONLY' as const,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                } as Preset;

                const index = localPresets.findIndex((p: Preset) => p.id === newPreset.id);
                if (index > -1) {
                    localPresets[index] = newPreset;
                } else {
                    localPresets.push(newPreset);
                }

                await StorageService.savePersonalPresets(localPresets);
                return newPreset;
            }
        } catch (error) {
            console.error('[PresetService] savePersonalPreset failed:', error);
            throw error;
        }
    }

    /**
     * 개인용 Preset 업데이트 (기존 항목 덮어쓰기)
     */
    static async updatePersonalPreset(presetId: string, preset: Partial<Preset>): Promise<Preset> {
        try {
            // 카카오/애플 로그인 사용자만 서버 사용
            const loggedIn = await isLoggedInUser();

            if (loggedIn) {
                const response = await apiService.put<{ success: boolean; preset: Preset }>(
                    `/personal-presets/${presetId}`,
                    preset
                );
                const allPresets = await this.getPersonalPresets();
                await StorageService.savePersonalPresets(allPresets);
                return response.preset;
            } else {
                // Guest / Not logged in: update local storage only
                const localPresets = await StorageService.getPersonalPresets();
                const index = localPresets.findIndex((p: Preset) => p.id === presetId);
                const updated = {
                    ...localPresets[index],
                    ...preset,
                    id: presetId,
                    updated_at: new Date().toISOString()
                } as Preset;
                if (index > -1) {
                    localPresets[index] = updated;
                } else {
                    localPresets.push(updated);
                }
                await StorageService.savePersonalPresets(localPresets);
                return updated;
            }
        } catch (error) {
            console.error('[PresetService] updatePersonalPreset failed:', error);
            throw error;
        }
    }

    /**
     * 개인용 Preset 삭제
     */
    static async deletePersonalPreset(presetId: string): Promise<boolean> {
        try {
            // 카카오/애플 로그인 사용자만 서버 사용
            const loggedIn = await isLoggedInUser();

            if (loggedIn) {
                // Logged in: delete from server
                const response = await apiService.delete<{ success: boolean }>(`/personal-presets/${presetId}`);

                // Sync to local storage
                const allPresets = await this.getPersonalPresets();
                await StorageService.savePersonalPresets(allPresets);

                return response.success;
            } else {
                // Guest / Not logged in: delete from local storage only
                const localPresets = await StorageService.getPersonalPresets();
                const filtered = localPresets.filter((p: Preset) => p.id !== presetId);
                await StorageService.savePersonalPresets(filtered);
                return true;
            }
        } catch (error) {
            console.error('[PresetService] deletePersonalPreset failed:', error);
            throw error;
        }
    }
}
