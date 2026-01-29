import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Schedule {
    id: string;
    name: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    days: string[];
    lockType: string;
    allowedApp?: {
        label: string;
        packageName: string;
    };
    isActive: boolean;
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
    }
};
