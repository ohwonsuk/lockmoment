import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { ScheduleItem } from './ScheduleItem';
import { Schedule } from '../services/StorageService';

interface Props {
    schedules: Schedule[];
    onToggle: (id: string) => void;
    onPressItem: (id: string) => void;
    onGenerateQR?: (id: string) => void;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const WeeklySchedule: React.FC<Props> = ({ schedules, onToggle, onPressItem, onGenerateQR }) => {
    const [selectedDay, setSelectedDay] = useState<string>(DAYS[new Date().getDay()]);

    const filteredSchedules = schedules.filter(s => s.days.includes(selectedDay));

    return (
        <View style={styles.container}>
            <View style={styles.daysContainer}>
                {DAYS.map(day => (
                    <TouchableOpacity
                        key={day}
                        style={[
                            styles.dayItem,
                            selectedDay === day && styles.dayItemSelected
                        ]}
                        onPress={() => setSelectedDay(day)}
                    >
                        <Typography
                            variant="caption"
                            bold
                            color={selectedDay === day ? Colors.primary : Colors.textSecondary}
                        >
                            {day}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.scheduleList}>
                {filteredSchedules.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Typography color={Colors.textSecondary} variant="caption">
                            {selectedDay}요일에 설정된 예약이 없습니다.
                        </Typography>
                    </View>
                ) : (
                    filteredSchedules.map(item => (
                        <View key={item.id} style={styles.itemWrapper}>
                            <ScheduleItem
                                schedule={{
                                    id: item.id,
                                    name: item.name,
                                    timeRange: `${item.startTime} - ${item.endTime}`,
                                    days: item.days,
                                    isActive: item.isActive
                                }}
                                isReadOnly={item.isReadOnly}
                                onPress={() => onPressItem(item.id)}
                                onToggle={onToggle}
                                onGenerateQR={onGenerateQR}
                            />
                        </View>
                    ))
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
    },
    daysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    dayItem: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    dayItemSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '15',
    },
    scheduleList: {
        minHeight: 100,
    },
    itemWrapper: {
        marginBottom: -8, // Reduce gap between items relative to ScheduleItem's margin
    },
    emptyState: {
        padding: 30,
        alignItems: 'center',
    },
});
