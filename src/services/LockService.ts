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

            // Only sync if child
            if (role !== 'CHILD' && role !== 'STUDENT') return;
            if (!profile?.id) return;

            // 1. Get current local schedules (to know what to cancel)
            const oldSchedules = await StorageService.getSchedules();

            // 2. Load Remote (Source of Truth)
            const remote = await ParentChildService.getChildSchedules(profile.id);
            const newSchedules: Schedule[] = remote.map((r: any) => ({
                id: r.id,
                name: r.name,
                startTime: r.startTime ? r.startTime.substring(0, 5) : '00:00',
                endTime: r.endTime ? r.endTime.substring(0, 5) : '00:00',
                days: r.days || [],
                lockType: r.lockType || 'FULL',
                lockedApps: r.blockedApps || [],
                isActive: r.isActive,
                source: 'SERVER',
                isReadOnly: r.createdBy !== profile.id
            }) as Schedule);

            // 3. Cancel alarms for schedules removed from server
            const newIds = new Set(newSchedules.map(s => s.id));
            for (const old of oldSchedules) {
                if (!newIds.has(old.id)) {
                    await NativeLockControl.cancelAlarm(old.id);
                    console.log(`[LockService] Cancelled removed schedule: ${old.name}`);
                }
            }

            // 4. Update alarms for new/updated schedules
            const prevent = await StorageService.getPreventAppRemoval();
            const notifSettings = await StorageService.getNotificationSettings();

            for (const schedule of newSchedules) {
                const old = oldSchedules.find(s => s.id === schedule.id);
                const hasChanged = !old ||
                    old.isActive !== schedule.isActive ||
                    old.startTime !== schedule.startTime ||
                    old.endTime !== schedule.endTime ||
                    JSON.stringify(old.days) !== JSON.stringify(schedule.days) ||
                    old.lockType !== schedule.lockType ||
                    JSON.stringify(old.lockedApps) !== JSON.stringify(schedule.lockedApps);

                if (schedule.isActive) {
                    if (hasChanged) {
                        let normalizedType = (schedule.lockType || 'APP').toUpperCase();
                        if (normalizedType === 'PHONE') normalizedType = 'FULL';
                        if (normalizedType === 'APP_ONLY') normalizedType = 'APP';

                        await NativeLockControl.scheduleAlarm(
                            schedule.id,
                            schedule.startTime,
                            schedule.endTime,
                            schedule.days,
                            normalizedType as any,
                            schedule.name,
                            JSON.stringify(schedule.lockedApps || []),
                            prevent,
                            notifSettings.preLockMinutes
                        );
                        console.log(`[LockService] Scheduled alarm: ${schedule.name}`);
                    }
                } else {
                    if (hasChanged || old === undefined) {
                        await NativeLockControl.cancelAlarm(schedule.id);
                    }
                }
            }

            // 5. Persist to Local Storage
            await StorageService.overwriteSchedules(newSchedules);

            // 6. Restore Lock State
            await NativeLockControl.restoreLockState();
            console.log("[LockService] Sync completed.");

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

            let apiLockType: string = params.lockType;
            if (apiLockType === 'APP') apiLockType = 'APP_ONLY';
            if (apiLockType === 'PHONE') apiLockType = 'FULL';

            await apiService.post('/locks/start', {
                device_id: deviceId,
                lock_name: params.lockName,
                lock_type: apiLockType,
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
