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

    // 카테고리 한글 변환
    const getCategoryLabel = () => {
        switch (preset.category) {
            case 'HOME': return '가정용';
            case 'SCHOOL': return '기관용';
            case 'COMMON': return '공통';
            default: return '일반';
        }
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
            <View style={styles.headerRow}>
                <View style={[styles.categoryBadge, { backgroundColor: isSelected ? Colors.primary + '20' : Colors.background }]}>
                    <Typography variant="caption" style={{ fontSize: 10 }} color={isSelected ? Colors.primary : Colors.textSecondary}>
                        {getCategoryLabel()}
                    </Typography>
                </View>
                {isSelected && (
                    <Icon name="checkmark-circle" size={18} color={Colors.primary} />
                )}
            </View>

            <View style={[styles.iconWrapper, isSelected && styles.iconWrapperSelected]}>
                <Icon name={getIconName()} size={24} color={getIconColor()} />
            </View>

            <View style={styles.textWrapper}>
                <Typography bold={isSelected} style={styles.name} color={isSelected ? Colors.primary : Colors.text} numberOfLines={1}>
                    {preset.name}
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1} style={{ fontSize: 11 }}>
                    {preset.description || (preset.lock_type === 'FULL' ? '전체 차단' : '앱 잠금')}
                </Typography>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 120, // 가로 폭을 약간 줄여 더 많은 카드가 보이도록 함
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 12,
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: Colors.border,
        justifyContent: 'space-between',
        height: 130, // 높이 고정으로 균일한 디자인 유지
    },
    containerSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '10',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconWrapperSelected: {
        backgroundColor: Colors.primary + '20',
    },
    textWrapper: {
        marginTop: 'auto',
    },
    name: {
        fontSize: 13,
        lineHeight: 18,
    },
});
