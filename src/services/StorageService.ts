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

export const StorageService = {
    async getSchedules(): Promise<Schedule[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(SCHEDULES_KEY);
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
    }
};
