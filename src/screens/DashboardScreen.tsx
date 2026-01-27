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

const DUMMY_SCHEDULES = [
    {
        id: '1',
        name: '아침 수업',
        timeRange: '09:00 - 12:00',
        days: ['월', '화', '수', '목', '금'],
        isActive: true,
    },
    {
        id: '2',
        name: '오후 자습',
        timeRange: '14:00 - 17:00',
        days: ['월', '수', '금'],
        isActive: false,
    },
];

export const DashboardScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [isLocked, setIsLocked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

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

    return (
        <View style={styles.container}>
            <Header />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <QuickLockCard onPress={handleQuickLock} />

                <QuickLockPicker
                    isVisible={isPickerVisible}
                    onClose={() => setIsPickerVisible(false)}
                    onConfirm={handleQuickLockConfirm}
                />

                <View style={styles.sectionHeader}>
                    <Typography variant="h2" bold>예약 잠금</Typography>
                    <TouchableOpacity style={styles.addButton}>
                        <Typography color={Colors.primary} bold>+ 예약 추가</Typography>
                    </TouchableOpacity>
                </View>

                {DUMMY_SCHEDULES.map(item => (
                    <ScheduleItem key={item.id} schedule={item} />
                ))}

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
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
    },
});
