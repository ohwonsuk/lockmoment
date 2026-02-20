import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Schedule {
    id: string;
    name: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    days: string[];
    lockType: string;
    lockedApps?: string[];
    isActive: boolean;
    isReadOnly?: boolean;
    createdBy?: string;
    source?: 'LOCAL' | 'SERVER';
}

export interface HistoryItem {
    id: string;
    date: string;
    name: string;
    duration: string;
    status: '완료' | '중단';
}

const SCHEDULES_KEY = '@lockmoment_schedules';
const HISTORY_KEY = '@lockmoment_history';
const PARENT_QR_HISTORY_KEY = '@lockmoment_parent_qr_history';

export interface ParentLockHistory {
    id: string;
    date: number;
    name: string;
    duration: number;
    lockMethod: 'FULL' | 'CATEGORY' | 'APP';
    selectedApps: string[];
    selectedCategories: string[];
    qrType: 'INSTANT' | 'SCHEDULED';
    platform: 'IOS' | 'ANDROID' | 'UNKNOWN';
}

export const StorageService = {
    async getItem(key: string): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },

    async setItem(key: string, value: string): Promise<void> {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (e) {
            console.error(`Failed to save item ${key}`, e);
        }
    },

    async getSchedules(): Promise<Schedule[]> {
        try {
            const jsonValue = await this.getItem(SCHEDULES_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Failed to fetch schedules', e);
            return [];
        }
    },

    async saveSchedule(schedule: Schedule): Promise<void> {
        try {
            const schedules = await this.getSchedules();
            const index = schedules.findIndex(s => s.id === schedule.id);

            if (index > -1) {
                schedules[index] = schedule;
            } else {
                schedules.push(schedule);
            }

            await AsyncStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
        } catch (e) {
            console.error('Failed to save schedule', e);
        }
    },

    async overwriteSchedules(schedules: Schedule[]): Promise<void> {
        try {
            await AsyncStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
        } catch (e) {
            console.error('Failed to overwrite schedules', e);
        }
    },

    async deleteSchedule(id: string): Promise<void> {
        try {
            const schedules = await this.getSchedules();
            const filtered = schedules.filter(s => s.id !== id);
            await AsyncStorage.setItem(SCHEDULES_KEY, JSON.stringify(filtered));
        } catch (e) {
            console.error('Failed to delete schedule', e);
        }
    },

    async toggleScheduleActivity(id: string): Promise<void> {
        try {
            const schedules = await this.getSchedules();
            const index = schedules.findIndex(s => s.id === id);
            if (index > -1) {
                schedules[index].isActive = !schedules[index].isActive;
                await AsyncStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
            }
        } catch (e) {
            console.error('Failed to toggle schedule', e);
        }
    },

    async getHistory(): Promise<HistoryItem[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(HISTORY_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Failed to fetch history', e);
            return [];
        }
    },

    async addHistory(item: HistoryItem): Promise<void> {
        try {
            const history = await this.getHistory();
            history.unshift(item); // Add to beginning
            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); // Keep last 50
        } catch (e) {
            console.error('Failed to save history', e);
        }
    },

    async getPreventAppRemoval(): Promise<boolean> {
        try {
            const val = await AsyncStorage.getItem('@lockmoment_prevent_removal');
            return val === 'true';
        } catch (e) {
            return false;
        }
    },

    async setPreventAppRemoval(prevent: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem('@lockmoment_prevent_removal', prevent ? 'true' : 'false');
        } catch (e) {
            console.error('Failed to save removal setting', e);
        }
    },

    async getNotificationSettings(): Promise<{ enabled: boolean; preLockEnabled: boolean; preLockMinutes: number }> {
        try {
            const val = await AsyncStorage.getItem('@lockmoment_notification_settings');
            if (val) {
                return JSON.parse(val);
            }
            return { enabled: true, preLockEnabled: true, preLockMinutes: 10 };
        } catch (e) {
            return { enabled: true, preLockEnabled: true, preLockMinutes: 10 };
        }
    },

    async setNotificationSettings(settings: { enabled: boolean; preLockEnabled: boolean; preLockMinutes: number }): Promise<void> {
        try {
            await AsyncStorage.setItem('@lockmoment_notification_settings', JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save notification settings', e);
        }
    },

    // Auth Token Management
    async getAccessToken(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem('@lockmoment_access_token');
        } catch (e) {
            return null;
        }
    },

    async setAccessToken(token: string | null): Promise<void> {
        try {
            if (token === null) {
                await AsyncStorage.removeItem('@lockmoment_access_token');
            } else {
                await AsyncStorage.setItem('@lockmoment_access_token', token);
            }
        } catch (e) {
            console.error('Failed to save access token', e);
        }
    },

    async getRefreshToken(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem('@lockmoment_refresh_token');
        } catch (e) {
            return null;
        }
    },

    async setRefreshToken(token: string | null): Promise<void> {
        try {
            if (token === null) {
                await AsyncStorage.removeItem('@lockmoment_refresh_token');
            } else {
                await AsyncStorage.setItem('@lockmoment_refresh_token', token);
            }
        } catch (e) {
            console.error('Failed to save refresh token', e);
        }
    },

    async clearTokens(): Promise<void> {
        try {
            await AsyncStorage.multiRemove(['@lockmoment_access_token', '@lockmoment_refresh_token', '@lockmoment_user_role']);
        } catch (e) {
            console.error('Failed to clear tokens', e);
        }
    },

    // User Role Management
    async getUserRole(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem('@lockmoment_user_role');
        } catch (e) {
            return null;
        }
    },

    async setUserRole(role: string | null): Promise<void> {
        try {
            if (role === null) {
                await AsyncStorage.removeItem('@lockmoment_user_role');
            } else {
                await AsyncStorage.setItem('@lockmoment_user_role', role);
            }
        } catch (e) {
            console.error('Failed to save user role', e);
        }
    },

    async hasGuidedPermissions(): Promise<boolean> {
        try {
            const val = await AsyncStorage.getItem('@lockmoment_permissions_guided');
            return val === 'true';
        } catch (e) {
            return false;
        }
    },

    async setGuidedPermissions(): Promise<void> {
        try {
            await AsyncStorage.setItem('@lockmoment_permissions_guided', 'true');
        } catch (e) {
            console.error('Failed to save permissions guided flag', e);
        }
    },

    async getUserProfile(): Promise<any | null> {
        try {
            const data = await AsyncStorage.getItem('@lockmoment_user_profile');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    async setUserProfile(profile: any): Promise<void> {
        try {
            if (profile) {
                await AsyncStorage.setItem('@lockmoment_user_profile', JSON.stringify(profile));
            } else {
                await AsyncStorage.removeItem('@lockmoment_user_profile');
            }
        } catch (e) {
            console.error('Failed to save user profile', e);
        }
    },

    // Personal Presets
    async getPersonalPresets(): Promise<any[]> {
        try {
            const val = await AsyncStorage.getItem('@lockmoment_personal_presets');
            return val ? JSON.parse(val) : [];
        } catch (e) {
            return [];
        }
    },

    async savePersonalPresets(presets: any[]): Promise<void> {
        try {
            await AsyncStorage.setItem('@lockmoment_personal_presets', JSON.stringify(presets));
        } catch (e) {
            console.error('Failed to save personal presets', e);
        }
    },

    // PIN and Restriction (260219 추가)
    async getHasPin(): Promise<boolean> {
        try {
            const val = await AsyncStorage.getItem('@lockmoment_has_pin');
            return val === 'true';
        } catch (e) {
            return false;
        }
    },

    async setHasPin(hasPin: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem('@lockmoment_has_pin', hasPin ? 'true' : 'false');
        } catch (e) {
            console.error('Failed to save hasPin flag', e);
        }
    },

    async isMyInfoRestricted(): Promise<boolean> {
        try {
            const val = await AsyncStorage.getItem('@lockmoment_myinfo_restricted');
            return val === 'true';
        } catch (e) {
            return false;
        }
    },

    async setMyInfoRestricted(restricted: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem('@lockmoment_myinfo_restricted', restricted ? 'true' : 'false');
        } catch (e) {
            console.error('Failed to save restriction flag', e);
        }
    },

    // 🔄 Context Management (260220 신규)
    async getActiveContext(): Promise<{ type: 'SELF' | 'CHILD' | 'STUDENT' | 'PARENT' | 'TEACHER' | 'ORG_ADMIN' | 'ORG_STAFF'; id?: string } | null> {
        try {
            const val = await AsyncStorage.getItem('@lockmoment_active_context');
            return val ? JSON.parse(val) : { type: 'SELF' };
        } catch (e) {
            return { type: 'SELF' };
        }
    },

    async setActiveContext(context: { type: 'SELF' | 'CHILD' | 'STUDENT' | 'PARENT' | 'TEACHER' | 'ORG_ADMIN' | 'ORG_STAFF'; id?: string }): Promise<void> {
        try {
            await AsyncStorage.setItem('@lockmoment_active_context', JSON.stringify(context));
        } catch (e) {
            console.error('Failed to save active context', e);
        }
    },

    async getParentQRHistory(): Promise<ParentLockHistory[]> {
        try {
            const val = await this.getItem(PARENT_QR_HISTORY_KEY);
            return val ? JSON.parse(val) : [];
        } catch (e) {
            return [];
        }
    },

    async saveParentQRHistory(item: Omit<ParentLockHistory, 'id' | 'date'>): Promise<void> {
        try {
            const history = await this.getParentQRHistory();
            const newItem: ParentLockHistory = {
                ...item,
                id: `hist_${Date.now()}`,
                date: Date.now()
            };

            // Limit to 50 items
            const updated = [newItem, ...history].slice(0, 50);
            await this.setItem(PARENT_QR_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save parent QR history', e);
        }
    }
};
