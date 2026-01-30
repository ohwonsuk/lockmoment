import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { NativeLockControl } from '../services/NativeLockControl';

export const PermissionsScreen: React.FC = () => {
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        const authStatus = await NativeLockControl.checkAuthorization();
        // authStatus 2 is mapped to 'Authorized' in both iOS and Android native modules
        setHasPermission(authStatus === 2);
    };

    const handleRequest = async () => {
        try {
            await NativeLockControl.requestAuthorization();
            await checkStatus();
        } catch (e: any) {
            Alert.alert("Error", e.message);
        }
    };

    return (
        <View style={styles.container}>
            <Header showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h1" bold style={styles.title}>앱 권한설정</Typography>

                <View style={styles.card}>
                    <Typography variant="h2" bold>스크린 타임 권한</Typography>
                    <Typography color={Colors.textSecondary} style={styles.description}>
                        앱 잠금 기능을 사용하려면 스크린 타임 권한 허용이 필요합니다.
                    </Typography>

                    <View style={styles.statusRow}>
                        <Typography>현재 상태:</Typography>
                        <Typography color={hasPermission ? Colors.statusGreen : '#FF3B30'} bold>
                            {hasPermission ? "허용됨" : "허용 안 됨"}
                        </Typography>
                    </View>

                    {!hasPermission && (
                        <TouchableOpacity style={styles.button} onPress={handleRequest}>
                            <Typography bold>권한 요청하기</Typography>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.card}>
                    <Typography variant="h2" bold>알림 권한</Typography>
                    <Typography color={Colors.textSecondary} style={styles.description}>
                        잠금 시작 및 종료 알림을 받으려면 알림 권한이 필요합니다.
                    </Typography>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}
                        onPress={async () => {
                            if (Platform.OS === 'android') {
                                await NativeLockControl.requestNotificationPermission();
                            }
                            NativeLockControl.openNotificationSettings();
                        }}
                    >
                        <Typography>알림 설정으로 이동</Typography>
                    </TouchableOpacity>
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
    card: {
        backgroundColor: Colors.card,
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    description: {
        marginTop: 8,
        lineHeight: 20,
    },
    statusRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
        marginBottom: 10,
    },
    button: {
        backgroundColor: Colors.primary,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
});
