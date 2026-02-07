import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';

export const LoginScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [isLoading, setIsLoading] = useState(false);

    const handleKakaoLogin = async (role: 'PARENT' | 'TEACHER' = 'PARENT') => {
        console.log(`[LoginScreen] Kakao Login button pressed (role: ${role})`);
        setIsLoading(true);
        const user = await AuthService.loginWithKakao(role);
        console.log("[LoginScreen] Kakao Login finished, user:", user ? "Success" : "Failed");
        setIsLoading(false);
        if (user) {
            navigate('Dashboard');
        }
    };

    const handleGuestLogin = async () => {
        setIsLoading(true);
        // Register device as 'Student' (Anonymous)
        await AuthService.syncDevice();
        setIsLoading(false);
        navigate('Dashboard');
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Icon name="lock-closed" size={80} color={Colors.primary} />
                    <Typography variant="h1" bold style={styles.title}>락모먼트</Typography>
                    <Typography color={Colors.textSecondary} style={styles.subtitle}>
                        지금을 온전히, 집중의 순간
                    </Typography>
                </View>

                <View style={styles.buttonContainer}>
                    <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
                        테스트용 역할 선택 (디버깅)
                    </Typography>
                    <View style={styles.roleButtons}>
                        <TouchableOpacity
                            style={[styles.smallButton, { backgroundColor: Colors.primary }]}
                            onPress={() => handleKakaoLogin('PARENT')}
                            disabled={isLoading}
                        >
                            <Typography color="#FFF">부모 로그인</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.smallButton, { backgroundColor: '#FF9500' }]}
                            onPress={() => handleKakaoLogin('TEACHER')}
                            disabled={isLoading}
                        >
                            <Typography color="#FFF">교사 로그인</Typography>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.kakaoButton}
                        onPress={() => handleKakaoLogin('PARENT')}
                        disabled={isLoading}
                    >
                        <Icon name="chatbubble" size={20} color="#000000" />
                        <Typography bold color="#000000" style={styles.kakaoText}>
                            {isLoading ? "로그인 중..." : "카카오로 시작하기"}
                        </Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.guestButton}
                        onPress={handleGuestLogin}
                        disabled={isLoading}
                    >
                        <Typography color={Colors.textSecondary}>게스트로 시작하기</Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.smallButton, { backgroundColor: '#34C759', marginTop: 10 }]}
                        onPress={() => navigate('Join')}
                    >
                        <Typography color="#FFF">회원가입 화면 미리보기 (심사용)</Typography>
                    </TouchableOpacity>
                </View>

                <Typography variant="caption" color={Colors.textSecondary} style={styles.infoText}>
                    로그인 시 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
                    서비스 오류 대응을 위해 플랫폼, OS버전, 기기정보가 수집됩니다.
                </Typography>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 32,
        marginTop: 20,
    },
    subtitle: {
        marginTop: 10,
    },
    buttonContainer: {
        gap: 12,
    },
    kakaoButton: {
        flexDirection: 'row',
        backgroundColor: '#FEE500',
        paddingVertical: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    kakaoText: {
        fontSize: 16,
    },
    guestButton: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    roleButtons: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    smallButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    infoText: {
        marginTop: 40,
        textAlign: 'center',
        lineHeight: 18,
    },
});
