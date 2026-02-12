import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';

type NotificationType = 'SYSTEM' | 'FAMILY' | 'INSTITUTE';

interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    date: Date;
    read: boolean;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
    { id: '1', type: 'FAMILY', title: '김민지 잠금 해제 요청', message: '영어 숙제 완료로 잠금 해제를 요청했습니다.', date: new Date(), read: false },
    { id: '2', type: 'INSTITUTE', title: '출석 완료', message: '이준호 학생이 학원에 도착했습니다. (14:32)', date: new Date(Date.now() - 3600000), read: true },
    { id: '3', type: 'SYSTEM', title: '업데이트 안내', message: '새로운 기능이 추가되었습니다. 앱을 업데이트해주세요.', date: new Date(Date.now() - 86400000), read: true },
];

export const NotificationScreen: React.FC = () => {
    const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
    const [filter, setFilter] = useState<'ALL' | NotificationType>('ALL');
    const [refreshing, setRefreshing] = useState(false);

    const filteredData = filter === 'ALL'
        ? notifications
        : notifications.filter(n => n.type === filter);

    const onRefresh = () => {
        setRefreshing(true);
        // Simulate fetch
        setTimeout(() => setRefreshing(false), 1000);
    };

    const handleClearAll = () => {
        setNotifications([]);
    };

    const getIconForType = (type: NotificationType) => {
        switch (type) {
            case 'FAMILY': return 'people';
            case 'INSTITUTE': return 'school';
            default: return 'information-circle';
        }
    };

    const renderItem = ({ item }: { item: NotificationItem }) => (
        <View style={[styles.itemContainer, !item.read && styles.unreadItem]}>
            <View style={[styles.iconContainer, { backgroundColor: item.read ? Colors.border : Colors.primary + '20' }]}>
                <Icon name={getIconForType(item.type)} size={24} color={item.read ? Colors.textSecondary : Colors.primary} />
            </View>
            <View style={styles.textContainer}>
                <View style={styles.headerRow}>
                    <Typography bold variant="caption" color={Colors.primary}>{item.type}</Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                        {item.date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                </View>
                <Typography bold style={{ marginBottom: 4 }}>{item.title}</Typography>
                <Typography variant="caption" color={Colors.textSecondary} numberOfLines={2}>{item.message}</Typography>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Header title="알림" />

            <View style={styles.filterContainer}>
                <ScrollViewHorizontal>
                    {(['ALL', 'FAMILY', 'INSTITUTE', 'SYSTEM'] as const).map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[styles.filterChip, filter === type && styles.activeFilterChip]}
                            onPress={() => setFilter(type)}
                        >
                            <Typography
                                variant="caption"
                                color={filter === type ? Colors.primary : Colors.textSecondary}
                                bold={filter === type}
                            >
                                {type === 'ALL' ? '전체' : type}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </ScrollViewHorizontal>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={handleClearAll} style={{ paddingLeft: 10 }}>
                        <Typography variant="caption" color={Colors.textSecondary}>모두 지우기</Typography>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={filteredData}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Icon name="notifications-off-outline" size={48} color={Colors.textSecondary} />
                        <Typography color={Colors.textSecondary} style={{ marginTop: 16 }}>새로운 알림이 없습니다.</Typography>
                    </View>
                }
            />
        </View>
    );
};

// Helper for horizontal scroll with style
const ScrollViewHorizontal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <FlatList
        horizontal
        data={React.Children.toArray(children)}
        renderItem={({ item }) => item as React.ReactElement}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        style={{ flexGrow: 0 }}
    />
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 10,
        justifyContent: 'space-between',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        marginRight: 8,
    },
    activeFilterChip: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '10',
    },
    listContent: {
        padding: 20,
        gap: 16,
    },
    itemContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: Colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    unreadItem: {
        borderColor: Colors.primary + '50',
        backgroundColor: Colors.primary + '05',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
