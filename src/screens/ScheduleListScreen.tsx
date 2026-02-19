import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { StorageService, Schedule } from '../services/StorageService';
import { ParentChildService } from '../services/ParentChildService';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { useAppNavigation } from '../navigation/NavigationContext';
import { useAlert } from '../context/AlertContext';

export const ScheduleListScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const { showAlert } = useAlert();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadAllSchedules();
    }, []);

    const loadAllSchedules = async () => {
        setIsLoading(true);
        try {
            // 1. Load Local Schedules
            const localSchedules = await StorageService.getSchedules();
            const personalSchedules: Schedule[] = localSchedules.map(s => ({
                ...s,
                source: 'LOCAL',
                isReadOnly: s.isReadOnly ?? false
            }));

            // 2. Load Server Schedules (for the child)
            const profile = await StorageService.getUserProfile();
            let serverSchedules: Schedule[] = [];

            if (profile && profile.id) {
                const remoteData = await ParentChildService.getChildSchedules(profile.id);

                serverSchedules = remoteData.map(s => ({
                    ...s,
                    isReadOnly: s.createdBy !== profile.id, // Only read-only if created by others
                    source: 'SERVER' as const
                }));
            }

            // 3. Merge and deduplicate (by ID)
            const combined = [...personalSchedules];
            serverSchedules.forEach(ss => {
                if (!combined.find(ps => ps.id === ss.id)) {
                    combined.push(ss);
                }
            });

            setSchedules(combined);
        } catch (error) {
            console.error("Failed to load schedules:", error);
            showAlert({ title: "오류", message: "스케줄을 불러오는 데 실패했습니다." });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadAllSchedules();
    };

    const handleToggleSchedule = async (id: string) => {
        const schedule = schedules.find(s => s.id === id);
        if (!schedule || schedule.isReadOnly) return;

        // Toggle logic for personal schedules
        await StorageService.toggleScheduleActivity(id);
        loadAllSchedules();
    };

    const handlePressItem = (id: string) => {
        const schedule = schedules.find(s => s.id === id);
        if (!schedule || schedule.isReadOnly) return;

        // AddSchedule is deprecated, redirect to QR generator for modification/referencing
        navigate('QRGenerator', { type: 'SCHEDULED', title: schedule.name, apps: schedule.lockedApps });
    };

    return (
        <View style={styles.container}>
            <Header title="예약 스케줄" />
            <ScrollView
                style={styles.flex1}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
                }
            >
                <View style={styles.content}>
                    <Typography variant="h1" bold style={styles.title}>내 예약 관리</Typography>
                    <Typography variant="body" color={Colors.textSecondary} style={styles.subtitle}>
                        직접 설정한 예약과 부모님이 등록한 예약이 모두 표시됩니다.
                    </Typography>

                    {isLoading && !isRefreshing ? (
                        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
                    ) : (
                        <WeeklySchedule
                            schedules={schedules}
                            onToggle={handleToggleSchedule}
                            onPressItem={handlePressItem}
                        />
                    )}
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
    content: {
        paddingBottom: 40,
    },
    title: {
        paddingHorizontal: 20,
        marginTop: 20,
    },
    subtitle: {
        paddingHorizontal: 20,
        marginTop: 8,
        marginBottom: 20,
    }
});
