import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { NativeLockControl } from '../services/NativeLockControl';
import { useAppNavigation } from '../navigation/NavigationContext';

export const AppLockSettingsScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [hasSelection, setHasSelection] = useState(false);
    const [appCount, setAppCount] = useState(0);
    const [categoryCount, setCategoryCount] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadSelectionStatus();

        // Debug: Check authorization status
        const checkAuth = async () => {
            try {
                const status = await NativeLockControl.checkAuthorization();
                console.log('[AppLockSettings] Authorization Status:', status, '(0=notDetermined, 1=denied, 2=approved)');
            } catch (e) {
                console.error('[AppLockSettings] Auth check failed:', e);
            }
        };
        checkAuth();
    }, []);

    const loadSelectionStatus = async () => {
        // Native side should provide this info
        try {
            if (typeof NativeLockControl.getSelectedCategoryCount !== 'function') {
                console.warn('[AppLockSettings] getSelectedCategoryCount is not a function');
                const aCount = await NativeLockControl.getSelectedAppCount();
                setAppCount(aCount);
                setHasSelection(aCount > 0);
                return;
            }

            const [aCount, cCount] = await Promise.all([
                NativeLockControl.getSelectedAppCount(),
                NativeLockControl.getSelectedCategoryCount()
            ]);
            setAppCount(aCount);
            setCategoryCount(cCount);
            setHasSelection((aCount + cCount) > 0);
        } catch (error) {
            console.error('[AppLockSettings] Failed to load status:', error);
        }
    };

    const handleSelectApps = async () => {
        try {
            // iOS specific: presentFamilyActivityPicker
            if (Platform.OS === 'ios') {
                const result = await NativeLockControl.presentFamilyActivityPicker('APP');
                if (result) {
                    await loadSelectionStatus();
                }
            } else {
                // Android: Maybe show app list or just alert for now
                Alert.alert("알림", "안드로이드는 현재 모든 앱을 잠금 범위로 설정할 수 있습니다.");
            }
        } catch (error: any) {
            console.error('[AppLockSettings] Picker error:', error);
            if (error?.code === 'AUTH_REQUIRED') {
                Alert.alert(
                    "권한 필요",
                    "스크린타임 권한이 필요합니다. 권한을 요청하시겠습니까?",
                    [
                        { text: "취소", style: "cancel" },
                        {
                            text: "권한 요청",
                            onPress: async () => {
                                try {
                                    await NativeLockControl.requestAuthorization();
                                    // After authorization, try again
                                    handleSelectApps();
                                } catch (authError) {
                                    Alert.alert("오류", "권한 요청에 실패했습니다.");
                                }
                            }
                        }
                    ]
                );
            } else if (error?.code === 'SIMULATOR_ERROR') {
                Alert.alert("시뮬레이터 오류", "iOS 시뮬레이터에서는 스크린타임 API가 동작하지 않습니다. 실제 기기에서 테스트해주세요.");
            } else if (error?.code === 'AUTH_ERROR') {
                Alert.alert("권한 오류", "스크린타임 권한이 필요합니다. 설정 > 스크린타임에서 앱 사용 제한을 허용해주세요.");
            } else {
                Alert.alert("오류", "설정 화면을 열 수 없습니다.");
            }
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // In a real scenario, the picker might have already saved the selection natively.
            // But we can add a confirmation here.
            setTimeout(() => {
                setIsSaving(false);
                Alert.alert("저장 완료", "잠금 대상 앱/카테고리가 저장되었습니다. 이제 잠금을 설정할 수 있습니다.", [
                    { text: "확인", onPress: () => navigate('MyInfo') }
                ]);
            }, 500);
        } catch (error) {
            setIsSaving(false);
            Alert.alert("오류", "저장에 실패했습니다.");
        }
    };

    return (
        <View style={styles.container}>
            <Header title="앱 잠금 설정" showBack />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerTextSection}>
                    <Typography variant="h2" bold style={{ marginBottom: 8 }}>
                        잠금기능을 사용하기 위해
                    </Typography>
                    <Typography variant="h2" bold color={Colors.primary}>
                        잠금 대상 앱/카테고리를 선택해주세요
                    </Typography>
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Typography variant="body" color={Colors.textSecondary} style={{ lineHeight: 22 }}>
                        iOS 정책에 따라, 앱에서 잠금기능을 사용하기 위해서는 사용자가 {Platform.OS === 'ios' ? '아래 버튼을 눌러 나오는 시스템 화면에서' : ''} 미리 차단 가능한 앱의 목록을 선택하고 동의해야 합니다.
                    </Typography>
                    <Typography variant="caption" color={Colors.primary} style={{ marginTop: 12, fontWeight: 'bold' }}>
                        * 이 과정에서 실제로 앱이 잠기지는 않습니다.
                    </Typography>
                </View>

                {/* Status Banner */}
                <View style={[styles.statusBanner, hasSelection ? styles.statusBannerSuccess : styles.statusBannerWarning]}>
                    <Icon
                        name={hasSelection ? 'checkmark-circle' : 'warning'}
                        size={24}
                        color={hasSelection ? '#10B981' : '#F59E0B'}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Typography bold color={hasSelection ? '#10B981' : '#F59E0B'}>
                            {hasSelection ? '잠금 대상 설정 완료' : '잠금 대상이 설정되지 않았어요'}
                        </Typography>
                        <Typography variant="caption" color={hasSelection ? '#10B981' : '#F59E0B'}>
                            {hasSelection
                                ? '잠금을 이 범위 내에서 설정할 수 있어요'
                                : '선택하지 않으면 예약 잠금을 설정할 수 없어요'}
                        </Typography>
                    </View>
                </View>

                {/* Main Action Area */}
                <View style={styles.actionSection}>
                    <Typography variant="h2" bold style={{ marginBottom: 16 }}>설정 방법</Typography>

                    <View style={styles.stepItem}>
                        <View style={styles.stepNumber}><Typography bold color="#FFF">1</Typography></View>
                        <Typography style={{ flex: 1, marginLeft: 12 }}>
                            아래 '차단 대상 선택하기' 버튼을 누릅니다.
                        </Typography>
                    </View>

                    <View style={styles.stepItem}>
                        <View style={styles.stepNumber}><Typography bold color="#FFF">2</Typography></View>
                        <Typography style={{ flex: 1, marginLeft: 12 }}>
                            상단의 '카테고리' 또는 개별 '앱' 탭에서 잠그고 싶은 항목들을 체크합니다.
                        </Typography>
                    </View>

                    <View style={styles.stepItem}>
                        <View style={styles.stepNumber}><Typography bold color="#FFF">3</Typography></View>
                        <Typography style={{ flex: 1, marginLeft: 12 }}>
                            우측 상단의 '완료' 버튼을 눌러 설정을 마칩니다.
                        </Typography>
                    </View>

                    <TouchableOpacity style={styles.mainActionBtn} onPress={handleSelectApps}>
                        <Icon name="apps" size={24} color="#FFF" />
                        <Typography bold color="#FFF" style={{ marginLeft: 10, fontSize: 18 }}>
                            {hasSelection ? '잠금 대상 변경하기' : '잠금 대상 선택하기'}
                        </Typography>
                    </TouchableOpacity>
                </View>

                {/* Results Card */}
                {hasSelection && (
                    <View style={styles.resultsCard}>
                        <Typography variant="h2" bold style={{ marginBottom: 16 }}>선택된 항목</Typography>
                        <View style={styles.resultRow}>
                            <View style={styles.resultLabel}>
                                <Icon name="grid-outline" size={20} color={Colors.primary} />
                                <Typography style={{ marginLeft: 8 }}>카테고리</Typography>
                            </View>
                            <Typography bold>{categoryCount}개</Typography>
                        </View>
                        <View style={styles.resultRow}>
                            <View style={styles.resultLabel}>
                                <Icon name="apps-outline" size={20} color={Colors.primary} />
                                <Typography style={{ marginLeft: 8 }}>개별 앱</Typography>
                            </View>
                            <Typography bold>{appCount}개</Typography>
                        </View>
                    </View>
                )}

                <View style={styles.bottomNotice}>
                    <Icon name="information-circle-outline" size={18} color={Colors.textSecondary} />
                    <Typography variant="caption" color={Colors.textSecondary} style={{ marginLeft: 6, flex: 1 }}>
                        iOS에서는 시스템 보안상 실제 선택은 애플에서 제공하는 설정 화면에서 직접 완료해야 합니다.
                    </Typography>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveBtn, (!hasSelection || isSaving) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!hasSelection || isSaving}
                >
                    <Typography bold color="#FFF">{isSaving ? '저장 중...' : '확인 완료'}</Typography>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { padding: 20, paddingBottom: 160 },
    headerTextSection: { marginBottom: 24 },
    infoCard: {
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
    },
    statusBannerWarning: {
        backgroundColor: '#F59E0B15',
        borderColor: '#F59E0B30',
    },
    statusBannerSuccess: {
        backgroundColor: '#10B98115',
        borderColor: '#10B98130',
    },
    actionSection: {
        backgroundColor: Colors.card,
        padding: 24,
        borderRadius: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        marginTop: 12,
        elevation: 4,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    resultsCard: {
        backgroundColor: Colors.card,
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border + '50',
    },
    resultLabel: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bottomNotice: {
        flexDirection: 'row',
        marginTop: 30,
        paddingHorizontal: 10,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: Colors.background,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    saveBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    saveBtnDisabled: {
        backgroundColor: Colors.border,
    },
});
