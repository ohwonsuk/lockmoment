import { NativeModules, Platform } from 'react-native';

const { LockControl } = NativeModules;
console.log("Native LockControl loaded:", !!LockControl);

export interface LockControlInterface {
    checkAccessibilityPermission(): Promise<boolean>;
    requestAuthorization(): Promise<boolean>;
    checkAuthorization(): Promise<number>;
    startLock(durationMs: number, type: string, name: string, packagesJson?: string, preventAppRemoval?: boolean): Promise<boolean>;
    stopLock(): Promise<boolean>;
    isLocked(): Promise<boolean>;
    getRemainingTime(): Promise<number>;
    getInstalledApps(): Promise<{ label: string, packageName: string, icon?: string }[]>;
    presentFamilyActivityPicker(type?: string): Promise<boolean | number>;
    getSelectedAppCount(): Promise<number>;
    scheduleAlarm(scheduleId: string, startTime: string, endTime: string, days: string[], lockType: string, name: string, allowedPackage?: string, preventAppRemoval?: boolean): Promise<boolean>;
    cancelAlarm(scheduleId: string): Promise<boolean>;
    restoreLockState(): Promise<boolean>;
    openDefaultDialer(): Promise<boolean>;
    openDefaultMessages(): Promise<boolean>;
    openNotificationSettings(): Promise<boolean>;
    requestNotificationPermission(): Promise<boolean>;
    getNativeHistory(): Promise<string>;
    checkDeviceAdminActive(): Promise<boolean>;
    requestDeviceAdmin(): Promise<boolean>;
}

const defaultLockControl: LockControlInterface = {
    checkAccessibilityPermission: async () => false,
    requestAuthorization: async () => false,
    checkAuthorization: async () => 0,
    startLock: async () => false,
    stopLock: async () => false,
    isLocked: async () => false,
    getRemainingTime: async () => 0,
    getInstalledApps: async () => [],
    presentFamilyActivityPicker: async () => false,
    getSelectedAppCount: async () => 0,
    scheduleAlarm: async () => false,
    cancelAlarm: async () => false,
    restoreLockState: async () => false,
    openDefaultDialer: async () => false,
    openDefaultMessages: async () => false,
    openNotificationSettings: async () => false,
    requestNotificationPermission: async () => false,
    getNativeHistory: async () => "[]",
    checkDeviceAdminActive: async () => false,
    requestDeviceAdmin: async () => false,
};

export const NativeLockControl: LockControlInterface = LockControl || defaultLockControl;
