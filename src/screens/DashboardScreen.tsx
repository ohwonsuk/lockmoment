import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { QuickLockCard } from '../components/QuickLockCard';
import { Typography } from '../components/Typography';
import { NativeLockControl } from '../services/NativeLockControl';
import { apiService } from '../services/ApiService';
import { useAppNavigation } from '../navigation/NavigationContext';
import { QuickLockPicker } from '../components/QuickLockPicker';
import { Icon } from '../components/Icon';
import { StorageService, Schedule } from '../services/StorageService';
import { useAlert } from '../context/AlertContext';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { AuthService } from '../services/AuthService';
import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { PresetService, Preset } from '../services/PresetService';
import { PresetItem } from '../components/PresetItem';
import DeviceInfo from 'react-native-device-info';
import { FamilyLockList } from '../components/FamilyLockList';
import { LockService } from '../services/LockService';

export const DashboardScreen: React.FC = () => {
    const { navigate, currentScreen } = useAppNavigation();
    const { showAlert } = useAlert();
    const [isLocked, setIsLocked] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [endTimeDate, setEndTimeDate] = useState<Date | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [userRole, setUserRole] = useState<string>('STUDENT');
    const [viewMode, setViewMode] = useState<'PERSONAL' | 'ADMIN'>('PERSONAL');
    const [recommendedPresets, setRecommendedPresets] = useState<Preset[]>([]);
    const [isApplyingPreset, setIsApplyingPreset] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        loadUserRole();
    }, []);

    useEffect(() => {
        if (currentScreen === 'Dashboard') {
            refreshAll();
        }
    }, [currentScreen]);

    useEffect(() => {
        refreshAll();
        restoreLock();
        timerRef.current = setInterval(updateStatus, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [userRole]);

    const loadUserRole = async () => {
        const role = await StorageService.getUserRole();
        if (role) {
            setUserRole(role);
            // If parent/teacher, they might want to see Admin by default or after switching
            if (role === 'PARENT' || role === 'TEACHER') {
                // setViewMode('ADMIN'); // Optional: decide default
            }
        }
        checkTabletMode(role);
    };

    const checkTabletMode = (role: string | null) => {
        const isTablet = DeviceInfo.isTablet();
        if (isTablet && (role === 'TEACHER' || role === 'ADMIN')) {
            showAlert({
                title: "태블릿 감지됨",
                message: "출석 관리 키오스크 모드로 전환하시겠습니까?",
                confirmText: "전환",
                cancelText: "나중에",
                onConfirm: () => navigate('TabletKiosk' as any)
            });
        }
    };

    const updateStatus = async () => {
        try {
            const locked = await NativeLockControl.isLocked();
            setIsLocked(locked);
            if (locked) {
                const remaining = await NativeLockControl.getRemainingTime();
                setRemainingTime(remaining);
                setEndTimeDate(new Date(Date.now() + remaining));

                // If natively locked, ensure server knows about it (for monitoring/history)
                // This handles scheduled locks that started while app was closed
                if (remaining > 0) {
                    // Check local cache/ref to avoid repeated API calls
                    const lastReported = (globalThis as any).lastLockReportTime || 0;
                    if (Date.now() - lastReported > 60000) { // Check every 1 minute
                        // Try to fetch current lock from server to see if we need to report
                        try {
                            const res: any = await apiService.get('/locks/status');
                            if (!res.isLocked) {
                                // Server thinks we are unlocked, let's report back the current state
                                await LockService.reportLockStart({
                                    lockName: "예약 잠금", // Fallback name
                                    lockType: 'APP', // Default
                                    durationMinutes: Math.ceil(remaining / 60000),
                                    source: 'SCHEDULED'
                                });
                            }
                        } catch (e) { /* server might not have /locks/status yet, ignore for now */ }
                        (globalThis as any).lastLockReportTime = Date.now();
                    }
                }

                if (remaining <= 0) {
                    await NativeLockControl.stopLock();
                    setIsLocked(false);
                }
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const refreshAll = () => {
        checkPermission();
        syncAndLoadSchedules();
        updateStatus();
        if (userRole === 'PARENT' || userRole === 'TEACHER') {
            loadChildren();
            loadPresets();
        } else if (Platform.OS === 'ios') {
            checkAppLockSelection();
        }
    };

    const checkAppLockSelection = async () => {
        try {
            console.log('[Dashboard] Checking app selection methods:', {
                hasGetApp: typeof NativeLockControl.getSelectedAppCount === 'function',
                hasGetCat: typeof NativeLockControl.getSelectedCategoryCount === 'function'
            });

            if (typeof NativeLockControl.getSelectedCategoryCount !== 'function') {
                console.warn('[Dashboard] getSelectedCategoryCount is not a function. Skipping check.');
                return;
            }

            const [aCount, cCount] = await Promise.all([
                NativeLockControl.getSelectedAppCount(),
                NativeLockControl.getSelectedCategoryCount()
            ]);
            if (aCount === 0 && cCount === 0) {
                // Mandatory selection for iOS
                navigate('AppLockSettings');
            }
        } catch (e) {
            console.error('[Dashboard] Failed to check app selection:', e);
        }
    };

    const syncAndLoadSchedules = async () => {
        await LockService.syncSchedules();
        loadSchedules();
    };

    const loadPresets = async () => {
        const presets = await PresetService.getRecommendedPresets();
        setRecommendedPresets(presets);
    };

    const loadChildren = async () => {
        const data = await ParentChildService.getLinkedChildren();
        setChildren(data);
    };

    const restoreLock = async () => {
        try {
            await NativeLockControl.restoreLockState();
            updateStatus();
        } catch (error) {
            console.error('Failed to restore lock state:', error);
        }
    };

    const loadSchedules = async () => {
        // Load local (which is synced by LockService for children)
        const storedSchedules = await StorageService.getSchedules();
        setSchedules(storedSchedules);
    };

    const checkPermission = async () => {
        if (Platform.OS === 'android') {
            const perm = await NativeLockControl.checkAccessibilityPermission();
            setHasPermission(perm);
            AuthService.syncPermissions({ accessibility: perm });
        } else {
            const authStatus = await NativeLockControl.checkAuthorization();
            setHasPermission(authStatus === 2);
            AuthService.syncPermissions({ screenTime: authStatus === 2 });
        }
    };

    const handleQuickLock = async () => {
        if (!hasPermission) {
            navigate('Permissions');
            return;
        }
        navigate('QRGenerator', { type: 'INSTANT', isPersonal: true });
    };

    const handleQuickLockConfirm = async (h: number, m: number, type: 'APP' | 'FULL', packagesJson?: string) => {
        setIsPickerVisible(false);
        try {
            const prevent = await StorageService.getPreventAppRemoval();
            const durationMs = (h * 3600 + m * 60) * 1000;
            await NativeLockControl.startLock(durationMs, type, "바로 잠금", packagesJson, prevent);

            // Report to server for parent monitoring
            await LockService.reportLockStart({
                lockName: "바로 잠금",
                lockType: type,
                durationMinutes: h * 60 + m,
                source: 'MANUAL',
                preventAppRemoval: prevent
            });

            updateStatus();
        } catch (error: any) {
            showAlert({ title: "오류", message: error.message });
        }
    };

    const handleStopLock = async () => {
        showAlert({
            title: "잠금 조기 종료",
            message: "관리자 권한으로 잠금을 종료하시겠습니까? (현재 진행 중인 예약 잠금은 비활성화됩니다)",
            confirmText: "종료",
            cancelText: "취소",
            onConfirm: async () => {
                try {
                    // 1. 네이티브단에서 현재 활성화된 모든 정책(UserDefaults)을 찾아서 제거
                    // JS 사이드에서 시간 계산의 오차나 누락된 스케줄이 있을 수 있으므로 네이티브 스캔이 가장 확실함
                    const stoppedIds = await NativeLockControl.stopActiveSchedules();
                    console.log(`[Dashboard] Native stop active schedules result:`, stoppedIds);

                    if (stoppedIds && stoppedIds.length > 0) {
                        // 2. 중단된 스케줄들에 대해 로컬 상태(AsyncStorage) 업데이트
                        const currentSchedules = await StorageService.getSchedules();
                        const updated = currentSchedules.map(s => {
                            if (stoppedIds.includes(s.id)) {
                                return { ...s, isActive: false };
                            }
                            return s;
                        });
                        await StorageService.overwriteSchedules(updated);
                        setSchedules(updated);
                    }

                    // 3. 수동/타이머 잠금 강제 종료 및 상태 보고
                    await NativeLockControl.stopLock();
                    await LockService.reportLockStop();
                    updateStatus();
                } catch (error: any) {
                    console.error('Failed to stop lock:', error);
                    showAlert({ title: "오류", message: "잠금 종료 중 오류가 발생했습니다." });
                }
            }
        });
    };

    const handleToggleSchedule = async (id: string) => {
        const schedule = schedules.find(s => s.id === id);
        if (schedule) {
            if (schedule.isActive) {
                await NativeLockControl.cancelAlarm(id);
            } else {
                const prevent = await StorageService.getPreventAppRemoval();
                let normalizedType = (schedule.lockType || 'APP').toUpperCase();
                if (normalizedType === 'PHONE') normalizedType = 'FULL';
                if (normalizedType === 'APP_ONLY') normalizedType = 'APP';

                await NativeLockControl.scheduleAlarm(
                    id, schedule.startTime, schedule.endTime, schedule.days,
                    normalizedType as any, schedule.name,
                    JSON.stringify(schedule.lockedApps || []), prevent
                );
            }
            await StorageService.toggleScheduleActivity(id);
            loadSchedules();
        }
    };

    const handleGenerateScheduleQR = (id: string) => {
        const s = schedules.find(x => x.id === id);
        if (s) {
            navigate('QRGenerator', {
                type: 'SCHEDULED',
                title: s.name,
                apps: s.lockedApps,
                isPersonal: true
            });
        }
    };

    const handleApplyPreset = async (preset: Preset) => {
        if (children.length === 0) {
            showAlert({ title: "알림", message: "잠금을 적용할 연결된 자녀가 없습니다." });
            return;
        }

        showAlert({
            title: "Preset 즉시 적용",
            message: `[${preset.name}] 정책을 모든 자녀에게 즉시 적용하시겠습니까?`,
            confirmText: "적용",
            cancelText: "취소",
            onConfirm: async () => {
                setIsApplyingPreset(true);
                try {
                    let successCount = 0;
                    for (const child of children) {
                        const res = await PresetService.applyPreset(preset.id, {
                            target_type: 'STUDENT',
                            target_id: child.id,
                        });
                        if (res.success) successCount++;
                    }
                    showAlert({
                        title: "적용 완료",
                        message: `${successCount}명의 자녀에게 [${preset.name}] 정책이 적용되었습니다.`
                    });
                } catch (error) {
                    console.error("Apply Preset Failed:", error);
                    showAlert({ title: "오류", message: "Preset 적용 중 오류가 발생했습니다." });
                } finally {
                    setIsApplyingPreset(false);
                }
            }
        });
    };

    const formatTime = (ms: number) => {
        const totalSec = Math.ceil(ms / 1000);
        const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const handleManageChild = (childId: string) => {
        // Navigate to Children tab with specific child selected
        // For now, just navigate to Children tab
        navigate('Children' as any, { initialChildId: childId });
    }


    const renderUnifiedDashboard = () => (
        <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* 1. Personal Lock Section (Always Visible) */}
            <View style={styles.sectionHeader}>
                <Typography variant="h2" bold>내 잠금</Typography>
            </View>

            {isLocked ? (
                <View style={styles.activeLockCard}>
                    <View style={styles.activeLockHeader}>
                        <View style={styles.statusBadge}>
                            <View style={styles.statusDot} />
                            <Typography variant="caption" bold color={Colors.primary}>집중 모드 동작 중</Typography>
                        </View>
                        <TouchableOpacity onPress={handleStopLock}>
                            <Typography variant="caption" color={Colors.textSecondary}>종료</Typography>
                        </TouchableOpacity>
                    </View>
                    <Typography style={styles.remainingTimeText}>{formatTime(remainingTime)}</Typography>
                    {endTimeDate && (
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: -10, marginBottom: 30 }}>
                            종료예정 {endTimeDate.getHours()}:{endTimeDate.getMinutes().toString().padStart(2, '0')}
                        </Typography>
                    )}
                </View>
            ) : (
                <View style={styles.mainActions}>
                    <TouchableOpacity style={[styles.mainActionButton, { backgroundColor: Colors.primary }]} onPress={handleQuickLock}>
                        <Icon name="lock-closed" size={32} color="#FFF" />
                        <Typography variant="h2" bold color="#FFF" style={{ marginTop: 12 }}>바로 잠금</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mainActionButton, { backgroundColor: Colors.card }]} onPress={() => navigate('QRGenerator', { type: 'SCHEDULED', isPersonal: true })}>
                        <View style={[styles.iconBadge, { backgroundColor: '#EC489915' }]}>
                            <Icon name="calendar" size={28} color="#EC4899" />
                        </View>
                        <Typography variant="h2" bold style={{ marginTop: 12 }}>예약 잠금</Typography>
                    </TouchableOpacity>
                </View>
            )}

            <View style={{ height: 24 }} />

            {/* 2. Family Lock Section (Visible for Parents) */}
            {(userRole === 'PARENT' && children.length > 0) && (
                <FamilyLockList children={children} onManage={handleManageChild} />
            )}

            {/* 3. Legacy Schedule List (Optional) */}
            <View style={styles.sectionHeader}>
                <Typography variant="h2" bold>내 예약 스케줄</Typography>
                {(userRole === 'PARENT' || userRole === 'TEACHER') && (
                    <TouchableOpacity onPress={() => navigate('QRGenerator', { type: 'SCHEDULED', isPersonal: true })}>
                        <Typography color={Colors.primary} bold>추가</Typography>
                    </TouchableOpacity>
                )}
            </View>
            <WeeklySchedule
                schedules={schedules}
                onPressItem={(id) => {
                    const s = schedules.find(x => x.id === id);
                    if (s) {
                        navigate('QRGenerator', {
                            type: 'SCHEDULED',
                            title: s.name,
                            apps: s.lockedApps,
                            isPersonal: true
                        });
                    }
                }}
                onToggle={handleToggleSchedule}
                onGenerateQR={handleGenerateScheduleQR}
            />

            <View style={styles.footer} />
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            <Header hasPermission={hasPermission} title="잠금" />
            {renderUnifiedDashboard()}

            <QuickLockPicker
                isVisible={isPickerVisible}
                onClose={() => setIsPickerVisible(false)}
                onConfirm={handleQuickLockConfirm}
            />
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    flex1: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    activeLockCard: {
        backgroundColor: Colors.card,
        marginHorizontal: 20,
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
        alignItems: 'center',
    },
    activeLockHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        marginBottom: 20,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
    },
    remainingTimeText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 30,
        marginBottom: 10,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    addButtonText: {
        fontSize: 14,
    },
    inlineAddButton: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: Colors.primary + '15',
        borderRadius: 8,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    footer: {
        marginTop: 40,
        marginBottom: 20,
        alignItems: 'center',
    },
    qrActions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginTop: 12,
    },
    qrActionButton: {
        flex: 1,
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 8,
    },
    qrIconBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainActions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginTop: 10,
    },
    mainActionButton: {
        flex: 1,
        height: 140, // Adjust height as needed
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    iconBadge: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
