import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { NativeLockControl } from '../services/NativeLockControl';
import { useAppNavigation } from '../navigation/NavigationContext';

export const LockingScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [timeStr, setTimeStr] = useState<string>("00:00:00");

    useEffect(() => {
        const updateTimer = async () => {
            const remainingMs = await NativeLockControl.getRemainingTime();
            const locked = await NativeLockControl.isLocked();

            if (!locked || remainingMs <= 0) {
                navigate('Dashboard');
                return;
            }

            const totalSeconds = Math.floor(remainingMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const formatted = [
                hours.toString().padStart(2, '0'),
                minutes.toString().padStart(2, '0'),
                seconds.toString().padStart(2, '0')
            ].join(':');

            setTimeStr(formatted);
        };

        const interval = setInterval(updateTimer, 1000);
        updateTimer();

        return () => clearInterval(interval);
    }, [navigate]);

    const handleStop = async () => {
        Alert.alert(
            "잠금 해제",
            "관리자 비밀번호가 필요합니다. 정말 중단하시겠습니까?",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "중단",
                    onPress: async () => {
                        await NativeLockControl.stopLock();
                        navigate('Dashboard');
                    }
                }
            ]
        );
    };

    const handleOpenDialer = async () => {
        if (Platform.OS === 'android') {
            await NativeLockControl.openDefaultDialer();
        } else {
            const url = 'telprompt:';
            Linking.openURL(url).catch(() => Alert.alert("오류", "전화 앱을 열 수 없습니다."));
        }
    };

    const handleOpenMessages = async () => {
        if (Platform.OS === 'android') {
            await NativeLockControl.openDefaultMessages();
        } else {
            Linking.openURL('sms:').catch(() => Alert.alert("오류", "메시지 앱을 열 수 없습니다."));
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.shieldDecoration} />
                <Typography variant="h1" bold style={styles.title}>집중 모드 동작 중</Typography>
                <Typography color={Colors.textSecondary} style={styles.subtitle}>
                    설정한 시간 동안 선택한 앱이 차단됩니다.
                </Typography>

                <View style={styles.timerContainer}>
                    <Typography style={styles.timerText}>{timeStr}</Typography>
                </View>

                <View style={styles.infoBox}>
                    <Typography variant="caption" color={Colors.textSecondary} style={styles.infoTitle}>이용 가능한 기능</Typography>
                    <View style={styles.badgeRow}>
                        <TouchableOpacity style={styles.badge} onPress={handleOpenDialer}>
                            <Typography variant="caption">긴급 통화</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.badge} onPress={handleOpenMessages}>
                            <Typography variant="caption">메시지</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <Typography bold color={Colors.textSecondary}>잠금 조기 종료 (관리자)</Typography>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    shieldDecoration: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary + '20',
        borderWidth: 2,
        borderColor: Colors.primary,
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        marginBottom: 10,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 40,
    },
    timerContainer: {
        backgroundColor: Colors.card,
        paddingHorizontal: 40,
        paddingVertical: 20,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    timerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    infoBox: {
        marginTop: 60,
        width: '100%',
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 16,
    },
    infoTitle: {
        marginBottom: 12,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    badge: {
        backgroundColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    stopButton: {
        padding: 20,
        alignItems: 'center',
    }
});
