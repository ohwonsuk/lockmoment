import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Linking } from 'react-native';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { QuickLockCard } from '../components/QuickLockCard';
import { ScheduleItem } from '../components/ScheduleItem';
import { Typography } from '../components/Typography';
import { NativeLockControl } from '../services/NativeLockControl';
import { useAppNavigation } from '../navigation/NavigationContext';
import { QuickLockPicker } from '../components/QuickLockPicker';
import { Icon } from '../components/Icon';
import { StorageService, Schedule } from '../services/StorageService';

export const DashboardScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [isLocked, setIsLocked] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [hasPermission, setHasPermission] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const unsubscribe = navigate.addListener?.('focus', () => {
            refreshAll();
        });

        refreshAll();
        restoreLock();

        // Polling timer to catch background locks (like scheduled ones)
        // and update high-frequency countdown when locked
        timerRef.current = setInterval(updateStatus, 1000);

        return () => {
            if (unsubscribe) unsubscribe();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [navigate]);

    const updateStatus = async () => {
        try {
            const locked = await NativeLockControl.isLocked();
            setIsLocked(locked);

            if (locked) {
                const remaining = await NativeLockControl.getRemainingTime();
                setRemainingTime(remaining);
                if (remaining <= 0) {
                    setIsLocked(false);
                    setRemainingTime(0);
                }
            } else {
                setRemainingTime(0);
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
        } else {
            const authStatus = await NativeLockControl.checkAuthorization();
            setHasPermission(authStatus === 2);
        }
    };

    const handleQuickLock = async () => {
        if (!hasPermission) {
            navigate('Permissions');
            return;
        }
        setIsPickerVisible(true);
    };

    const handleQuickLockConfirm = async (h: number, m: number, type: 'app' | 'phone') => {
        setIsPickerVisible(false);
        try {
            const durationMs = (h * 3600 + m * 60) * 1000;
            await NativeLockControl.startLock(durationMs, type, "바로 잠금");
            updateStatus(); // Immediate feedback
        } catch (error: any) {
            Alert.alert("오류", error.message);
        }
    };

    const handleStopLock = async () => {
        Alert.alert(
            "잠금 조기 종료",
            "관리자 권한으로 잠금을 종료하시겠습니까?",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "종료",
                    onPress: async () => {
                        await NativeLockControl.stopLock();
                        updateStatus();
                    }
                }
            ]
        );
    };

    const formatTime = (ms: number) => {
        const totalSec = Math.ceil(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleToggleSchedule = async (id: string) => {
        const schedule = schedules.find(s => s.id === id);
        if (schedule && schedule.isActive) {
            try {
                await NativeLockControl.cancelAlarm(id);
            } catch (error) {
                console.error('Failed to cancel alarm:', error);
            }
        } else if (schedule && !schedule.isActive) {
            try {
                await NativeLockControl.scheduleAlarm(
                    id,
                    schedule.startTime,
                    schedule.endTime,
                    schedule.days,
                    schedule.lockType || 'app',
                    schedule.name,
                    schedule.allowedApp?.packageName
                );
            } catch (error) {
                console.error('Failed to schedule alarm:', error);
            }
        }

        await StorageService.toggleScheduleActivity(id);
        loadSchedules();
    };

    const handleOpenDialer = async () => {
        if (Platform.OS === 'android') {
            await NativeLockControl.openDefaultDialer();
        } else {
            Linking.openURL('telprompt:');
        }
    };

    const handleOpenMessages = async () => {
        if (Platform.OS === 'android') {
            await NativeLockControl.openDefaultMessages();
        } else {
            Linking.openURL('sms:');
        }
    };

    return (
        <View style={styles.container}>
            <Header />
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

                        <View style={styles.emergencyActions}>
                            <TouchableOpacity style={styles.emergencyButton} onPress={handleOpenDialer}>
                                <Icon name="call" size={20} color={Colors.text} />
                                <Typography variant="caption" bold>전화</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.emergencyButton} onPress={handleOpenMessages}>
                                <Icon name="chatbubble" size={20} color={Colors.text} />
                                <Typography variant="caption" bold>메시지</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <QuickLockCard onPress={handleQuickLock} />
                )}

                <QuickLockPicker
                    isVisible={isPickerVisible}
                    onClose={() => setIsPickerVisible(false)}
                    onConfirm={handleQuickLockConfirm}
                />

                <View style={styles.sectionHeader}>
                    <Typography variant="h2" bold>예약 잠금</Typography>
                    <TouchableOpacity style={styles.addButton} onPress={() => {
                        (globalThis as any).editingScheduleId = null;
                        navigate('AddSchedule');
                    }}>
                        <View style={styles.addButtonContent}>
                            <Icon name="add" size={16} color={Colors.primary} />
                            <Typography color={Colors.primary} bold style={styles.addButtonText}>예약 추가</Typography>
                        </View>
                    </TouchableOpacity>
                </View>

                {schedules.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Typography color={Colors.textSecondary}>설정된 예약이 없습니다.</Typography>
                    </View>
                ) : (
                    schedules.map(item => (
                        <ScheduleItem
                            key={item.id}
                            schedule={{
                                id: item.id,
                                name: item.name,
                                timeRange: `${item.startTime} - ${item.endTime}`,
                                days: item.days,
                                isActive: item.isActive
                            }}
                            onPress={() => {
                                (globalThis as any).editingScheduleId = item.id;
                                navigate('AddSchedule');
                            }}
                            onToggle={handleToggleSchedule}
                        />
                    ))
                )}

                <View style={styles.footer}>
                    <TouchableOpacity>
                        <Typography color={Colors.textSecondary} variant="caption">관리자 모드</Typography>
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
        fontVariant: ['tabular-nums'],
        marginBottom: 24,
    },
    emergencyActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    emergencyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.background,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.border,
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
        backgroundColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
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
});
