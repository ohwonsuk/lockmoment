import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Modal, TextInput, KeyboardAvoidingView, Linking } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';
import { StorageService } from '../services/StorageService';
import { NativeLockControl } from '../services/NativeLockControl';


import { useAlert } from '../context/AlertContext';

export const MyInfoScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const { showAlert, hideAlert } = useAlert();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [role, setRole] = useState<string | null>(null);
    const [deviceInfo, setDeviceInfo] = useState<any>(null);
    const [preventAppRemoval, setPreventAppRemoval] = useState(false);

    // PIN and Restriction State
    const [hasPin, setHasPin] = useState(false);
    const [isPinModalVisible, setIsPinModalVisible] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [isPinVerified, setIsPinVerified] = useState(false);
    const [isRestricted, setIsRestricted] = useState(false);

    useEffect(() => {
        loadData();
        return () => {
            // Reset verification when leaving screen
            setIsPinVerified(false);
        };
    }, []);

    const loadData = async () => {
        const profile = await AuthService.getUserProfile();
        setUserProfile(profile);

        const r = await StorageService.getUserRole();
        if (r) {
            setRole(r);
        } else if (profile?.role) {
            setRole(profile.role);
        }

        const prevent = await StorageService.getPreventAppRemoval();
        setPreventAppRemoval(prevent);

        const pinStatus = await StorageService.getHasPin();
        setHasPin(pinStatus);

        const restricted = await StorageService.isMyInfoRestricted();
        setIsRestricted(restricted);

        const data = await AuthService.getDeviceData();
        setDeviceInfo({
            ...data,
            appVersion: DeviceInfo.getVersion(),
        });

        // Trigger PIN modal if PIN is set and not verified
        if (pinStatus && !isPinVerified) {
            setIsPinModalVisible(true);
        }
    };

    const handleLogout = () => {
        showAlert({
            title: "로그아웃",
            message: "정말 로그아웃 하시겠습니까?",
            confirmText: "로그아웃",
            cancelText: "취소",
            type: 'warning',
            onConfirm: async () => {
                await AuthService.logout();
                navigate('Login');
            }
        });
    };

    const handleToggleRemoval = async (value: boolean) => {
        if (value && Platform.OS === 'android') {
            const isActive = await NativeLockControl.checkDeviceAdminActive();
            if (!isActive) {
                showAlert({
                    title: "권한 필요",
                    message: "앱 삭제 방지 기능을 사용하려면 기기 관리자 권한 활성화가 필요합니다.",
                    confirmText: "설정으로 이동",
                    cancelText: "취소",
                    onConfirm: () => NativeLockControl.requestDeviceAdmin(),
                    onCancel: () => setPreventAppRemoval(false)
                });
                return;
            }
        }
        setPreventAppRemoval(value);
        await StorageService.setPreventAppRemoval(value);
        await NativeLockControl.setPreventAppRemoval(value);
    };

    const handleContactUs = async () => {
        const subject = encodeURIComponent('[LockMoment] 문의하기');
        const body = encodeURIComponent(
            `\n\n--- 기기 정보 ---\n모델: ${deviceInfo?.model}\nOS: ${deviceInfo?.osVersion}\n앱 버전: ${deviceInfo?.appVersion}\n플랫폼: ${deviceInfo?.platform}`
        );
        const mailUrl = `mailto:lockmomentapp@gmail.com?subject=${subject}&body=${body}`;

        try {
            const supported = await Linking.canOpenURL(mailUrl);
            if (supported) {
                await Linking.openURL(mailUrl);
            } else {
                showAlert({
                    title: "문의하기 실패",
                    message: "메일 앱을 열 수 없습니다. lockmomentapp@gmail.com으로 문의해주세요.",
                    confirmText: "확인"
                });
            }
        } catch (error) {
            console.error("Failed to open mail client", error);
        }
    };

    const handlePinVerify = async () => {
        if (pinInput.length !== 6) return;

        const success = await AuthService.verifyPin(pinInput);
        if (success) {
            setIsPinVerified(true);
            setIsPinModalVisible(false);
            setPinInput('');
        } else {
            showAlert({
                title: "인증 실패",
                message: "비밀번호가 일치하지 않습니다.",
                confirmText: "확인"
            });
            setPinInput('');
        }
    };

    const isAnonymous = userProfile?.auth_provider === 'ANONYMOUS';

    if (isRestricted && (role === 'CHILD' || role === 'STUDENT')) {
        return (
            <View style={styles.container}>
                <Header title="내 정보" />
                <View style={styles.restrictedContainer}>
                    <Icon name="lock-closed" size={80} color={Colors.textSecondary} />
                    <Typography variant="h2" bold style={styles.restrictedTitle}>접근 권한이 제한되었습니다</Typography>
                    <Typography color={Colors.textSecondary} style={styles.restrictedText}>
                        부모님의 설정에 의해 이 화면의 접근이 제한되었습니다.
                    </Typography>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Header title="내 정보" />

            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Card */}
                <TouchableOpacity style={styles.profileCard} activeOpacity={0.7}>
                    <View style={styles.avatar}>
                        <Icon name="person" size={40} color="white" />
                    </View>
                    <View style={styles.profileInfo}>
                        <Typography variant="h2" bold>{isAnonymous ? '일반 사용자' : (userProfile?.name || '사용자')}</Typography>
                        {!isAnonymous && <Typography color={Colors.textSecondary}>{userProfile?.email || ''}</Typography>}
                        {(!isAnonymous && role) && (
                            <View style={styles.badgeRow}>
                                <View style={[styles.roleBadge, { backgroundColor: Colors.primary + '15' }]}>
                                    <Typography variant="caption" color={Colors.primary} bold>
                                        {role === 'PARENT' ? '부모' : (role === 'CHILD' || role === 'STUDENT' ? '자녀' : (role === 'TEACHER' ? '선생님' : role))}
                                    </Typography>
                                </View>
                            </View>
                        )}
                    </View>
                    <Icon name="chevron-forward" size={24} color={Colors.border} />
                </TouchableOpacity>

                {/* Settings Section */}
                <View style={styles.menuContainer}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => navigate('PersonalPreset')}>
                        <View style={styles.menuIcon}>
                            <Icon name="options-outline" size={24} color={Colors.text} />
                        </View>
                        <Typography style={styles.menuLabel}>개인 프리셋 관리</Typography>
                        <Icon name="chevron-forward" size={20} color={Colors.border} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => navigate('NotificationSettings')}>
                        <View style={styles.menuIcon}>
                            <Icon name="notifications-outline" size={24} color={Colors.text} />
                        </View>
                        <Typography style={styles.menuLabel}>알림 설정</Typography>
                        <Icon name="chevron-forward" size={20} color={Colors.border} />
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                        <TouchableOpacity style={styles.menuItem} onPress={() => navigate('AppLockSettings')}>
                            <View style={styles.menuIcon}>
                                <Icon name="lock-closed-outline" size={24} color={Colors.text} />
                            </View>
                            <Typography style={styles.menuLabel}>앱 잠금 설정</Typography>
                            <Icon name="chevron-forward" size={20} color={Colors.border} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.menuItem} onPress={() => { /* 도움말 로직 */ }}>
                        <View style={styles.menuIcon}>
                            <Icon name="help-circle-outline" size={24} color={Colors.text} />
                        </View>
                        <Typography style={styles.menuLabel}>도움말 / FAQ</Typography>
                        <Icon name="chevron-forward" size={20} color={Colors.border} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleContactUs}>
                        <View style={styles.menuIcon}>
                            <Icon name="mail-outline" size={24} color={Colors.text} />
                        </View>
                        <Typography style={styles.menuLabel}>문의하기</Typography>
                        <Icon name="chevron-forward" size={20} color={Colors.border} />
                    </TouchableOpacity>
                </View>

                {/* Legacy Functional Settings (Maintain previously added features) */}
                <Typography variant="caption" color={Colors.textSecondary} style={[styles.sectionTitle, { marginTop: 24 }]}>기타 설정</Typography>
                <View style={styles.menuContainer}>
                    <View style={styles.menuItem}>
                        <View style={styles.menuIcon}>
                            <Icon name="trash-outline" size={24} color={Colors.text} />
                        </View>
                        <Typography style={styles.menuLabel}>앱 삭제 방지</Typography>
                        <Switch
                            value={preventAppRemoval}
                            onValueChange={handleToggleRemoval}
                            trackColor={{ false: '#334155', true: Colors.primary }}
                            thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomWidth: 0 }]}
                        onPress={() => navigate('PinSettings')}
                    >
                        <View style={styles.menuIcon}>
                            <Icon name="key-outline" size={24} color={Colors.text} />
                        </View>
                        <Typography style={styles.menuLabel}>비밀번호(PIN) 설정</Typography>
                        <Icon name="chevron-forward" size={20} color={Colors.border} />
                    </TouchableOpacity>
                </View>

                {/* Account Section */}
                {!isAnonymous && (
                    <>
                        <View style={[styles.menuContainer, { marginTop: 24 }]}>
                            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
                                <View style={styles.menuIcon}>
                                    <Icon name="log-out-outline" size={24} color="#EF4444" />
                                </View>
                                <Typography style={[styles.menuLabel, { color: '#EF4444' }]} bold>로그아웃</Typography>
                                <Icon name="chevron-forward" size={20} color={Colors.border} />
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: 32 }}>
                    버전 {deviceInfo?.appVersion || '1.0.0'}
                </Typography>
            </ScrollView>

            {/* PIN Verification Modal */}
            <Modal
                visible={isPinModalVisible}
                transparent
                animationType="fade"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.pinContainer}>
                        <Icon name="lock-closed" size={48} color={Colors.primary} />
                        <Typography variant="h2" bold style={styles.pinTitle}>비밀번호 입력</Typography>
                        <Typography color={Colors.textSecondary} style={styles.pinSubtitle}>
                            내 정보 접근을 위해 6자리 PIN을 입력해주세요.
                        </Typography>

                        <TextInput
                            style={styles.pinInput}
                            value={pinInput}
                            onChangeText={(text) => {
                                const cleaned = text.replace(/[^0-9]/g, '');
                                if (cleaned.length <= 6) {
                                    setPinInput(cleaned);
                                }
                            }}
                            keyboardType="number-pad"
                            secureTextEntry
                            maxLength={6}
                            placeholder="••••••"
                            placeholderTextColor={Colors.border}
                            autoFocus
                        />

                        <TouchableOpacity
                            style={[styles.verifyButton, { opacity: pinInput.length === 6 ? 1 : 0.5 }]}
                            onPress={handlePinVerify}
                            disabled={pinInput.length !== 6}
                        >
                            <Typography color="white" bold>인증하기</Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                setIsPinModalVisible(false);
                                navigate('Dashboard'); // Kick back to home if cancelled
                            }}
                        >
                            <Typography color={Colors.textSecondary}>취소</Typography>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            }
        })
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    profileInfo: {
        flex: 1,
    },
    badgeRow: {
        flexDirection: 'row',
        marginTop: 6,
    },
    roleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    sectionTitle: {
        marginLeft: 8,
        marginBottom: 8,
        fontWeight: '600',
    },
    menuContainer: {
        backgroundColor: Colors.card,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuIcon: {
        width: 32,
        alignItems: 'center',
    },
    menuLabel: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
    },
    restrictedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    restrictedTitle: {
        marginTop: 24,
        textAlign: 'center',
    },
    restrictedText: {
        marginTop: 12,
        textAlign: 'center',
        lineHeight: 22,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pinContainer: {
        width: '100%',
        backgroundColor: Colors.card,
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
    },
    pinTitle: {
        marginTop: 16,
    },
    pinSubtitle: {
        marginTop: 8,
        textAlign: 'center',
        marginBottom: 24,
    },
    pinInput: {
        width: '100%',
        height: 60,
        backgroundColor: Colors.background,
        borderRadius: 16,
        paddingHorizontal: 20,
        fontSize: 24,
        textAlign: 'center',
        color: Colors.text,
        letterSpacing: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 24,
    },
    verifyButton: {
        width: '100%',
        height: 56,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        marginTop: 16,
        padding: 8,
    }
});
