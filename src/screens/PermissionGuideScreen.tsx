import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, SafeAreaView } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { StorageService } from '../services/StorageService';
import { NativeLockControl } from '../services/NativeLockControl';

export const PermissionGuideScreen: React.FC = () => {
    const { navigate } = useAppNavigation();

    const handleConfirm = async () => {
        await StorageService.setGuidedPermissions();

        // Handle initial permission requests based on platform
        if (Platform.OS === 'ios') {
            await NativeLockControl.requestAuthorization();
        } else {
            // For Android, we might want to check accessibility or usage stats
            // Currently, let's just navigate to Login
        }

        navigate('Login');
    };

    const renderPermissionItem = (icon: string, title: string, desc: string, isMandatory: boolean) => (
        <View style={styles.permissionItem}>
            <View style={styles.iconCircle}>
                <Icon name={icon} size={24} color={Colors.text} />
            </View>
            <View style={styles.permissionTextContainer}>
                <Typography bold style={styles.permissionTitle}>
                    {title} {isMandatory ? '(필수)' : '(선택)'}
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary} style={styles.permissionDesc}>
                    {desc}
                </Typography>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Typography variant="h2" bold style={styles.title}>
                        락모먼트 이용을 위한{"\n"}접근 권한 안내
                    </Typography>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
                    <View style={styles.section}>
                        <Typography bold color={Colors.primary} style={styles.sectionLabel}>필수 접근 권한</Typography>
                        {renderPermissionItem(
                            Platform.OS === 'ios' ? 'time' : 'stats-chart',
                            Platform.OS === 'ios' ? '스크린타임' : '기기 사용 정보',
                            "앱 잠금 및 사용 시간 제한 기능을 제공하기 위해 꼭 필요합니다.",
                            true
                        )}
                    </View>

                    <View style={styles.section}>
                        <Typography bold color={Colors.textSecondary} style={styles.sectionLabel}>선택 접근 권한</Typography>
                        {renderPermissionItem(
                            'call',
                            '전화',
                            "고객 센터 연결 및 본인 인증 시 편의를 제공합니다.",
                            false
                        )}
                        {renderPermissionItem(
                            'camera',
                            '카메라',
                            "프로필 이미지 등록 및 QR 코드 인식을 위해 사용합니다.",
                            false
                        )}
                        {renderPermissionItem(
                            'notifications',
                            '알림',
                            "잠금 종료 안내 및 주요 공지 사항 정보를 수신합니다.",
                            false
                        )}
                    </View>

                    <View style={styles.guideBox}>
                        <Typography variant="caption" bold color={Colors.text}>접근 권한 설정 방법</Typography>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
                            휴대폰 설정 {'>'} 락모먼트 {'>'} 권한 ON/OFF
                        </Typography>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 8 }}>
                            * 권한이 거부될 경우 일부 기능이 정상적으로 작동하지 않을 수 있습니다.
                        </Typography>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                        <Typography bold color="#FFF" style={{ fontSize: 16 }}>확인</Typography>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 40,
    },
    header: {
        marginBottom: 40,
    },
    title: {
        fontSize: 22,
        lineHeight: 30,
        color: Colors.text,
    },
    scroll: {
        flex: 1,
    },
    section: {
        marginBottom: 32,
    },
    sectionLabel: {
        fontSize: 13,
        marginBottom: 16,
    },
    permissionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    permissionTextContainer: {
        flex: 1,
    },
    permissionTitle: {
        fontSize: 16,
        color: Colors.text,
        marginBottom: 2,
    },
    permissionDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
    guideBox: {
        padding: 20,
        backgroundColor: Colors.card,
        borderRadius: 16,
        marginTop: 10,
        marginBottom: 40,
    },
    footer: {
        paddingVertical: 20,
    },
    confirmButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
});
