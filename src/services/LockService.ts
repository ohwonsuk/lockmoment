import { StorageService, Schedule } from './StorageService';
import { ParentChildService } from './ParentChildService';
import { NativeLockControl } from './NativeLockControl';
import { apiService } from './ApiService';
import DeviceInfo from 'react-native-device-info';

export const LockService = {
    /**
     * Sync server-side schedules to local device alarms
     */
    async syncSchedules(): Promise<void> {
        try {
            const role = await StorageService.getUserRole();
            const profile = await StorageService.getUserProfile();

            // 1. Load Local
            const local = await StorageService.getSchedules();

            // 2. Load Remote (if linked)
            let combined = [...local];
            if (profile && profile.id) {
                const remote = await ParentChildService.getChildSchedules(profile.id);
                remote.forEach(rs => {
                    const mapped: Schedule = {
                        ...rs,
                        isReadOnly: rs.createdBy !== profile.id,
                        source: 'SERVER'
                    } as any;

                    const existingIdx = combined.findIndex(ex => ex.id === mapped.id);
                    if (existingIdx > -1) {
                        combined[existingIdx] = mapped;
                    } else {
                        combined.push(mapped);
                    }
                });
            }

            // 3. Update Alarms/ManagedSettings
            const preventRemoval = await StorageService.getPreventAppRemoval();
            const notifSettings = await StorageService.getNotificationSettings();

            // Clear all current alarms first (optional, or just update)
            // For safety, we can cancel all and reschedule, or native side handles it.
            // Native LockControl.scheduleAlarm usually overwrites by ID.

            for (const schedule of combined) {
                if (schedule.isActive) {
                    let normalizedType = (schedule.lockType || 'APP').toUpperCase();
                    if (normalizedType === 'PHONE') normalizedType = 'FULL';

                    await NativeLockControl.scheduleAlarm(
                        schedule.id,
                        schedule.startTime,
                        schedule.endTime,
                        schedule.days,
                        normalizedType as any,
                        schedule.name,
                        JSON.stringify(schedule.lockedApps || []),
                        preventRemoval,
                        notifSettings.preLockMinutes
                    );
                    console.log(`[LockService] Scheduled: ${schedule.name} (${schedule.startTime}-${schedule.endTime})`);
                } else {
                    await NativeLockControl.cancelAlarm(schedule.id);
                }
            }

            // 4. Force state restoration
            // This tells the native side to re-evaluate if it should be locked RIGHT NOW
            // based on the updated schedules and their time windows.
            await NativeLockControl.restoreLockState();
            console.log("[LockService] Sync completed and state restoration requested.");
        } catch (error) {
            console.error("[LockService] Sync failed:", error);
        }
    },

    /**
     * Report lock start to server (for parent monitoring)
     */
    async reportLockStart(params: {
        lockName: string;
        lockType: 'FULL' | 'APP';
        durationMinutes: number;
        source?: 'MANUAL' | 'SCHEDULED' | 'QR' | 'PRESET';
        lockedApps?: string[];
        preventAppRemoval?: boolean;
    }): Promise<void> {
        try {
            const profile = await StorageService.getUserProfile();
            const deviceId = await DeviceInfo.getUniqueId();

            await apiService.post('/locks/start', {
                device_id: deviceId,
                lock_name: params.lockName,
                lock_type: params.lockType,
                duration_minutes: params.durationMinutes,
                source: params.source || 'MANUAL',
                blocked_apps: params.lockedApps || [],
                prevent_app_removal: params.preventAppRemoval || false
            });

            console.log('[LockService] Lock start reported to server');
        } catch (error) {
            console.error('[LockService] Failed to report lock start:', error);
            // Don't throw - local lock should still work even if server sync fails
        }
    },

    /**
     * Report lock stop to server
     */
    async reportLockStop(): Promise<void> {
        try {
            await apiService.post('/locks/stop', {});
            console.log('[LockService] Lock stop reported to server');
        } catch (error) {
            console.error('[LockService] Failed to report lock stop:', error);
            // Don't throw - local unlock should still work
        }
    }
};
