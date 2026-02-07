import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';

export const JoinScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [mandatoryAgreed, setMandatoryAgreed] = useState(true);
    const [optionalAgreed, setOptionalAgreed] = useState(false);

    const handleJoinComplete = async () => {
        if (!mandatoryAgreed) {
            Alert.alert('알림', '필수 약관에 동의해주세요.');
            return;
        }
        await AuthService.syncDevice();
        navigate('Dashboard');
    };

    const openPrivacyPolicy = () => {
        Linking.openURL('https://pic.momentae.app/5');
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Typography variant="h1" bold>회원정보 확인</Typography>
                    <Typography color={Colors.textSecondary} style={styles.subtitle}>
                        카카오로부터 안전하게 정보를 가져왔습니다.
                    </Typography>
                </View>

                {/* 필수 회원정보 */}
                <View style={styles.sectionHeader}>
                    <Typography variant="h2" bold>필수 회원정보</Typography>
                </View>
                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Typography color={Colors.textSecondary} style={styles.label}>이름(닉네임)</Typography>
                        <Typography bold style={styles.value}>원석 (테스트)</Typography>
                    </View>
                    <View style={styles.infoRow}>
                        <Typography color={Colors.textSecondary} style={styles.label}>연락처</Typography>
                        <Typography bold style={styles.value}>010-****-5678</Typography>
                    </View>
                </View>

                {/* 선택 회원정보 */}
                <View style={styles.sectionHeader}>
                    <Typography variant="h2" bold>선택 회원정보</Typography>
                </View>
                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Typography color={Colors.textSecondary} style={styles.label}>이메일</Typography>
                        <Typography style={styles.value}>momentae***@gmail.com</Typography>
                    </View>
                    <View style={styles.infoRow}>
                        <Typography color={Colors.textSecondary} style={styles.label}>프로필 사진</Typography>
                        <Typography style={styles.value}>이미지 제공 동의</Typography>
                    </View>
                </View>

                <View style={styles.consentSection}>
                    <View style={styles.rowBetween}>
                        <Typography variant="h2" bold>개인정보 수집 및 이용 동의</Typography>
                        <TouchableOpacity onPress={openPrivacyPolicy}>
                            <Typography color={Colors.primary} variant="caption">전체보기</Typography>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setMandatoryAgreed(!mandatoryAgreed)}
                    >
                        <Icon
                            name={mandatoryAgreed ? "checkbox" : "square-outline"}
                            size={20}
                            color={mandatoryAgreed ? Colors.primary : Colors.textSecondary}
                        />
                        <Typography style={styles.checkboxText}>[필수] 개인정보 처리방침에 동의합니다.</Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setOptionalAgreed(!optionalAgreed)}
                    >
                        <Icon
                            name={optionalAgreed ? "checkbox" : "square-outline"}
                            size={20}
                            color={optionalAgreed ? Colors.primary : Colors.textSecondary}
                        />
                        <Typography style={styles.checkboxText}>[선택] 마케팅 정보 수신 및 선택정보 활용 동의</Typography>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.joinButton, !mandatoryAgreed && styles.disabledButton]}
                    onPress={handleJoinComplete}
                >
                    <Typography bold color="#FFF" style={styles.joinButtonText}>가입 완료하기</Typography>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={() => navigate('Login')}>
                    <Typography color={Colors.textSecondary}>취소</Typography>
                </TouchableOpacity>
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
        padding: 24,
        paddingTop: 60,
    },
    header: {
        marginBottom: 32,
    },
    subtitle: {
        marginTop: 8,
    },
    sectionHeader: {
        marginBottom: 12,
        paddingLeft: 4,
    },
    infoSection: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    label: {
        fontSize: 14,
    },
    value: {
        fontSize: 16,
    },
    consentSection: {
        marginBottom: 32,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
    },
    checkboxText: {
        fontSize: 14,
    },
    joinButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    disabledButton: {
        backgroundColor: Colors.statusInactive,
    },
    joinButtonText: {
        fontSize: 16,
    },
    cancelButton: {
        alignItems: 'center',
        paddingVertical: 12,
    }
});
