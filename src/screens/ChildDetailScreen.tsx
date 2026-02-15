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
    const [schedules, setSchedules] = useState<any[]>([]);
    const [usageStats, setUsageStats] = useState({ totalUsage: 0, limit: 0 });

    useEffect(() => {
        if (childId) {
            loadChildDetails();
        }
    }, [childId]);



    const loadChildDetails = async () => {
        setLoading(true);
        try {
            const [children, fetchedSchedules, stats] = await Promise.all([
                ParentChildService.getLinkedChildren(),
                ParentChildService.getChildSchedules(childId),
                ParentChildService.getChildUsageStats(childId)
            ]);

            const found = children.find(c => c.id === childId);
            if (found) setChild(found);
            else {
                Alert.alert("Error", "Child not found");
                goBack();
            }

            setSchedules(fetchedSchedules);
            setUsageStats(stats);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLock = () => {
        // Navigate to QR Generator for lock settings
        navigate('QRGenerator', { childId: childId });
    };

    const handleToggleSchedule = async (scheduleId: string, currentStatus: boolean) => {
        try {
            // Optimistic update
            setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, isActive: !currentStatus } : s));

            const result = await ParentChildService.toggleChildScheduleStatus(childId, scheduleId, !currentStatus);
            if (!result.success) {
                // Revert on failure
                setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, isActive: currentStatus } : s));
                Alert.alert("오류", result.message || "스케줄 상태 변경에 실패했습니다.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("오류", "네트워크 오류가 발생했습니다.");
        }
    };

    const handleDeleteSchedule = (scheduleId: string) => {
        Alert.alert("스케줄 삭제", "정말로 이 스케줄을 삭제하시겠습니까?", [
            { text: "취소", style: "cancel" },
            {
                text: "삭제",
                style: "destructive",
                onPress: async () => {
                    const result = await ParentChildService.deleteChildSchedule(childId, scheduleId);
                    if (result.success) {
                        loadChildDetails();
                    } else {
                        Alert.alert("오류", result.message);
                    }
                }
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

    // Prepare usage stats for display
    const usageHours = Math.floor(usageStats.totalUsage / 60);
    const usageMins = usageStats.totalUsage % 60;
    const limitHours = Math.floor(usageStats.limit / 60);
    const progressPercent = usageStats.limit > 0 ? (usageStats.totalUsage / usageStats.limit) * 100 : 0;

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
                            <Typography bold color={Colors.primary} style={{ marginBottom: 2 }}>{child.childName || '자녀'}</Typography>
                            <Typography variant="h2" bold>{child.status === 'LOCKED' ? '잠금 활성화' : '잠금 해제됨'}</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>
                                {child.status === 'LOCKED' ? '현재 집중 모드가 켜져있습니다.' : '자유롭게 기기를 사용 중입니다.'}
                            </Typography>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.deviceInfo}>
                        <Icon name="phone-portrait" size={16} color={Colors.textSecondary} />
                        <Typography variant="caption" color={Colors.textSecondary}>
                            {child.deviceName || 'Unknown Platform'} {child.deviceModel ? `(${child.deviceModel})` : ''}
                        </Typography>
                    </View>
                </View>

                {/* Device Change Notice / Action */}
                <View style={styles.relinkNotice}>
                    <Icon name="information-circle-outline" size={20} color={Colors.primary} />
                    <Typography style={styles.relinkText}>
                        기기를 변경하셨나요? {'\n'}
                        자녀 휴대폰에서 새로운 연결 QR을 스캔하면 자동으로 기기 정보가 갱신됩니다.
                    </Typography>
                    <TouchableOpacity
                        style={styles.relinkButton}
                        onPress={() => navigate('LinkSubUser' as any, { role: 'PARENT', autoOpen: 'CHILD', autoName: child.childName })}
                    >
                        <Typography bold color={Colors.primary} style={{ fontSize: 13 }}>연결 QR 생성</Typography>
                    </TouchableOpacity>
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
                                <Typography bold>{usageHours}시간 {usageMins}분 / {limitHours}시간</Typography>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${Math.min(progressPercent, 100)}%`, backgroundColor: progressPercent > 100 ? '#EF4444' : Colors.primary }]} />
                            </View>
                            {progressPercent > 100 && (
                                <Typography variant="caption" style={{ textAlign: 'right', color: '#EF4444' }}>
                                    사용 제한 시간을 초과했습니다.
                                </Typography>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 }}>
                            <Typography variant="h2" bold>예약된 잠금</Typography>
                            <TouchableOpacity onPress={() => navigate('ScheduleEdit', { childId: child.id, mode: 'CREATE' })}>
                                <Icon name="add-circle" size={24} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>

                        {schedules.length === 0 ? (
                            <View style={styles.emptySchedule}>
                                <Icon name="calendar-outline" size={40} color={Colors.textSecondary} />
                                <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 8 }}>
                                    등록된 스케줄이 없습니다.{'\n'}
                                    규칙적인 습관을 위해 스케줄을 추가해보세요.
                                </Typography>
                            </View>
                        ) : (
                            <View style={{ gap: 12 }}>
                                {schedules.map(schedule => {
                                    const startTime = schedule.startTime ? schedule.startTime.substring(0, 5) : "--:--";
                                    const endTime = schedule.endTime ? schedule.endTime.substring(0, 5) : "--:--";
                                    const daysDisplay = Array.isArray(schedule.days) ? schedule.days.map((d: string) => {
                                        const map: Record<string, string> = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
                                        return map[d] || d;
                                    }).join(' ') : "";

                                    return (
                                        <TouchableOpacity
                                            key={schedule.id}
                                            style={styles.scheduleItem}
                                            onPress={() => navigate('ScheduleEdit', { childId: child.id, scheduleId: schedule.id, mode: 'EDIT', scheduleData: schedule })}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                    <Typography bold>{schedule.name}</Typography>
                                                    {schedule.lockType === 'FULL' && (
                                                        <View style={styles.badge}><Typography style={styles.badgeText}>전체 잠금</Typography></View>
                                                    )}
                                                </View>
                                                <Typography variant="h2" style={{ marginBottom: 4 }}>{startTime} ~ {endTime}</Typography>
                                                <Typography variant="caption" color={Colors.textSecondary}>{daysDisplay}</Typography>
                                            </View>
                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleToggleSchedule(schedule.id, schedule.isActive); }}>
                                                <Icon name={schedule.isActive ? "toggle" : "toggle-outline"} size={32} color={schedule.isActive ? Colors.primary : Colors.textSecondary} />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
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
    relinkNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '10',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
    },
    relinkText: {
        flex: 1,
        fontSize: 12,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    relinkButton: {
        backgroundColor: Colors.background,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.primary,
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
    scheduleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    badge: {
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        color: Colors.primary,
        fontWeight: '700',
    },
});
