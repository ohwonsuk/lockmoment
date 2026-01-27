import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';

interface Schedule {
    id: string;
    name: string;
    timeRange: string;
    days: string[];
    isActive: boolean;
}

interface Props {
    schedule: Schedule;
    onPress?: () => void;
}

export const ScheduleItem: React.FC<Props> = ({ schedule, onPress }) => {
    return (
        <TouchableOpacity
            style={styles.container}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={styles.header}>
                <Typography variant="h2" bold>{schedule.name}</Typography>
                <View style={[
                    styles.statusDot,
                    { backgroundColor: schedule.isActive ? Colors.statusGreen : Colors.statusInactive }
                ]} />
            </View>

            <View style={styles.details}>
                <Typography color={Colors.textSecondary} style={styles.timeText}>
                    {schedule.timeRange}
                </Typography>
                <Typography color={Colors.primary} bold style={styles.daysText}>
                    {schedule.days.join(' ')}
                </Typography>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.card,
        marginHorizontal: 20,
        marginTop: 12,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    details: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    timeText: {
        fontSize: 15,
    },
    daysText: {
        fontSize: 15,
    },
});
