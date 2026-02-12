import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { Icon } from './Icon';
import { Preset } from '../services/PresetService';

interface PresetItemProps {
    preset: Preset;
    isSelected?: boolean;
    onPress?: (preset: Preset) => void;
}

export const PresetItem: React.FC<PresetItemProps> = ({ preset, isSelected, onPress }) => {
    // 목적으로부터 아이콘 매핑
    const getIconName = () => {
        switch (preset.purpose) {
            case 'LOCK_ONLY':
                return preset.lock_type === 'FULL' ? 'lock-closed' : 'apps';
            case 'ATTENDANCE_ONLY':
                return 'checkbox-outline';
            case 'LOCK_AND_ATTENDANCE':
                return 'briefcase';
            default:
                return 'settings-outline';
        }
    };

    // 아이콘 색상 설정
    const getIconColor = () => {
        if (isSelected) return Colors.primary;
        return Colors.textSecondary;
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isSelected && styles.containerSelected
            ]}
            onPress={() => onPress?.(preset)}
            activeOpacity={0.7}
        >
            <View style={[styles.iconWrapper, isSelected && styles.iconWrapperSelected]}>
                <Icon name={getIconName()} size={24} color={getIconColor()} />
            </View>
            <View style={styles.textWrapper}>
                <Typography bold={isSelected} style={styles.name} color={isSelected ? Colors.primary : Colors.text}>
                    {preset.name}
                </Typography>
                {preset.description && (
                    <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                        {preset.description}
                    </Typography>
                )}
            </View>
            {isSelected && (
                <View style={styles.checkIcon}>
                    <Icon name="checkmark-circle" size={20} color={Colors.primary} />
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 140,
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: Colors.border,
        position: 'relative',
    },
    containerSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '10', // 10% opacity
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconWrapperSelected: {
        backgroundColor: Colors.primary + '20',
    },
    textWrapper: {
        flex: 1,
    },
    name: {
        fontSize: 14,
        marginBottom: 4,
    },
    checkIcon: {
        position: 'absolute',
        top: 10,
        right: 10,
    }
});
