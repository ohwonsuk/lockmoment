import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { Icon } from './Icon';
import { ChildInfo } from '../services/ParentChildService';

interface Props {
    children: ChildInfo[];
    onManage: (childId: string) => void;
}

export const FamilyLockList: React.FC<Props> = ({ children, onManage }) => {
    if (!children || children.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Typography variant="h2" bold>가족 잠금 (관리)</Typography>
            </View>
            <View style={styles.list}>
                {children.map((child) => (
                    <View key={child.id} style={styles.card}>
                        <View style={styles.info}>
                            <View style={styles.nameRow}>
                                <Typography bold style={styles.name}>{child.childName}</Typography>
                                <View style={[styles.statusBadge, {
                                    backgroundColor: child.status === 'LOCKED' ? Colors.primary + '15' : Colors.border
                                }]}>
                                    <Icon
                                        name={child.status === 'LOCKED' ? 'lock-closed' : 'lock-open'}
                                        size={12}
                                        color={child.status === 'LOCKED' ? Colors.primary : Colors.textSecondary}
                                    />
                                    <Typography variant="caption" color={child.status === 'LOCKED' ? Colors.primary : Colors.textSecondary}>
                                        {child.status === 'LOCKED' ? '잠금 중' : '해제'}
                                    </Typography>
                                </View>
                            </View>
                            <Typography variant="caption" color={Colors.textSecondary}>
                                {child.deviceName || '기기 정보 없음'}
                            </Typography>
                            {child.status === 'LOCKED' && child.lockName && (
                                <Typography variant="caption" color={Colors.primary} style={{ marginTop: 4 }}>
                                    {child.lockName}
                                    {child.lockEndsAt && ` • ${new Date(child.lockEndsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 종료`}
                                </Typography>
                            )}
                        </View>
                        <TouchableOpacity style={styles.manageBtn} onPress={() => onManage(child.id)}>
                            <Typography variant="caption" color={Colors.primary} bold>관리하기</Typography>
                            <Icon name="chevron-forward" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    list: {
        paddingHorizontal: 20,
        gap: 12,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    info: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    name: {
        fontSize: 16,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        gap: 4,
    },
    manageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: Colors.primary + '10',
        borderRadius: 8,
    },
});
