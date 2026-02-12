import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { QuickLockCard } from '../components/QuickLockCard';
import { Typography } from '../components/Typography';
import { NativeLockControl } from '../services/NativeLockControl';
import { useAppNavigation } from '../navigation/NavigationContext';
import { QuickLockPicker } from '../components/QuickLockPicker';
import { Icon } from '../components/Icon';
import { StorageService, Schedule } from '../services/StorageService';
import { useAlert } from '../context/AlertContext';
import { WeeklySchedule } from '../components/WeeklySchedule';
import { AuthService } from '../services/AuthService';
import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { PresetService, Preset } from '../services/PresetService';
import { PresetItem } from '../components/PresetItem';

export const DashboardScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const { showAlert } = useAlert();
    const [isLocked, setIsLocked] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [endTimeDate, setEndTimeDate] = useState<Date | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [userRole, setUserRole] = useState<string>('STUDENT');
    const [viewMode, setViewMode] = useState<'PERSONAL' | 'ADMIN'>('PERSONAL');
    const [recommendedPresets, setRecommendedPresets] = useState<Preset[]>([]);
    const [isApplyingPreset, setIsApplyingPreset] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        loadUserRole();
        refreshAll();
        restoreLock();
        timerRef.current = setInterval(updateStatus, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const loadUserRole = async () => {
        const role = await StorageService.getUserRole();
        if (role) {
            setUserRole(role);
            // If parent/teacher, they might want to see Admin by default or after switching
            if (role === 'PARENT' || role === 'TEACHER') {
                // setViewMode('ADMIN'); // Optional: decide default
            }
        }
    };

    const updateStatus = async () => {
        try {
            const locked = await NativeLockControl.isLocked();
            setIsLocked(locked);
            if (locked) {
                const remaining = await NativeLockControl.getRemainingTime();
                setRemainingTime(remaining);
                setEndTimeDate(new Date(Date.now() + remaining));
                if (remaining <= 0) {
                    await NativeLockControl.stopLock();
                    setIsLocked(false);
                }
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const refreshAll = () => {
        checkPermission();
        loadSchedules();
        updateStatus();
        if (userRole === 'PARENT' || userRole === 'TEACHER') {
            loadChildren();
            loadPresets();
        }
    };

    const loadPresets = async () => {
        const presets = await PresetService.getRecommendedPresets();
        setRecommendedPresets(presets);
    };

    const loadChildren = async () => {
        const data = await ParentChildService.getLinkedChildren();
        setChildren(data);
    };

    const restoreLock = async () => {
        try {
            await NativeLockControl.restoreLockState();
            updateStatus();
        } catch (error) {
            console.error('Failed to restore lock state:', error);
        }
    };

    const loadSchedules = async () => {
        const storedSchedules = await StorageService.getSchedules();
        setSchedules(storedSchedules);
    };

    const checkPermission = async () => {
        if (Platform.OS === 'android') {
            const perm = await NativeLockControl.checkAccessibilityPermission();
            setHasPermission(perm);
            AuthService.syncPermissions({ accessibility: perm });
        } else {
            const authStatus = await NativeLockControl.checkAuthorization();
            setHasPermission(authStatus === 2);
            AuthService.syncPermissions({ screenTime: authStatus === 2 });
        }
    };

    const handleQuickLock = async () => {
        if (!hasPermission) {
            navigate('Permissions');
            return;
        }
        setIsPickerVisible(true);
    };

    const handleQuickLockConfirm = async (h: number, m: number, type: 'APP' | 'FULL', packagesJson?: string) => {
        setIsPickerVisible(false);
        try {
            const prevent = await StorageService.getPreventAppRemoval();
            const durationMs = (h * 3600 + m * 60) * 1000;
            await NativeLockControl.startLock(durationMs, type, "바로 잠금", packagesJson, prevent);
            updateStatus();
        } catch (error: any) {
            showAlert({ title: "오류", message: error.message });
        }
    };

    const handleStopLock = async () => {
        showAlert({
            title: "잠금 조기 종료",
            message: "관리자 권한으로 잠금을 종료하시겠습니까?",
            confirmText: "종료",
            cancelText: "취소",
            onConfirm: async () => {
                await NativeLockControl.stopLock();
                updateStatus();
            }
        });
    };

    const handleToggleSchedule = async (id: string) => {
        const schedule = schedules.find(s => s.id === id);
        if (schedule) {
            if (schedule.isActive) {
                await NativeLockControl.cancelAlarm(id);
            } else {
                const prevent = await StorageService.getPreventAppRemoval();
                let normalizedType = (schedule.lockType || 'APP').toUpperCase();
                if (normalizedType === 'PHONE') normalizedType = 'FULL';
                if (normalizedType === 'APP_ONLY') normalizedType = 'APP';

                await NativeLockControl.scheduleAlarm(
                    id, schedule.startTime, schedule.endTime, schedule.days,
                    normalizedType as any, schedule.name,
                    JSON.stringify(schedule.lockedApps || []), prevent
                );
            }
            await StorageService.toggleScheduleActivity(id);
            loadSchedules();
        }
    };

    const handleGenerateScheduleQR = (id: string) => {
        (globalThis as any).editingScheduleId = id;
        navigate('AddSchedule' as any, { showQR: true });
    };

    const handleApplyPreset = async (preset: Preset) => {
        if (children.length === 0) {
            showAlert({ title: "알림", message: "잠금을 적용할 연결된 자녀가 없습니다." });
            return;
        }

        showAlert({
            title: "Preset 즉시 적용",
            message: `[${preset.name}] 정책을 모든 자녀에게 즉시 적용하시겠습니까?`,
            confirmText: "적용",
            cancelText: "취소",
            onConfirm: async () => {
                setIsApplyingPreset(true);
                try {
                    let successCount = 0;
                    for (const child of children) {
                        const res = await PresetService.applyPreset(preset.id, {
                            target_type: 'STUDENT',
                            target_id: child.id,
                        });
                        if (res.success) successCount++;
                    }
                    showAlert({
                        title: "적용 완료",
                        message: `${successCount}명의 자녀에게 [${preset.name}] 정책이 적용되었습니다.`
                    });
                } catch (error) {
                    console.error("Apply Preset Failed:", error);
                    showAlert({ title: "오류", message: "Preset 적용 중 오류가 발생했습니다." });
                } finally {
                    setIsApplyingPreset(false);
                }
            }
        });
    };

    const formatTime = (ms: number) => {
        const totalSec = Math.ceil(ms / 1000);
        const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const renderAdminDashboard = () => (
        <View style={styles.container}>
            <Header title={userRole === 'PARENT' ? '학부모 관리' : '교사 관리'} hasPermission={hasPermission} />

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, viewMode === 'PERSONAL' && styles.activeTab]}
                    onPress={() => setViewMode('PERSONAL')}
                >
                    <Typography bold={viewMode === 'PERSONAL'} color={viewMode === 'PERSONAL' ? Colors.primary : Colors.textSecondary}>내 잠금</Typography>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, viewMode === 'ADMIN' && styles.activeTab]}
                    onPress={() => setViewMode('ADMIN')}
                >
                    <Typography bold={viewMode === 'ADMIN'} color={viewMode === 'ADMIN' ? Colors.primary : Colors.textSecondary}>관리 대시보드</Typography>
                </TouchableOpacity>
            </View>

            {viewMode === 'ADMIN' ? (
                <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent}>
                    {/* 추천 Preset 섹션 추가 */}
                    {recommendedPresets.length > 0 && (
                        <View style={styles.presetSection}>
                            <View style={styles.sectionHeader}>
                                <Typography bold>추천 Preset 빠른 적용</Typography>
                                <Icon name="flash" size={16} color="#FFD700" />
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetList}>
                                {recommendedPresets.map(preset => (
                                    <PresetItem
                                        key={preset.id}
                                        preset={preset}
                                        onPress={handleApplyPreset}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.adminGrid}>
                        <AdminMenuItem
                            icon="qr-code-outline"
                            title="QR 생성"
                            subtitle="잠금/연결 QR"
                            onPress={() => navigate('QRGenerator' as any)}
                            color="#6366F1"
                        />
                        <AdminMenuItem
                            icon="calendar-outline"
                            title="스케줄 관리"
                            subtitle="전체 예약 내역 확인"
                            onPress={() => navigate('AdminSchedule' as any)}
                            color="#8B5CF6"
                        />
                        <AdminMenuItem
                            icon="pulse-outline"
                            title="현재 상태"
                            subtitle="대상 실시간 상태"
                            onPress={() => { /* Navigate to Status screen */ }}
                            color="#10B981"
                        />
                        <AdminMenuItem
                            icon="time-outline"
                            title="이력"
                            subtitle="잠금 및 접속 통계"
                            onPress={() => navigate('History' as any)}
                            color="#F59E0B"
                        />
                        <AdminMenuItem
                            icon="lock-open-outline"
                            title="강제 해제"
                            subtitle="원격 잠금 해제"
                            onPress={() => { /* Implement Force Unlock */ }}
                            color="#EF4444"
                        />
                        <AdminMenuItem
                            icon="people-outline"
                            title="대상 관리"
                            subtitle={userRole === 'PARENT' ? '자녀 및 보호자 관리' : '학생/반 관리'}
                            onPress={() => navigate('LinkSubUser' as any, { role: userRole })}
                            color="#EC4899"
                        />
                    </View>

                    <View style={styles.sectionHeader}>
                        <Typography variant="h2" bold>관리 대상 리스트</Typography>
                    </View>

                    {children.length > 0 ? (
                        <View style={styles.childrenList}>
                            {children.map((child) => (
                                <View key={child.id} style={styles.childCard}>
                                    <View style={styles.childInfo}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Typography bold style={{ fontSize: 16 }}>{child.childName}</Typography>
                                            <View style={[styles.permissionBadge, {
                                                backgroundColor: child.hasPermission === true ? '#10B98115' : child.hasPermission === false ? '#EF444415' : '#6B728015'
                                            }]}>
                                                <Icon
                                                    name={child.hasPermission === true ? "checkmark-circle" : child.hasPermission === false ? "close-circle" : "help-circle"}
                                                    size={12}
                                                    color={child.hasPermission === true ? '#10B981' : child.hasPermission === false ? '#EF4444' : '#6B7280'}
                                                />
                                            </View>
                                        </View>
                                        <Typography variant="caption" color={Colors.textSecondary}>{child.deviceName || '알 수 없는 기기'}</Typography>
                                    </View>
                                    <View style={styles.childStatus}>
                                        <View style={[styles.statusDot, { backgroundColor: child.status === 'LOCKED' ? Colors.primary : Colors.textSecondary }]} />
                                        <Typography variant="caption" bold color={child.status === 'LOCKED' ? Colors.primary : Colors.textSecondary}>
                                            {child.status === 'LOCKED' ? '잠금 중' : '해제됨'}
                                        </Typography>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.childActionBtn}
                                        onPress={() => { /* Detail view or remote lock */ }}
                                    >
                                        <Icon name="ellipsis-vertical" size={20} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity
                                style={styles.addMoreBtn}
                                onPress={() => navigate('LinkSubUser' as any)}
                            >
                                <Icon name="add-circle-outline" size={20} color={Colors.primary} />
                                <Typography color={Colors.primary} bold style={{ marginLeft: 6 }}>대상 추가 등록</Typography>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Typography color={Colors.textSecondary}>등록된 관리 대상이 없습니다.</Typography>
                            <TouchableOpacity
                                style={styles.inlineAddButton}
                                onPress={() => navigate('LinkSubUser' as any)}
                            >
                                <Typography color={Colors.primary} bold>지금 등록하기</Typography>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            ) : (
                renderPersonalDashboard()
            )}
        </View>
    );

    const renderPersonalDashboard = () => (
        <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {isLocked ? (
                <View style={styles.activeLockCard}>
                    <View style={styles.activeLockHeader}>
                        <View style={styles.statusBadge}>
                            <View style={styles.statusDot} />
                            <Typography variant="caption" bold color={Colors.primary}>집중 모드 동작 중</Typography>
                        </View>
                        <TouchableOpacity onPress={handleStopLock}>
                            <Typography variant="caption" color={Colors.textSecondary}>관리자 종료</Typography>
                        </TouchableOpacity>
                    </View>
                    <Typography style={styles.remainingTimeText}>{formatTime(remainingTime)}</Typography>
                    {endTimeDate && (
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: -10, marginBottom: 30 }}>
                            종료예정 {endTimeDate.getHours()}:{endTimeDate.getMinutes().toString().padStart(2, '0')}
                        </Typography>
                    )}
                </View>
            ) : (
                <>
                    <QuickLockCard onPress={handleQuickLock} />
                    <View style={styles.qrActions}>
                        <TouchableOpacity style={styles.qrActionButton} onPress={() => navigate('QRScanner' as any)}>
                            <View style={[styles.qrIconBadge, { backgroundColor: '#4F46E520' }]}>
                                <Icon name="scan" size={24} color="#6366F1" />
                            </View>
                            <Typography variant="caption" bold>QR 스캔 잠금</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.qrActionButton} onPress={() => navigate('QRGenerator' as any)}>
                            <View style={[styles.qrIconBadge, { backgroundColor: '#EC489920' }]}>
                                <Icon name="qr-code" size={24} color="#F472B6" />
                            </View>
                            <Typography variant="caption" bold>내 QR 생성</Typography>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            <QuickLockPicker
                isVisible={isPickerVisible}
                onClose={() => setIsPickerVisible(false)}
                onConfirm={handleQuickLockConfirm}
            />

            <View style={styles.sectionHeader}>
                <Typography variant="h2" bold>주간 예약 스케줄</Typography>
                <TouchableOpacity style={styles.addButton} onPress={() => {
                    (globalThis as any).editingScheduleId = null;
                    navigate('AddSchedule');
                }}>
                    <Icon name="add" size={16} color={Colors.primary} />
                    <Typography color={Colors.primary} bold style={styles.addButtonText}>예약 추가</Typography>
                </TouchableOpacity>
            </View>

            <WeeklySchedule
                schedules={schedules}
                onPressItem={(id) => {
                    (globalThis as any).editingScheduleId = id;
                    navigate('AddSchedule');
                }}
                onToggle={handleToggleSchedule}
                onGenerateQR={handleGenerateScheduleQR}
            />

            <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigate('Settings')}>
                    <Typography color={Colors.textSecondary} variant="caption">기관 및 관리자 모드 설정</Typography>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    if (userRole === 'PARENT' || userRole === 'TEACHER') return renderAdminDashboard();

    return (
        <View style={styles.container}>
            <Header hasPermission={hasPermission} />
            {renderPersonalDashboard()}
        </View>
    );
};

interface AdminMenuItemProps {
    icon: string;
    title: string;
    subtitle: string;
    onPress: () => void;
    color: string;
}

const AdminMenuItem: React.FC<AdminMenuItemProps> = ({ icon, title, subtitle, onPress, color }) => (
    <TouchableOpacity style={styles.adminMenuItem} onPress={onPress}>
        <View style={[styles.adminIconBadge, { backgroundColor: color + '15' }]}>
            <Icon name={icon} size={24} color={color} />
        </View>
        <View style={styles.adminMenuText}>
            <Typography bold style={{ fontSize: 16 }}>{title}</Typography>
            <Typography variant="caption" color={Colors.textSecondary}>{subtitle}</Typography>
        </View>
        <Icon name="chevron-forward" size={20} color={Colors.border} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    flex1: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        marginHorizontal: 20,
        marginTop: 10,
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: Colors.background,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    adminGrid: {
        paddingHorizontal: 20,
        marginTop: 20,
        gap: 12,
    },
    adminMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    adminIconBadge: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    adminMenuText: {
        flex: 1,
        marginLeft: 16,
    },
    activeLockCard: {
        backgroundColor: Colors.card,
        marginHorizontal: 20,
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
        alignItems: 'center',
    },
    activeLockHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        marginBottom: 20,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
    },
    remainingTimeText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 30,
        marginBottom: 10,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    addButtonText: {
        fontSize: 14,
    },
    inlineAddButton: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: Colors.primary + '15',
        borderRadius: 8,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    footer: {
        marginTop: 40,
        marginBottom: 20,
        alignItems: 'center',
    },
    qrActions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginTop: 12,
    },
    qrActionButton: {
        flex: 1,
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 8,
    },
    qrIconBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    childrenList: {
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 20,
    },
    childCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    childInfo: {
        flex: 1,
    },
    childStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginRight: 12,
    },
    childActionBtn: {
        padding: 4,
    },
    addMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: Colors.primary + '60',
        borderRadius: 16,
        marginTop: 8,
    },
    permissionBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    presetSection: {
        width: '100%',
        paddingVertical: 10,
        paddingBottom: 20,
    },
    presetList: {
        paddingHorizontal: 20,
        gap: 12,
    },
});
