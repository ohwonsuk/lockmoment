import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';
import DeviceInfo from 'react-native-device-info';

import { Icon } from '../components/Icon';
import { useAlert } from '../context/AlertContext';

const MenuItem: React.FC<{ title: string; icon: string; onPress: () => void; rightElement?: React.ReactNode }> = ({ title, icon, onPress, rightElement }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <View style={styles.menuLeft}>
            <Icon name={icon} size={22} color={Colors.primary} style={styles.menuIcon} />
            <Typography variant="body">{title}</Typography>
        </View>
        {rightElement || <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />}
    </TouchableOpacity>
);

export const SettingsScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const { showAlert } = useAlert();
    const [deviceData, setDeviceData] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await AuthService.getDeviceData();
        setDeviceData({
            ...data,
            appVersion: DeviceInfo.getVersion(),
        });
    };

    const handleContactUs = async () => {
        const subject = encodeURIComponent('[LockMoment] 문의하기');
        const body = encodeURIComponent(
            `\n\n--- 기기 정보 ---\n모델: ${deviceData?.model}\nOS: ${deviceData?.osVersion}\n앱 버전: ${deviceData?.appVersion}\n플랫폼: ${deviceData?.platform}`
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

    const showDeviceInfo = () => {
        showAlert({
            title: "기기 정보",
            message: `기기 모델: ${deviceData?.model}\nOS 버전: ${deviceData?.osVersion}\n앱 버전: ${deviceData?.appVersion}\n기기 ID: ${deviceData?.deviceId}`,
            confirmText: "확인"
        });
    };

    return (
        <View style={styles.container}>
            <Header showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h1" bold style={styles.title}>환경설정</Typography>

                <View style={styles.section}>
                    <MenuItem
                        title="앱 권한설정"
                        icon="shield-checkmark"
                        onPress={() => navigate('Permissions')}
                    />
                    <MenuItem
                        title="잠금 기능 사용 이력"
                        icon="time"
                        onPress={() => navigate('History')}
                    />
                </View>

                <View style={styles.section}>
                    <MenuItem
                        title="알림 설정"
                        icon="notifications"
                        onPress={() => navigate('NotificationSettings')}
                    />
                    <MenuItem
                        title="내 기기 정보"
                        icon="phone-portrait"
                        onPress={showDeviceInfo}
                    />
                    <MenuItem
                        title="문의하기"
                        icon="mail"
                        onPress={handleContactUs}
                    />
                    <MenuItem title="도움말" icon="help-circle" onPress={() => { }} />
                    <MenuItem
                        title="버전 정보"
                        icon="information-circle"
                        onPress={() => { }}
                        rightElement={
                            <Typography variant="body" color={Colors.textSecondary}>
                                v{deviceData?.appVersion || '1.0.0'}
                            </Typography>
                        }
                    />
                </View>
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
    section: {
        backgroundColor: Colors.card,
        marginTop: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.border,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuIcon: {
        marginRight: 12,
    },
});
