import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { StorageService, HistoryItem } from '../services/StorageService';

export const HistoryScreen: React.FC = () => {
    const [history, setHistory] = useState<HistoryItem[]>([]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const data = await StorageService.getHistory();
        setHistory(data);
    };

    return (
        <View style={styles.container}>
            <Header showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h1" bold style={styles.title}>잠금 기능 사용 이력</Typography>

                {history.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Typography color={Colors.textSecondary}>잠금 이력이 없습니다.</Typography>
                    </View>
                ) : (
                    history.map(item => (
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
                    ))
                )}
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
    emptyState: {
        padding: 40,
        alignItems: 'center',
    }
});
