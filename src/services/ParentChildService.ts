import { apiService, ApiResponse } from './ApiService';

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
            // Return mock data for demo if API fails
            return [
                { id: 'child-1', childName: '김철수', deviceName: 'iPhone 13', status: 'LOCKED', lastSeenAt: new Date().toISOString(), hasPermission: true },
                { id: 'child-2', childName: '이영희', deviceName: 'Galaxy S22', status: 'UNLOCKED', lastSeenAt: new Date().toISOString(), hasPermission: false }
            ];
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
            return [
                { id: 'parent-1', parentName: '나 (관리자)', email: 'me@example.com', isPrimary: true },
                { id: 'parent-2', parentName: '배우자', email: 'partner@example.com', isPrimary: false }
            ];
        }
    },

    /**
     * Generate a registration QR payload
     */
    async generateRegistrationQr(type: 'CHILD' | 'PARENT', name: string): Promise<string> {
        try {
            const response = await apiService.post<ApiResponse<{ payload: string }>>('/parent-child/registration-qr', { type, name });
            return response.data.payload;
        } catch (error) {
            // Mock for demo
            return JSON.stringify({
                type: type === 'CHILD' ? 'CHILD_REGISTRATION' : 'PARENT_LINK',
                issuerId: 'current-user-id',
                name,
                timestamp: Date.now()
            });
        }
    },

    /**
     * Link a child using the registration payload scanned from QR
     */
    async linkChild(registrationPayload: string): Promise<ApiResponse> {
        return apiService.post<ApiResponse>('/parent-child/link', { payload: registrationPayload });
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
            const response = await apiService.get<{ success: boolean; schedules: any[] }>(`/parent-child/${childId}/schedules`);
            return response.success ? response.schedules : [];
        } catch (error) {
            console.error('[ParentChildService] Failed to fetch child schedules:', error);
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
        const payload = {
            name: schedule.name,
            start_time: schedule.startTime,
            end_time: schedule.endTime,
            days: schedule.days,
            lock_type: schedule.lockType === 'APP' ? 'APP_ONLY' : schedule.lockType,
            allowed_apps: schedule.allowedApps || [],
            blocked_apps: schedule.blockedApps || [],
            allowed_categories: schedule.allowedCategories || [],
            blocked_categories: schedule.blockedCategories || [],
            is_active: schedule.isActive
        };
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
        if (schedule.endTime !== undefined) payload.end_time = schedule.endTime;
        if (schedule.days !== undefined) payload.days = schedule.days;
        if (schedule.lockType !== undefined) payload.lock_type = schedule.lockType === 'APP' ? 'APP_ONLY' : schedule.lockType;
        if (schedule.allowedApps !== undefined) payload.allowed_apps = schedule.allowedApps;
        if (schedule.blockedApps !== undefined) payload.blocked_apps = schedule.blockedApps;
        if (schedule.allowedCategories !== undefined) payload.allowed_categories = schedule.allowedCategories;
        if (schedule.blockedCategories !== undefined) payload.blocked_categories = schedule.blockedCategories;
        if (schedule.isActive !== undefined) payload.is_active = schedule.isActive;

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
     * Fetch daily usage stats (Mocked for now)
     */
    async getChildUsageStats(childId: string): Promise<{ totalUsage: number; limit: number }> {
        // TODO: Implement real API call
        // return apiService.get(...)

        // Mock data
        return {
            totalUsage: 135, // 2h 15m
            limit: 180      // 3h
        };
    }
};
