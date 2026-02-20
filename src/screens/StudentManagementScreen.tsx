import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Header } from '../components/Header';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';

const STUDENTS_MOCK = [
    { id: '1', name: '김민준', status: 'LOCKED', battery: '85%', lastSeen: '1분 전' },
    { id: '2', name: '이서윤', status: 'UNLOCKED', battery: '42%', lastSeen: '5분 전' },
    { id: '3', name: '박도윤', status: 'OFFLINE', battery: '12%', lastSeen: '2시간 전' },
    { id: '4', name: '최지우', status: 'LOCKED', battery: '91%', lastSeen: '방금' },
];

export const StudentManagementScreen: React.FC = () => {
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

    const renderStudent = ({ item }: { item: typeof STUDENTS_MOCK[0] }) => (
        <View style={styles.studentCard}>
            <TouchableOpacity
                style={styles.checkbox}
                onPress={() => {
                    if (selectedStudents.includes(item.id)) {
                        setSelectedStudents(selectedStudents.filter(id => id !== item.id));
                    } else {
                        setSelectedStudents([...selectedStudents, item.id]);
                    }
                }}
            >
                <Icon
                    name={selectedStudents.includes(item.id) ? "checkbox" : "square-outline"}
                    size={24}
                    color={selectedStudents.includes(item.id) ? Colors.primary : Colors.textSecondary}
                />
            </TouchableOpacity>

            <View style={styles.studentInfo}>
                <Typography bold>{item.name}</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>{item.lastSeen} • 배터리 {item.battery}</Typography>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: item.status === 'LOCKED' ? Colors.primary + '20' : Colors.border }]}>
                <Typography color={item.status === 'LOCKED' ? Colors.primary : Colors.textSecondary} variant="caption" bold>
                    {item.status === 'LOCKED' ? '잠금 중' : item.status === 'OFFLINE' ? '오프라인' : '해제됨'}
                </Typography>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Header title="학생 관리" showContextSwitcher={true} />

            <View style={styles.summaryBar}>
                <View style={styles.summaryItem}>
                    <Typography variant="h2" bold color={Colors.primary}>4</Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>전체 학생</Typography>
                </View>
                <View style={styles.summaryItem}>
                    <Typography variant="h2" bold color={Colors.primary}>2</Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>잠금 중</Typography>
                </View>
                <View style={styles.summaryItem}>
                    <Typography variant="h2" bold color="#EF4444">1</Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>오프라인</Typography>
                </View>
            </View>

            <View style={styles.actionHeader}>
                <Typography bold>학생 목록 ({STUDENTS_MOCK.length})</Typography>
                <TouchableOpacity style={styles.batchAction}>
                    <Typography color={Colors.primary} bold>일괄 잠금</Typography>
                </TouchableOpacity>
            </View>

            <FlatList
                data={STUDENTS_MOCK}
                renderItem={renderStudent}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />

            {selectedStudents.length > 0 && (
                <View style={styles.floatingAction}>
                    <Typography color="white" bold>{selectedStudents.length}명 선택됨</Typography>
                    <TouchableOpacity style={styles.actionBtn}>
                        <Typography color="white" bold>즉시 잠금</Typography>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    summaryBar: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        margin: 20,
        padding: 20,
        borderRadius: 16,
        justifyContent: 'space-around',
    },
    summaryItem: {
        alignItems: 'center',
    },
    actionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    batchAction: {
        padding: 5,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
    },
    checkbox: {
        marginRight: 10,
    },
    studentInfo: {
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    floatingAction: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderRadius: 12,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    actionBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    }
});
