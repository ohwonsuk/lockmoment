import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEDULES_KEY = '@lockmoment_schedules';

export interface Schedule {
    id: string;
    name: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    days: string[];
    strictMode: boolean;
    allowedApp?: {
        label: string;
        packageName: string;
    };
    isActive: boolean;
}

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
    }
};
