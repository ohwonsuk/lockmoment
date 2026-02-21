import { apiService, ApiResponse } from './ApiService';
import { AuthService } from './AuthService';

export interface ChildInfo {
    id: string;
    childName: string;
    deviceName?: string;
    deviceModel?: string;
    status: 'LOCKED' | 'UNLOCKED' | 'OFFLINE';
    lockName?: string; // 활성 잠금 이름
    lockEndsAt?: string; // 잠금 종료 시간
    lastSeenAt?: string;
    hasPermission?: boolean; // 권한 동의 여부
    hasAppSelection?: boolean; // 앱 선택 범위 설정 여부 (iOS)
    restrictMyInfo?: boolean; // 내 정보 접근 제한 여부 (부모 설정)
    birthYear?: number; // 출생연도 (260220 추가)
    phone?: string; // 핸드폰번호 (260220 추가)
    hasPin?: boolean; // PIN 설정 여부 (260221 추가)
}

export interface ParentChildRelation {
    id: string;
    parentId: string;
    childId: string;
    relation: 'PARENT' | 'TEACHER';
    approved: boolean;
    childInfo?: ChildInfo;
}

export interface ParentInfo {
    id: string;
    parentName: string;
    email?: string;
    isPrimary: boolean;
}

export const ParentChildService = {
    /**
     * Fetch list of linked children/students
     */
    async getLinkedChildren(): Promise<ChildInfo[]> {
        try {
            const response = await apiService.get<ApiResponse<ChildInfo[]>>('/parent-child/children');
            return response.success ? response.data : [];
        } catch (error) {
            console.error('[ParentChildService] Failed to fetch children:', error);
            return [];
        }
    },

    /**
     * Fetch list of linked parents (for shared management)
     */
    async getLinkedParents(): Promise<ParentInfo[]> {
        try {
            const response = await apiService.get<ApiResponse<ParentInfo[]>>('/parent-child/parents');
            return response.success ? response.data : [];
        } catch (error) {
            console.error('[ParentChildService] Failed to fetch parents:', error);
            return [];
        }
    },

    /**
     * Generate a registration QR payload
     */
    async generateRegistrationQr(type: 'CHILD' | 'PARENT', name: string, birthYear?: number, phone?: string): Promise<string> {
        try {
            const response = await apiService.post<ApiResponse<{ payload: string }>>('/parent-child/registration-qr', {
                type,
                name,
                birthYear,
                phone
            });
            return response.data.payload;
        } catch (error) {
            // Mock for demo
            return JSON.stringify({
                type: type === 'CHILD' ? 'CHILD_REGISTRATION' : 'PARENT_LINK',
                issuerId: 'current-user-id',
                name,
                birthYear,
                phone,
                timestamp: Date.now()
            });
        }
    },

    /**
     * Link a child using the registration payload scanned from QR
     */
    async linkChild(registrationPayload: string): Promise<ApiResponse> {
        const deviceData = await AuthService.getDeviceData();
        return apiService.post<ApiResponse>('/parent-child/link', {
            payload: registrationPayload,
            deviceId: deviceData.deviceId
        });
    },

    /**
     * Unlink a child or parent
     */
    async unlink(id: string, type: 'CHILD' | 'PARENT'): Promise<ApiResponse> {
        return apiService.delete<ApiResponse>(`/parent-child/${type.toLowerCase()}/${id}`);
    },

    /**
     * Send a remote lock command to a child's device
     */
    async remoteLockChild(childId: string, durationMinutes: number): Promise<ApiResponse> {
        return apiService.post<ApiResponse>(`/parent-child/${childId}/remote-lock`, { durationMinutes });
    },

    /**
     * Fetch schedules for a specific child
     */
    async getChildSchedules(childId: string): Promise<any[]> {
        try {
            console.log(`[ParentChildService] Fetching schedules for childId: ${childId}`);
            const response = await apiService.get<{ success: boolean; schedules: any[] }>(`/parent-child/${childId}/schedules`);
            console.log(`[ParentChildService] Response success=${response.success}, count=${response.schedules?.length || 0}`);
            if (response.success && response.schedules) {
                return response.schedules.map(s => ({
                    ...s,
                    isActive: s.is_active ?? s.isActive ?? true,
                    startTime: s.start_time ?? s.startTime,
                    endTime: s.end_time ?? s.endTime,
                    lockType: s.lock_type ?? s.lockType,
                    lockedApps: s.blocked_apps ?? s.lockedApps,
                    lockedCategories: s.blocked_categories ?? s.lockedCategories,
                    createdBy: s.created_by ?? s.createdBy,
                }));
            }
            console.log('[ParentChildService] Response was not successful or no schedules array');
            return [];
        } catch (error: any) {
            console.error('[ParentChildService] Failed to fetch child schedules:', error?.message || error);
            return [];
        }
    },

    /**
     * Create a new schedule for a child
     */
    async createChildSchedule(childId: string, schedule: {
        name: string;
        startTime: string;
        endTime: string;
        days: string[];
        lockType: 'FULL' | 'APP';
        allowedApps?: string[];
        blockedApps?: string[];
        allowedCategories?: string[];
        blockedCategories?: string[];
        isActive: boolean;
    }): Promise<ApiResponse> {
        // PostgreSQL 'chk_schedule_time' (start < end) 제약 조건 우회 및 자정 처리
        let normalizedEndTime = schedule.endTime;
        if (schedule.endTime.startsWith('00:00')) {
            normalizedEndTime = '23:59:59';
        }

        const normalizedLockType = (schedule.lockType as string).toUpperCase().includes('APP') ? 'APP_ONLY' : 'FULL';
        const payload = {
            name: schedule.name,
            start_time: schedule.startTime,
            end_time: normalizedEndTime,
            days: schedule.days,
            lock_type: normalizedLockType,
            allowed_apps: schedule.allowedApps || [],
            blocked_apps: schedule.blockedApps || [],
            allowed_categories: schedule.allowedCategories || [],
            blocked_categories: schedule.blockedCategories || [],
            is_active: schedule.isActive
        };
        console.log(`[ParentChildService] Creating schedule for child ${childId}:`, JSON.stringify(payload, null, 2));
        return apiService.post<ApiResponse>(`/parent-child/${childId}/schedules`, payload);
    },

    /**
     * Update an existing schedule
     */
    async updateChildSchedule(childId: string, scheduleId: string, schedule: {
        name?: string;
        startTime?: string;
        endTime?: string;
        days?: string[];
        lockType?: 'FULL' | 'APP';
        allowedApps?: string[];
        blockedApps?: string[];
        allowedCategories?: string[];
        blockedCategories?: string[];
        isActive?: boolean;
    }): Promise<ApiResponse> {
        const payload: any = {};
        if (schedule.name !== undefined) payload.name = schedule.name;
        if (schedule.startTime !== undefined) payload.start_time = schedule.startTime;
        if (schedule.endTime !== undefined) {
            payload.end_time = schedule.endTime.startsWith('00:00') ? '23:59:59' : schedule.endTime;
        }
        if (schedule.days !== undefined) payload.days = schedule.days;
        if (schedule.lockType !== undefined) {
            payload.lock_type = (schedule.lockType as string).toUpperCase().includes('APP') ? 'APP_ONLY' : 'FULL';
        }
        if (schedule.allowedApps !== undefined) payload.allowed_apps = schedule.allowedApps;
        if (schedule.blockedApps !== undefined) payload.blocked_apps = schedule.blockedApps;
        if (schedule.allowedCategories !== undefined) payload.allowed_categories = schedule.allowedCategories;
        if (schedule.blockedCategories !== undefined) payload.blocked_categories = schedule.blockedCategories;
        if (schedule.isActive !== undefined) payload.is_active = schedule.isActive;

        console.log(`[ParentChildService] Updating schedule ${scheduleId} for child ${childId}:`, JSON.stringify(payload, null, 2));

        return apiService.put<ApiResponse>(`/parent-child/${childId}/schedules/${scheduleId}`, payload);
    },

    /**
     * Toggle schedule active status
     */
    async toggleChildScheduleStatus(childId: string, scheduleId: string, isActive: boolean): Promise<ApiResponse> {
        return apiService.patch<ApiResponse>(`/parent-child/${childId}/schedules/${scheduleId}/status`, { is_active: isActive });
    },

    /**
     * Delete a schedule
     */
    async deleteChildSchedule(childId: string, scheduleId: string): Promise<ApiResponse> {
        return apiService.delete<ApiResponse>(`/parent-child/${childId}/schedules/${scheduleId}`);
    },

    /**
     * Fetch daily usage stats
     */
    async getChildUsageStats(childId: string): Promise<{ totalUsage: number, limit: number }> {
        try {
            const res: any = await apiService.get(`/parent-child/${childId}/usage-stats`);
            return res.success && res.stats ? res.stats : { totalUsage: 0, limit: 120 };
        } catch (error) {
            console.warn('[ParentChildService] Usage stats not found or error, using default:', error);
            return { totalUsage: 0, limit: 120 };
        }
    },

    async getChildUsageReport(childId: string): Promise<any[]> {
        try {
            const res: any = await apiService.get(`/reports/usage/${childId}`);
            return res.report;
        } catch (error) {
            console.error('[ParentChildService] Failed to get usage report:', error);
            return [];
        }
    },

    /**
     * 자녀 접근 제한 설정 (부모 전용)
     */
    async updateChildRestriction(childId: string, restrict: boolean): Promise<ApiResponse> {
        return apiService.patch<ApiResponse>('/users/restriction', { childId, restrict });
    },

    /**
     * 자녀 PIN 초기화 (부모 전용)
     */
    async resetChildPin(childId: string): Promise<ApiResponse> {
        return apiService.post<ApiResponse>('/users/reset-pin', { childId });
    }
};
