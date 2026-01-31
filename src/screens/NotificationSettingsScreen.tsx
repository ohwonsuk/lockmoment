import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, Platform, ScrollView } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { StorageService } from '../services/StorageService';
import { Picker as IOSPicker } from '@react-native-picker/picker';
import { Picker as AndroidPicker } from 'react-native-wheel-pick';

const isIOS = Platform.OS === 'ios';

export const NotificationSettingsScreen: React.FC = () => {
    const [enabled, setEnabled] = useState(true);
    const [preLockEnabled, setPreLockEnabled] = useState(true);
    const [preLockMinutes, setPreLockMinutes] = useState(10);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const settings = await StorageService.getNotificationSettings();
        setEnabled(settings.enabled);
        setPreLockEnabled(settings.preLockEnabled);
        setPreLockMinutes(settings.preLockMinutes);
    };

    const saveSettings = async (updates: Partial<{ enabled: boolean; preLockEnabled: boolean; preLockMinutes: number }>) => {
        const current = { enabled, preLockEnabled, preLockMinutes };
        const updated = { ...current, ...updates };

        if (updates.enabled !== undefined) setEnabled(updates.enabled);
        if (updates.preLockEnabled !== undefined) setPreLockEnabled(updates.preLockEnabled);
        if (updates.preLockMinutes !== undefined) setPreLockMinutes(updates.preLockMinutes);

        await StorageService.setNotificationSettings(updated);
    };

    const minuteOptions = [5, 10, 20, 30, 60];

    return (
        <View style={styles.container}>
            <Header showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h1" bold style={styles.title}>알림 설정</Typography>

                <View style={styles.section}>
                    <View style={styles.settingItem}>
                        <View style={styles.settingText}>
                            <Typography variant="body">알림 수신</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>앱의 주요 알림을 수신합니다.</Typography>
                        </View>
                        <Switch
                            value={enabled}
                            onValueChange={(val) => saveSettings({ enabled: val })}
                            trackColor={{ false: '#334155', true: Colors.primary }}
                            thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingText}>
                            <Typography variant="body">예약 잠금 사전 알림</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>잠금 시작 전 미리 알려드립니다.</Typography>
                        </View>
                        <Switch
                            value={preLockEnabled}
                            onValueChange={(val) => saveSettings({ preLockEnabled: val })}
                            disabled={!enabled}
                            trackColor={{ false: '#334155', true: Colors.primary }}
                            thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                        />
                    </View>

                    {preLockEnabled && enabled && (
                        <View style={styles.timeSection}>
                            <Typography variant="body" style={styles.subTitle}>사전 알림 기준 시간</Typography>
                            <View style={styles.pickerContainer}>
                                {isIOS ? (
                                    <IOSPicker
                                        selectedValue={preLockMinutes}
                                        onValueChange={(val) => saveSettings({ preLockMinutes: val as number })}
                                        style={styles.picker}
                                        itemStyle={styles.pickerItemIOS}
                                    >
                                        {minuteOptions.map(m => (
                                            <IOSPicker.Item key={m} label={`${m}분 전`} value={m} />
                                        ))}
                                    </IOSPicker>
                                ) : (
                                    <AndroidPicker
                                        style={styles.androidPicker}
                                        themeVariant="dark"
                                        backgroundColor="#1E293B"
                                        textColor="#FFFFFF"
                                        selectTextColor="#FFFFFF"
                                        itemStyle={{ height: 50, backgroundColor: 'transparent', color: '#FFFFFF' }}
                                        textSize={20}
                                        selectedValue={preLockMinutes.toString()}
                                        pickerData={minuteOptions.map(m => m.toString())}
                                        onValueChange={(val: any) => saveSettings({ preLockMinutes: parseInt(val) })}
                                    />
                                )}
                                {!isIOS && <Typography variant="body" style={styles.unitText}>분 전</Typography>}
                            </View>
                        </View>
                    )}
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
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    settingText: {
        flex: 1,
        marginRight: 10,
    },
    timeSection: {
        padding: 18,
    },
    subTitle: {
        marginBottom: 10,
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 12,
        height: isIOS ? 150 : 100,
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
        height: 150,
    },
    pickerItemIOS: {
        fontSize: 18,
        height: 150,
        color: '#FFFFFF',
    },
    androidPicker: {
        width: 100,
        height: 100,
        backgroundColor: '#1E293B',
    },
    unitText: {
        marginLeft: 10,
    }
});
