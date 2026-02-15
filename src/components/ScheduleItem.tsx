import React from 'react';
import { View, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { Icon } from './Icon';

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
    onToggle?: (id: string) => void;
    onGenerateQR?: (id: string) => void;
    isReadOnly?: boolean;
}

export const ScheduleItem: React.FC<Props> = ({ schedule, onPress, onToggle, onGenerateQR, isReadOnly }) => {
    return (
        <TouchableOpacity
            style={styles.container}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={styles.header}>
                <Typography variant="h2" bold>{schedule.name}</Typography>
                <View style={styles.headerRight}>
                    {isReadOnly && (
                        <View style={styles.readOnlyBadge}>
                            <Typography variant="caption" color={Colors.primary} bold>읽기 전용</Typography>
                        </View>
                    )}
                    {onGenerateQR && !isReadOnly && (
                        <TouchableOpacity
                            onPress={() => onGenerateQR(schedule.id)}
                            style={styles.qrIcon}
                        >
                            <Icon name="qr-code" size={20} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                    {!isReadOnly && (
                        <>
                            <Switch
                                value={schedule.isActive}
                                onValueChange={() => onToggle?.(schedule.id)}
                                trackColor={{ false: Colors.statusInactive, true: Colors.primary }}
                                thumbColor={Colors.text}
                                style={styles.switch}
                            />
                            <Icon name="chevron-forward" size={18} color={Colors.textSecondary} />
                        </>
                    )}
                </View>
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
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    qrIcon: {
        marginRight: 8,
        padding: 4,
    },
    switch: {
        transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
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
    readOnlyBadge: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
});
