import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
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
    const [hasPermission, setHasPermission] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);

    useEffect(() => {
        checkStatus();
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        const storedSchedules = await StorageService.getSchedules();
        setSchedules(storedSchedules);
    };

    const checkStatus = async () => {
        if (Platform.OS === 'android') {
            const perm = await NativeLockControl.checkAccessibilityPermission();
            setHasPermission(perm);
            const locked = await NativeLockControl.isLocked();
            setIsLocked(locked);
        } else {
            const authStatus = await NativeLockControl.checkAuthorization();
            setHasPermission(authStatus === 2); // 2 = individual permission approved
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
            await NativeLockControl.startLock(durationMs, type);
            setIsLocked(true);
            navigate('Locking');
        } catch (error: any) {
            Alert.alert("오류", error.message);
        }
    };

    const handleToggleSchedule = async (id: string) => {
        await StorageService.toggleScheduleActivity(id);
        loadSchedules();
    };

    return (
        <View style={styles.container}>
            <Header />
            <ScrollView
                style={styles.flex1}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <QuickLockCard onPress={handleQuickLock} />

                <QuickLockPicker
                    isVisible={isPickerVisible}
                    onClose={() => setIsPickerVisible(false)}
                    onConfirm={handleQuickLockConfirm}
                />

                <View style={styles.sectionHeader}>
                    <Typography variant="h2" bold>예약 잠금</Typography>
                    <TouchableOpacity style={styles.addButton} onPress={() => navigate('AddSchedule')}>
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
                            onPress={() => navigate('AddSchedule')}
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
