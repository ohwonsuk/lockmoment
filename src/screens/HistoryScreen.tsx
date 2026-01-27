import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';

const HISTORY_DATA = [
    { id: '1', date: '2026.01.25', name: '아침 수업', duration: '3시간', status: '완료' },
    { id: '2', date: '2026.01.24', name: '바로 잠금', duration: '1분', status: '완료' },
    { id: '3', date: '2026.01.24', name: '오후 자습', duration: '3시간', status: '중단' },
];

export const HistoryScreen: React.FC = () => {
    return (
        <View style={styles.container}>
            <Header showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h1" bold style={styles.title}>잠금 기능 사용 이력</Typography>

                {HISTORY_DATA.map(item => (
                    <View key={item.id} style={styles.historyItem}>
                        <View>
                            <Typography variant="caption" color={Colors.textSecondary}>{item.date}</Typography>
                            <Typography variant="body" bold style={styles.itemName}>{item.name}</Typography>
                        </View>
                        <View style={styles.rightContent}>
                            <Typography variant="body">{item.duration}</Typography>
                            <Typography
                                variant="caption"
                                color={item.status === '완료' ? Colors.statusGreen : '#FF3B30'}
                            >
                                {item.status}
                            </Typography>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        paddingBottom: 40,
    },
    title: {
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 20,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.card,
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    itemName: {
        marginTop: 4,
    },
    rightContent: {
        alignItems: 'flex-end',
        gap: 4,
    },
});
