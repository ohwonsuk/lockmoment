import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';
import { StorageService } from '../services/StorageService';

export const MyInfoScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [role, setRole] = useState('PARENT');
    const [deviceInfo, setDeviceInfo] = useState<any>(null);

    useEffect(() => {
        loadProfile();
        loadDeviceInfo();
    }, []);

    const loadProfile = async () => {
        const profile = await AuthService.getUserProfile();
        setUserProfile(profile);
        const r = await StorageService.getUserRole();
        if (r) setRole(r);
    };

    const loadDeviceInfo = async () => {
        const data = await AuthService.getDeviceData();
        setDeviceInfo({
            ...data,
            appVersion: DeviceInfo.getVersion(),
            bundleId: DeviceInfo.getBundleId()
        });
    };

    const handleLogout = () => {
        Alert.alert(
            "로그아웃",
            "정말 로그아웃 하시겠습니까?",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "로그아웃",
                    style: "destructive",
                    onPress: async () => {
                        await AuthService.logout();
                        navigate('Login');
                    }
                }
            ]
        );
    };

    const isAnonymous = userProfile?.auth_provider === 'ANONYMOUS';

    const menuItems = [
        ...(isAnonymous ? [
            {
                icon: 'phone-portrait-outline',
                label: '내 기기 정보',
                onPress: () => {
                    Alert.alert(
                        "기기 정보",
                        `모델: ${deviceInfo?.model}\nOS: ${deviceInfo?.osVersion}\n버전: ${deviceInfo?.appVersion}`
                    );
                }
            }
        ] : []),
        { icon: 'settings-outline', label: '앱 설정', onPress: () => navigate('Settings') },
        {
            icon: 'options-outline',
            label: '개인 프리셋 관리',
            onPress: () => navigate('PersonalPreset' as any)
        },
        { icon: 'notifications-outline', label: '알림 설정', onPress: () => navigate('NotificationSettings') },
        { icon: 'shield-checkmark-outline', label: '권한 관리', onPress: () => navigate('Permissions') },
        { icon: 'lock-closed-outline', label: '앱 잠금 설정', onPress: () => navigate('AppLockSettings') },
        { icon: 'help-circle-outline', label: '도움말 / FAQ', onPress: () => { } },
        { icon: 'mail-outline', label: '문의하기', onPress: () => { } },
    ];

    return (
        <View style={styles.container}>
            <Header title="내 정보" />

            <ScrollView contentContainerStyle={styles.content}>
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Icon name="person" size={40} color="white" />
                    </View>
                    <View style={styles.profileInfo}>
                        <Typography variant="h2" bold>{isAnonymous ? '일반 사용자' : (userProfile?.name || '사용자')}</Typography>
                        {!isAnonymous && <Typography color={Colors.textSecondary}>{userProfile?.email || ''}</Typography>}
                        <View style={styles.roleBadge}>
                            <Typography variant="caption" color={Colors.primary} bold>{role}</Typography>
                        </View>
                    </View>
                    {!isAnonymous && (
                        <TouchableOpacity onPress={() => navigate('Settings')}>
                            <Icon name="chevron-forward" size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Menu List */}
                <View style={styles.menuContainer}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
                            <View style={styles.menuIcon}>
                                <Icon name={item.icon} size={24} color={Colors.text} />
                            </View>
                            <Typography style={styles.menuLabel}>{item.label}</Typography>
                            <Icon name="chevron-forward" size={20} color={Colors.border} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout Button - Hidden for Anonymous */}
                {!isAnonymous && (
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Typography color="#EF4444" bold>로그아웃</Typography>
                    </TouchableOpacity>
                )}

                <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: 24 }}>
                    버전 {deviceInfo?.appVersion || '1.0.0'}
                </Typography>
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
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
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
    roleBadge: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    menuContainer: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuIcon: {
        width: 40,
        alignItems: 'center',
    },
    menuLabel: {
        flex: 1,
        marginLeft: 8,
    },
    logoutButton: {
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#EF444410',
        alignItems: 'center',
    },
});
