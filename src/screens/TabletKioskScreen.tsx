import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import QRCode from 'react-native-qrcode-svg';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';

const { width, height } = Dimensions.get('window');

// Mock data for attendance log
const MOCK_LOGS = [
    { id: '1', name: '김민지', time: '14:30', status: 'ATTENDANCE' },
    { id: '2', name: '이준호', time: '14:32', status: 'ATTENDANCE' },
    { id: '3', name: '박서연', time: '14:35', status: 'ATTENDANCE' },
];

export const TabletKioskScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [qrValue, setQrValue] = useState('LOCKMOMENT_ATTENDANCE_CHECK'); // Placeholder
    const [attendanceLogs, setAttendanceLogs] = useState(MOCK_LOGS);
    const [instituteName, setInstituteName] = useState('락모먼트 학원');

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        loadInstituteInfo();

        return () => clearInterval(timer);
    }, []);

    const loadInstituteInfo = async () => {
        // TODO: Fetch real institute info and QR value from API
        const user = await AuthService.getUserProfile();
        // setInstituteName(user?.instituteName || 'My Institute');
        // setQrValue(`INSTITUTE:${user?.instituteId}`);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    };

    return (
        <View style={styles.container}>
            {/* Header Area */}
            <View style={styles.header}>
                <View style={styles.branding}>
                    <Icon name="business" size={32} color={Colors.primary} />
                    <Typography variant="h1" bold style={{ marginLeft: 10 }}>{instituteName}</Typography>
                </View>
                <TouchableOpacity style={styles.exitButton} onPress={() => navigate('Dashboard')}>
                    <Typography color={Colors.textSecondary}>나가기</Typography>
                    <Icon name="log-out-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                {/* Left Panel: QR Code & Time */}
                <View style={styles.leftPanel}>
                    <View style={styles.clockContainer}>
                        <Typography style={styles.dateText}>{formatDate(currentTime)}</Typography>
                        <Typography style={styles.timeText} bold>{formatTime(currentTime)}</Typography>
                    </View>

                    <View style={styles.qrCard}>
                        <View style={styles.qrWrapper}>
                            <QRCode
                                value={qrValue}
                                size={280}
                                color="black"
                                backgroundColor="white"
                            />
                        </View>
                        <Typography variant="h2" bold style={{ marginTop: 24, marginBottom: 8 }}>출석 체크</Typography>
                        <Typography color={Colors.textSecondary} style={{ textAlign: 'center' }}>
                            학생 앱에서 QR 스캔 메뉴를 열고{'\n'}위 코드를 스캔해주세요.
                        </Typography>
                    </View>
                </View>

                {/* Right Panel: Recent Logs */}
                <View style={styles.rightPanel}>
                    <View style={styles.panelHeader}>
                        <Typography variant="h2" bold>실시간 출석 현황</Typography>
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                            <Typography variant="caption" color="#EF4444" bold>LIVE</Typography>
                        </View>
                    </View>

                    <ScrollView style={styles.logList} showsVerticalScrollIndicator={false}>
                        {attendanceLogs.map((log, index) => (
                            <View key={log.id} style={[styles.logItem, index === 0 && styles.latestLogItem]}>
                                <View style={styles.logAvatar}>
                                    <Icon name="person" size={20} color={Colors.primary} />
                                </View>
                                <View style={styles.logInfo}>
                                    <Typography bold style={{ fontSize: 16 }}>{log.name}</Typography>
                                    <Typography variant="caption" color={Colors.textSecondary}>학생</Typography>
                                </View>
                                <View style={styles.logTime}>
                                    <Typography bold color={Colors.primary}>{log.time}</Typography>
                                    <Typography variant="caption" color={Colors.primary}>출석 완료</Typography>
                                </View>
                            </View>
                        ))}
                        {/* Empty placeholders to fill space if needed */}
                        {Array.from({ length: 5 }).map((_, i) => (
                            <View key={`empty-${i}`} style={[styles.logItem, { opacity: 0.3 }]}>
                                <View style={[styles.logAvatar, { backgroundColor: Colors.border }]} />
                                <View style={{ gap: 4 }}>
                                    <View style={{ width: 60, height: 16, backgroundColor: Colors.border, borderRadius: 4 }} />
                                    <View style={{ width: 40, height: 12, backgroundColor: Colors.border, borderRadius: 4 }} />
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    branding: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    exitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        padding: 40,
        gap: 40,
    },
    leftPanel: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
    },
    clockContainer: {
        alignItems: 'center',
    },
    dateText: {
        fontSize: 24,
        color: Colors.textSecondary,
        marginBottom: 10,
    },
    timeText: {
        fontSize: 80,
        color: Colors.text,
        letterSpacing: 2,
    },
    qrCard: {
        backgroundColor: Colors.card,
        padding: 40,
        borderRadius: 32,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    qrWrapper: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 24,
    },
    rightPanel: {
        flex: 0.8,
        backgroundColor: Colors.card,
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF444415',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 6,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EF4444',
    },
    logList: {
        flex: 1,
    },
    logItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border + '40',
    },
    latestLogItem: {
        backgroundColor: Colors.primary + '10',
        borderRadius: 16,
        borderBottomWidth: 0,
        marginBottom: 10,
    },
    logAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    logInfo: {
        flex: 1,
    },
    logTime: {
        alignItems: 'flex-end',
    },
});
