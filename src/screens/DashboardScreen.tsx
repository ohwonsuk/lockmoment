import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { QuickLockCard } from '../components/QuickLockCard';
import { Typography } from '../components/Typography';
import { NativeLockControl } from '../services/NativeLockControl';
import { useAppNavigation } from '../navigation/NavigationContext';
import { QuickLockPicker } from '../components/QuickLockPicker';
import { Icon } from '../components/Icon';
import { StorageService, Schedule } from '../services/StorageService';
import { useAlert } from '../context/AlertContext';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { AuthService } from '../services/AuthService';

export const DashboardScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const { showAlert } = useAlert();
    const [isLocked, setIsLocked] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [endTimeDate, setEndTimeDate] = useState<Date | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [userRole, setUserRole] = useState<string>('STUDENT');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        loadUserRole();
        refreshAll();
        restoreLock();
        timerRef.current = setInterval(updateStatus, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const loadUserRole = async () => {
        const role = await StorageService.getUserRole();
        if (role) setUserRole(role);
    };

    const updateStatus = async () => {
        try {
            const locked = await NativeLockControl.isLocked();
            setIsLocked(locked);
            if (locked) {
                const remaining = await NativeLockControl.getRemainingTime();
                setRemainingTime(remaining);
                setEndTimeDate(new Date(Date.now() + remaining));
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
        loadSchedules();
        updateStatus();
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
        setIsPickerVisible(true);
    };

    const handleQuickLockConfirm = async (h: number, m: number, type: 'app' | 'phone', packagesJson?: string) => {
        setIsPickerVisible(false);
        try {
            const prevent = await StorageService.getPreventAppRemoval();
            const durationMs = (h * 3600 + m * 60) * 1000;
            await NativeLockControl.startLock(durationMs, type, "바로 잠금", packagesJson, prevent);
            updateStatus();
        } catch (error: any) {
            showAlert({ title: "오류", message: error.message });
        }
    };

    const handleStopLock = async () => {
        showAlert({
            title: "잠금 조기 종료",
            message: "관리자 권한으로 잠금을 종료하시겠습니까?",
            confirmText: "종료",
            cancelText: "취소",
            onConfirm: async () => {
                await NativeLockControl.stopLock();
                updateStatus();
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
                await NativeLockControl.scheduleAlarm(
                    id, schedule.startTime, schedule.endTime, schedule.days,
                    schedule.lockType || 'app', schedule.name,
                    JSON.stringify(schedule.lockedApps || []), prevent
                );
            }
            await StorageService.toggleScheduleActivity(id);
            loadSchedules();
        }
    };

    const handleGenerateScheduleQR = (id: string) => {
        (globalThis as any).editingScheduleId = id;
        navigate('AddSchedule' as any, { showQR: true });
    };

    const formatTime = (ms: number) => {
        const totalSec = Math.ceil(ms / 1000);
        const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    // Helper for Teacher/Parent Dashboards
    const renderTeacherDashboard = () => (
        <View style={styles.container}>
            <Header title="교사 대시보드" />
            <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
                <View style={styles.sectionHeader}>
                    <Typography variant="h2" bold>나의 수업</Typography>
                    <TouchableOpacity style={styles.addButton} onPress={() => navigate('TeacherClass' as any)}>
                        <Icon name="add" size={16} color={Colors.primary} />
                        <Typography color={Colors.primary} bold style={styles.addButtonText}>수업 생성</Typography>
                    </TouchableOpacity>
                </View>
                <View style={styles.emptyState}>
                    <Typography color={Colors.textSecondary}>등록된 수업이 없습니다.</Typography>
                </View>
                <View style={[styles.qrActions, { marginTop: 20 }]}>
                    <TouchableOpacity style={styles.qrActionButton} onPress={() => navigate('QRGenerator' as any)}>
                        <View style={[styles.qrIconBadge, { backgroundColor: '#EC489920' }]}>
                            <Icon name="qr-code" size={24} color="#F472B6" />
                        </View>
                        <Typography variant="caption" bold>출석 QR 생성</Typography>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.footer} onPress={() => setUserRole('STUDENT')}>
                    <Typography color={Colors.textSecondary} variant="caption">학생 모드로 전환 (테스트용)</Typography>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );

    if (userRole === 'TEACHER') return renderTeacherDashboard();

    return (
        <View style={styles.container}>
            <Header hasPermission={hasPermission} />
            <ScrollView
                style={styles.flex1}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {isLocked ? (
                    <View style={styles.activeLockCard}>
                        <View style={styles.activeLockHeader}>
                            <View style={styles.statusBadge}>
                                <View style={styles.statusDot} />
                                <Typography variant="caption" bold color={Colors.primary}>집중 모드 동작 중</Typography>
                            </View>
                            <TouchableOpacity onPress={handleStopLock}>
                                <Typography variant="caption" color={Colors.textSecondary}>관리자 종료</Typography>
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
                    <>
                        <QuickLockCard onPress={handleQuickLock} />
                        <View style={styles.qrActions}>
                            <TouchableOpacity style={styles.qrActionButton} onPress={() => navigate('QRScanner' as any)}>
                                <View style={[styles.qrIconBadge, { backgroundColor: '#4F46E520' }]}>
                                    <Icon name="scan" size={24} color="#6366F1" />
                                </View>
                                <Typography variant="caption" bold>QR 스캔 잠금</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.qrActionButton} onPress={() => navigate('QRGenerator' as any)}>
                                <View style={[styles.qrIconBadge, { backgroundColor: '#EC489920' }]}>
                                    <Icon name="qr-code" size={24} color="#F472B6" />
                                </View>
                                <Typography variant="caption" bold>내 QR 생성</Typography>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                <QuickLockPicker
                    isVisible={isPickerVisible}
                    onClose={() => setIsPickerVisible(false)}
                    onConfirm={handleQuickLockConfirm}
                />

                <View style={styles.sectionHeader}>
                    <Typography variant="h2" bold>주간 예약 스케줄</Typography>
                    <TouchableOpacity style={styles.addButton} onPress={() => {
                        (globalThis as any).editingScheduleId = null;
                        navigate('AddSchedule');
                    }}>
                        <Icon name="add" size={16} color={Colors.primary} />
                        <Typography color={Colors.primary} bold style={styles.addButtonText}>예약 추가</Typography>
                    </TouchableOpacity>
                </View>

                <WeeklySchedule
                    schedules={schedules}
                    onPressItem={(id) => {
                        (globalThis as any).editingScheduleId = id;
                        navigate('AddSchedule');
                    }}
                    onToggle={handleToggleSchedule}
                    onGenerateQR={handleGenerateScheduleQR}
                />

                <View style={styles.footer}>
                    <TouchableOpacity onPress={() => navigate('Settings')}>
                        <Typography color={Colors.textSecondary} variant="caption">기관 및 관리자 모드 설정</Typography>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
});
