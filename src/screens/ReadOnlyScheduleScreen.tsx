import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Header } from '../components/Header';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { StorageService, Schedule } from '../services/StorageService';
import { useAlert } from '../context/AlertContext';

export const ReadOnlyScheduleScreen: React.FC = () => {
    const { currentParams, navigate } = useAppNavigation();
    const { showAlert } = useAlert();
    const [schedule, setSchedule] = useState<Schedule | null>(null);

    useEffect(() => {
        const loadSchedule = async () => {
            const tempId = currentParams?.scheduleId;
            if (!tempId) {
                showAlert({ title: "오류", message: "잘못된 접근입니다.", onConfirm: () => navigate('Dashboard') });
                return;
            }
            const schedules = await StorageService.getSchedules();
            const s = schedules.find((x: Schedule) => x.id === tempId);

            if (s) setSchedule(s);
            else {
                showAlert({ title: "오류", message: "예약 잠금 정보를 찾을 수 없습니다.", onConfirm: () => navigate('Dashboard') });
            }
        };
        loadSchedule();
    }, [currentParams]);

    if (!schedule) {
        return (
            <View style={styles.container}>
                <Header title="예약 상세 (읽기 전용)" showBack onBack={() => navigate('Dashboard')} />
            </View>
        );
    }

    const lockLabel = schedule.lockType === 'FULL' ? '전체 잠금' : '선택 앱 잠금';

    return (
        <View style={styles.container}>
            <Header title="예약 상세 (읽기 전용)" showBack onBack={() => navigate('Dashboard')} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.headerRow}>
                        <Icon name="calendar" size={24} color={Colors.primary} />
                        <Typography variant="h2" bold style={{ marginLeft: 8 }}>{schedule.name}</Typography>
                    </View>

                    <View style={styles.infoGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.label}>예약 시간</Typography>
                        <Typography bold style={styles.value}>{schedule.startTime} ~ {schedule.endTime}</Typography>
                    </View>

                    <View style={styles.infoGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.label}>반복 요일</Typography>
                        <View style={styles.daysRow}>
                            {['월', '화', '수', '목', '금', '토', '일'].map(d => {
                                const isActive = schedule.days.includes(d);
                                return (
                                    <View key={d} style={[styles.dayCircle, isActive && styles.dayCircleActive]}>
                                        <Typography color={isActive ? Colors.primary : Colors.textSecondary}>{d}</Typography>
                                    </View>
                                )
                            })}
                        </View>
                    </View>

                    <View style={styles.infoGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.label}>잠금 방식</Typography>
                        <View style={styles.methodBadge}>
                            <Icon name={schedule.lockType === 'FULL' ? 'phone-portrait-outline' : 'apps-outline'} size={18} color={Colors.primary} />
                            <Typography bold color={Colors.primary} style={{ marginLeft: 6 }}>{lockLabel}</Typography>
                        </View>
                    </View>

                    <View style={styles.noticeBox}>
                        <Icon name="information-circle-outline" size={20} color={Colors.textSecondary} />
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginLeft: 8, flex: 1 }}>
                            보호자가 설정하여 읽기 전용으로 된 잠금 규칙입니다. 보호자 기기 또는 연결된 앱에서 수정, 삭제를 할 수 있습니다.
                        </Typography>
                    </View>
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
        padding: 20,
    },
    card: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    infoGroup: {
        marginBottom: 20,
    },
    label: {
        marginBottom: 8,
    },
    value: {
        fontSize: 18,
    },
    daysRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    dayCircleActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '15',
    },
    methodBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: Colors.primary + '15',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    noticeBox: {
        flexDirection: 'row',
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 16,
        marginTop: 10,
    }
});
