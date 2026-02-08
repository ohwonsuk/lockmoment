import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { Header } from '../components/Header';
import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { ScheduleItem } from '../components/ScheduleItem';

export const AdminScheduleScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSchedulesLoading, setIsSchedulesLoading] = useState(false);

    useEffect(() => {
        loadChildren();
    }, []);

    const loadChildren = async () => {
        setIsLoading(true);
        try {
            const data = await ParentChildService.getLinkedChildren();
            setChildren(data);
            if (data.length > 0) {
                setSelectedChildId(data[0].id);
                loadSchedules(data[0].id);
            }
        } catch (error) {
            console.error("Failed to load children:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSchedules = async (childId: string) => {
        setIsSchedulesLoading(true);
        try {
            const data = await ParentChildService.getChildSchedules(childId);
            setSchedules(data);
        } catch (error) {
            console.error("Failed to load child schedules:", error);
        } finally {
            setIsSchedulesLoading(false);
        }
    };

    const handleChildSelect = (childId: string) => {
        setSelectedChildId(childId);
        loadSchedules(childId);
    };

    const renderHeader = () => (
        <View style={styles.childSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childScroll}>
                {children.map(child => (
                    <TouchableOpacity
                        key={child.id}
                        style={[styles.childTab, selectedChildId === child.id && styles.activeTab]}
                        onPress={() => handleChildSelect(child.id)}
                    >
                        <View style={[styles.statusDot, { backgroundColor: child.status === 'LOCKED' ? Colors.primary : Colors.textSecondary }]} />
                        <Typography bold={selectedChildId === child.id} color={selectedChildId === child.id ? Colors.primary : Colors.text}>
                            {child.childName}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    return (
        <View style={styles.container}>
            <Header title="스케줄 관리" showBack />

            {isLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
            ) : (
                <>
                    {children.length > 0 ? (
                        <>
                            {renderHeader()}
                            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                                <View style={styles.sectionHeader}>
                                    <Typography variant="h2" bold>예약 리스트</Typography>
                                    <TouchableOpacity
                                        style={styles.qrBtn}
                                        onPress={() => navigate('QRGenerator', { type: 'SCHEDULED', childId: selectedChildId })}
                                    >
                                        <Icon name="qr-code-outline" size={16} color={Colors.primary} />
                                        <Typography color={Colors.primary} bold style={{ marginLeft: 6 }}>새 예약 QR</Typography>
                                    </TouchableOpacity>
                                </View>

                                {isSchedulesLoading ? (
                                    <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary} />
                                ) : schedules.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Typography color={Colors.textSecondary}>설정된 예약이 없습니다.</Typography>
                                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 8 }}>
                                            우측 상단 버튼을 눌러 새 예약을 위한 QR을 생성하세요.
                                        </Typography>
                                    </View>
                                ) : (
                                    <View style={styles.scheduleList}>
                                        {schedules.map(item => (
                                            <ScheduleItem
                                                key={item.id}
                                                schedule={{
                                                    id: item.id,
                                                    name: item.name,
                                                    timeRange: `${item.startTime} - ${item.endTime}`,
                                                    days: item.days,
                                                    isActive: item.isActive
                                                }}
                                                onPress={() => { }} // Maybe view details?
                                                onToggle={() => { }} // Remote toggle?
                                                onGenerateQR={() => navigate('QRGenerator', {
                                                    type: 'SCHEDULED',
                                                    childId: selectedChildId,
                                                    title: item.name,
                                                    startTime: item.startTime,
                                                    endTime: item.endTime,
                                                    days: item.days
                                                })}
                                            />
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        </>
                    ) : (
                        <View style={styles.emptyState}>
                            <Typography color={Colors.textSecondary}>관리 중인 자녀가 없습니다.</Typography>
                        </View>
                    )}
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    childSelector: { backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
    childScroll: { paddingHorizontal: 15, paddingVertical: 12, gap: 10 },
    childTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, gap: 8 },
    activeTab: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    content: { flex: 1 },
    scrollContent: { padding: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    qrBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    scheduleList: { gap: 0 },
    emptyState: { padding: 40, alignItems: 'center' },
});
