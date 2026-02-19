import { NativeModules, Platform } from 'react-native';

const { LockControl } = NativeModules;
console.log("Native LockControl loaded:", !!LockControl);

export type LockType = 'FULL' | 'APP';

export interface LockControlInterface {
    checkAccessibilityPermission(): Promise<boolean>;
    requestAuthorization(): Promise<boolean>;
    checkAuthorization(): Promise<number>;
    /**
     * @param durationMs 잠금 지속 시간 (ms)
     * @param lockType 'FULL' (전체 잠금) | 'APP' (앱 선택 잠금)
     * @param name 잠금 명칭 (UI 표시용)
     * @param packagesJson Android: 차단/허용 패키지 목록(JSON), iOS: 선택 데이터(Token)와 연동됨
     * @param preventAppRemoval 앱 삭제 방지 활성화 여부
     */
    startLock(durationMs: number, lockType: LockType, name: string, packagesJson?: string, preventAppRemoval?: boolean): Promise<boolean>;
    stopLock(): Promise<boolean>;
    isLocked(): Promise<boolean>;
    getRemainingTime(): Promise<number>;
    getInstalledApps(): Promise<{ label: string, packageName: string, icon?: string }[]>;
    presentFamilyActivityPicker(lockType?: LockType): Promise<boolean | number>;
    getSelectedAppCount(): Promise<number>;
    getSelectedCategoryCount(): Promise<number>;
    scheduleAlarm(
        scheduleId: string,
        startTime: string,
        endTime: string,
        days: string[],
        lockType: LockType,
        name: string,
        packagesJson?: string,
        preventAppRemoval?: boolean,
        preLockMinutes?: number
    ): Promise<boolean>;
    cancelAlarm(scheduleId: string): Promise<boolean>;
    /**
     * 현재 실행 중인 모든 예약 스케줄을 찾아서 중단하고 정책을 삭제합니다.
     * @returns 중지된 스케줄 ID 배열
     */
    stopActiveSchedules(): Promise<string[]>;
    restoreLockState(): Promise<boolean>;
    openDefaultDialer(): Promise<boolean>;
    openDefaultMessages(): Promise<boolean>;
    openNotificationSettings(): Promise<boolean>;
    requestNotificationPermission(): Promise<boolean>;
    getNativeHistory(): Promise<string>;
    checkDeviceAdminActive(): Promise<boolean>;
    requestDeviceAdmin(): Promise<boolean>;
    setPreventAppRemoval(enabled: boolean): Promise<boolean>;
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
    getSelectedCategoryCount: async () => 0,
    scheduleAlarm: async () => false,
    cancelAlarm: async () => false,
    stopActiveSchedules: async () => [],
    restoreLockState: async () => false,
    openDefaultDialer: async () => false,
    openDefaultMessages: async () => false,
    openNotificationSettings: async () => false,
    requestNotificationPermission: async () => false,
    getNativeHistory: async () => "[]",
    checkDeviceAdminActive: async () => false,
    requestDeviceAdmin: async () => false,
    setPreventAppRemoval: async () => false,
};

export const NativeLockControl: LockControlInterface = LockControl || defaultLockControl;
