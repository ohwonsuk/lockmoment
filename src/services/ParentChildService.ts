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
            const response = await apiService.get<ApiResponse<any[]>>(`/parent-child/${childId}/schedules`);
            return response.success ? response.data : [];
        } catch (error) {
            console.error('[ParentChildService] Failed to fetch child schedules:', error);
            return [];
        }
    },

    /**
     * Save a scheduled lock for a child
     */
    async saveChildSchedule(childId: string, schedule: {
        name: string;
        startTime: string;
        endTime: string;
        days: string[];
        apps: string[];
        isActive: boolean;
    }): Promise<ApiResponse> {
        try {
            const response = await apiService.post<ApiResponse>(`/parent-child/${childId}/schedules`, schedule);
            return response;
        } catch (error) {
            console.error('[ParentChildService] Failed to save child schedule:', error);
            return { success: false, message: 'Failed to save schedule', data: null };
        }
    }
};
