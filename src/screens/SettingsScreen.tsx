import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { useAppNavigation } from '../navigation/NavigationContext';
import { StorageService } from '../services/StorageService';
import { NativeLockControl } from '../services/NativeLockControl';

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
    const [preventAppRemoval, setPreventAppRemoval] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const val = await StorageService.getPreventAppRemoval();
        setPreventAppRemoval(val);
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
                // We don't set it true yet, user must go to settings
                return;
            }
        }
        setPreventAppRemoval(value);
        await StorageService.setPreventAppRemoval(value);
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
                    <MenuItem
                        title="앱 삭제 방지"
                        icon="trash"
                        onPress={() => { }}
                        rightElement={
                            <Switch
                                value={preventAppRemoval}
                                onValueChange={handleToggleRemoval}
                                trackColor={{ false: '#334155', true: Colors.primary }}
                                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                            />
                        }
                    />
                </View>

                <View style={styles.section}>
                    <MenuItem
                        title="알림 설정"
                        icon="notifications"
                        onPress={() => navigate('NotificationSettings')}
                    />
                    <MenuItem title="도움말" icon="help-circle" onPress={() => { }} />
                    <MenuItem
                        title="버전 정보"
                        icon="information-circle"
                        onPress={() => { }}
                        rightElement={
                            <Typography variant="body" color={Colors.textSecondary}>
                                v{require('../../package.json').version}
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
