import { NativeModules, Platform } from 'react-native';

const { LockControl } = NativeModules;
console.log("Native LockControl loaded:", !!LockControl);

export interface LockControlInterface {
    checkAccessibilityPermission(): Promise<boolean>;
    requestAuthorization(): Promise<boolean>;
    checkAuthorization(): Promise<number>;
    startLock(durationMs: number, type: string): Promise<boolean>;
    stopLock(): Promise<boolean>;
    isLocked(): Promise<boolean>;
    getRemainingTime(): Promise<number>;
    presentFamilyActivityPicker(): Promise<boolean>;
}

const defaultLockControl: LockControlInterface = {
    checkAccessibilityPermission: async () => false,
    requestAuthorization: async () => false,
    checkAuthorization: async () => 0,
    startLock: async () => false,
    stopLock: async () => false,
    isLocked: async () => false,
    getRemainingTime: async () => 0,
    presentFamilyActivityPicker: async () => false,
};

export const NativeLockControl: LockControlInterface = LockControl || defaultLockControl;
