import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation, useAppRoute } from '../navigation/NavigationContext';
import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { NativeLockControl } from '../services/NativeLockControl';

export const ChildDetailScreen: React.FC = () => {
    const { navigate, goBack } = useAppNavigation();
    const route = useAppRoute();
    const childId = (route.params as any)?.childId;

    const [child, setChild] = useState<ChildInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'HOME' | 'INSTITUTE'>('HOME');

    useEffect(() => {
        if (childId) {
            loadChildDetails();
        }
    }, [childId]);

    const loadChildDetails = async () => {
        setLoading(true);
        try {
            // Fetch child details - potentially need a getChildById method in Service
            const children = await ParentChildService.getLinkedChildren();
            const found = children.find(c => c.id === childId);
            if (found) setChild(found);
            else {
                Alert.alert("Error", "Child not found");
                goBack();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLock = async () => {
        // Trigger generic lock picker or unified lock flow for this child
        Alert.alert("잠금 설정", `${child?.childName}님의 기기를 잠급니다.`, [
            { text: "취소", style: "cancel" },
            {
                text: "바로 잠금",
                onPress: () => navigate('QuickLockPicker' as any, { targetId: childId }) // Needed implementation
            }
        ]);
    };

    if (loading || !child) {
        return (
            <View style={styles.container}>
                <Header title="상세 정보" />
                <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Typography>Loading...</Typography>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Header title={child.childName} />

            <ScrollView contentContainerStyle={styles.content}>
                {/* Status Card */}
                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View style={[styles.avatar, { backgroundColor: child.status === 'LOCKED' ? Colors.primary : Colors.textSecondary }]}>
                            <Icon name={child.status === 'LOCKED' ? "lock-closed" : "lock-open"} size={24} color="white" />
                        </View>
                        <View style={styles.statusText}>
                            <Typography variant="h2" bold>{child.status === 'LOCKED' ? '잠금 활성화' : '잠금 해제됨'}</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>
                                {child.status === 'LOCKED' ? '현재 집중 모드가 켜져있습니다.' : '자유롭게 기기를 사용 중입니다.'}
                            </Typography>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.deviceInfo}>
                        <Icon name="phone-portrait" size={16} color={Colors.textSecondary} />
                        <Typography variant="caption" color={Colors.textSecondary}>{child.deviceName || 'Unknown Device'}</Typography>
                        {/* Battery could be added here if synced */}
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleLock}>
                        <View style={[styles.actionIcon, { backgroundColor: '#6366F115' }]}>
                            <Icon name="lock-closed" size={24} color={Colors.primary} />
                        </View>
                        <Typography bold style={{ marginTop: 8 }}>잠금 설정</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => { }}>
                        <View style={[styles.actionIcon, { backgroundColor: '#10B98115' }]}>
                            <Icon name="stats-chart" size={24} color="#10B981" />
                        </View>
                        <Typography bold style={{ marginTop: 8 }}>사용 리포트</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => navigate('Settings' as any)}>
                        <View style={[styles.actionIcon, { backgroundColor: '#F59E0B15' }]}>
                            <Icon name="settings" size={24} color="#F59E0B" />
                        </View>
                        <Typography bold style={{ marginTop: 8 }}>설정</Typography>
                    </TouchableOpacity>
                </View>

                {/* Tabs for detailed view */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'HOME' && styles.activeTab]}
                        onPress={() => setActiveTab('HOME')}
                    >
                        <Typography bold={activeTab === 'HOME'} color={activeTab === 'HOME' ? Colors.primary : Colors.textSecondary}>가정용 설정</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'INSTITUTE' && styles.activeTab]}
                        onPress={() => setActiveTab('INSTITUTE')}
                    >
                        <Typography bold={activeTab === 'INSTITUTE'} color={activeTab === 'INSTITUTE' ? Colors.primary : Colors.textSecondary}>학원용 설정</Typography>
                    </TouchableOpacity>
                </View>

                {activeTab === 'HOME' ? (
                    <View style={styles.section}>
                        <Typography variant="h2" bold style={styles.sectionTitle}>오늘의 사용 제한</Typography>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <Typography color={Colors.textSecondary}>총 사용 시간</Typography>
                                <Typography bold>2시간 15분 / 3시간</Typography>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: '75%' }]} />
                            </View>
                        </View>

                        <Typography variant="h2" bold style={[styles.sectionTitle, { marginTop: 24 }]}>예약된 잠금</Typography>
                        {/* Placeholder for schedule list specific to child */}
                        <View style={styles.emptySchedule}>
                            <Typography variant="caption" color={Colors.textSecondary}>예약된 잠금이 없습니다.</Typography>
                        </View>
                    </View>
                ) : (
                    <View style={styles.section}>
                        <View style={styles.emptyState}>
                            <Icon name="school" size={40} color={Colors.textSecondary} />
                            <Typography color={Colors.textSecondary} style={{ marginTop: 12 }}>등록된 학원이 없습니다.</Typography>
                        </View>
                    </View>
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
        padding: 20,
        paddingBottom: 40,
    },
    statusCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusText: {
        flex: 1,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 16,
    },
    deviceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    actionButton: {
        flex: 1,
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        padding: 4,
        borderRadius: 12,
        marginBottom: 24,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: Colors.background,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    section: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sectionTitle: {
        marginBottom: 16,
    },
    infoCard: {
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: Colors.border,
        borderRadius: 4,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 4,
    },
    emptySchedule: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
