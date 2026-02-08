import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';
import { StorageService } from '../services/StorageService';

export const JoinInfoScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [userRole, setUserRole] = useState<'PARENT' | 'TEACHER'>('PARENT');
    const [email, setEmail] = useState('example@kakao.com'); // Mock pre-filled from Kakao
    const [nickname, setNickname] = useState('홍*동'); // Mock from Kakao
    const [phone, setPhone] = useState('010-****-5678'); // Mock from Kakao
    const [profileImage, setProfileImage] = useState('https://via.placeholder.com/150'); // Mock Kakao profile

    const handleJoinComplete = async () => {
        // Email is optional now, but simple valid check if entered
        if (email && !email.includes('@')) {
            Alert.alert('알림', '유효한 이메일을 입력해주세요.');
            return;
        }
        await StorageService.setUserRole(userRole);
        await AuthService.syncDevice();
        navigate('JoinComplete' as any, { role: userRole });
    };

    return (
        <View style={styles.container}>
            <View style={styles.ohHeader}>
                <TouchableOpacity onPress={() => navigate('Join' as any)}>
                    <Icon name="arrow-back" size={28} color={Colors.text} />
                </TouchableOpacity>
                <Typography variant="h2" bold style={styles.headerTitle}>추가정보 입력</Typography>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerSection}>
                    <Typography variant="h1" bold style={styles.title}>거의 다 됐어요!</Typography>
                    <Typography color={Colors.textSecondary} style={styles.subtitle}>
                        락모먼트에서 사용할 추가 정보를 입력해주세요.
                    </Typography>
                </View>

                {/* 필수 정보 확인 (카카오 연동) */}
                <View style={styles.inputSection}>
                    <Typography bold style={styles.label}>필수 정보 확인</Typography>
                    <View style={styles.mandatoryCard}>
                        <View style={styles.mandatoryRow}>
                            <Typography variant="caption" color={Colors.textSecondary}>이름(닉네임)</Typography>
                            <Typography bold style={{ fontSize: 16 }}>{nickname}</Typography>
                        </View>
                        <View style={styles.mandatoryRow}>
                            <Typography variant="caption" color={Colors.textSecondary}>휴대폰 번호</Typography>
                            <Typography bold style={{ fontSize: 16 }}>{phone}</Typography>
                        </View>
                        <Typography variant="caption" color={Colors.statusGreen} style={styles.verifiedText}>
                            ✓ 카카오 인증 정보로 확인됨
                        </Typography>
                    </View>
                </View>

                <View style={styles.inputSection}>
                    <Typography bold style={styles.label}>가입 유형</Typography>
                    <View style={styles.roleContainer}>
                        <TouchableOpacity
                            style={[styles.roleButton, userRole === 'PARENT' && styles.roleButtonActive]}
                            onPress={() => setUserRole('PARENT')}
                        >
                            <Icon name="people" size={20} color={userRole === 'PARENT' ? Colors.primary : Colors.textSecondary} />
                            <Typography bold color={userRole === 'PARENT' ? Colors.primary : Colors.textSecondary}>부모</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.roleButton, userRole === 'TEACHER' && styles.roleButtonActive]}
                            onPress={() => setUserRole('TEACHER')}
                        >
                            <Icon name="school" size={20} color={userRole === 'TEACHER' ? Colors.primary : Colors.textSecondary} />
                            <Typography bold color={userRole === 'TEACHER' ? Colors.primary : Colors.textSecondary}>교사</Typography>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 선택 정보 */}
                <View style={styles.inputSection}>
                    <Typography bold style={styles.label}>[선택] 정보 입력</Typography>
                    <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 16 }}>
                        카카오에서 가져온 프로필과 이메일 정보입니다.
                    </Typography>

                    <View style={styles.optionalContainer}>
                        <View style={styles.profileImageContainer}>
                            <Image
                                source={{ uri: profileImage }}
                                style={styles.profileImage}
                            />
                            <View style={styles.profileBadge}>
                                <Icon name="logo-kakao" size={12} color="#000" />
                            </View>
                        </View>

                        <View style={styles.emailInputWrapper}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 6 }}>이메일</Typography>
                            <TextInput
                                style={styles.input}
                                placeholder="example@email.com"
                                placeholderTextColor={Colors.statusInactive}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footerButtonContainer}>
                <TouchableOpacity
                    style={styles.ohButton}
                    onPress={handleJoinComplete}
                >
                    <Typography bold color="#FFF" style={{ fontSize: 16 }}>완료</Typography>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    ohHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    headerTitle: {
        fontSize: 16,
        color: Colors.text,
    },
    scrollContent: {
        padding: 24,
    },
    headerSection: {
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        marginBottom: 8,
        color: Colors.text,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    inputSection: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        marginBottom: 10,
        color: Colors.text,
    },
    roleContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    roleButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.card,
    },
    roleButtonActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '15',
    },
    optionalContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    profileImageContainer: {
        position: 'relative',
    },
    profileImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.background,
    },
    profileBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FEE500', // Kakao Yellow
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.card,
    },
    emailInputWrapper: {
        flex: 1,
    },
    input: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: Colors.text,
    },
    mandatoryCard: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    mandatoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    verifiedText: {
        marginTop: 4,
        textAlign: 'right',
    },
    infoText: {
        marginTop: 6,
        paddingLeft: 4,
        color: Colors.textSecondary,
    },
    footerButtonContainer: {
        padding: 20,
        paddingBottom: 40,
        backgroundColor: Colors.background,
    },
    ohButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    ohButtonDisabled: {
        backgroundColor: Colors.statusInactive,
    },
});
