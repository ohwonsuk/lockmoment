import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';

export const LoginScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [isLoading, setIsLoading] = useState(false);

    const handleKakaoLogin = async (role: 'PARENT' | 'TEACHER' = 'PARENT') => {
        setIsLoading(true);
        const user = await AuthService.loginWithKakao(role);
        setIsLoading(false);
        if (user) {
            navigate('Dashboard');
        }
    };

    const handleAppleSignIn = async () => {
        setIsLoading(true);
        const result = await AuthService.loginWithApple();
        setIsLoading(false);

        if (!result) return;

        if ('status' in result && result.status === 'NEW_USER') {
            // 신규 사용자 또는 정보 부족 - 가입 정보 입력 화면으로 이동
            navigate('AppleJoin', {
                appleSub: result.appleSub,
                email: result.email,
                name: result.name
            });
        } else if ('id' in result) {
            // 기존 사용자 - 대시보드로 이동
            navigate('Dashboard');
        }
    };

    const handleGuestLogin = async () => {
        setIsLoading(true);
        const user = await AuthService.loginAsGuest();
        setIsLoading(false);
        if (user) {
            navigate('Dashboard');
        }
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
                    <TouchableOpacity
                        style={[styles.kakaoButton, { backgroundColor: '#FEE500', opacity: 0.9 }]}
                        onPress={() => navigate('Join')}
                        disabled={isLoading}
                    >
                        <Icon name="person-add" size={20} color="#000000" />
                        <Typography bold color="#000000" style={styles.buttonText}>
                            카카오로 회원가입
                        </Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.kakaoButton}
                        onPress={() => handleKakaoLogin('PARENT')}
                        disabled={isLoading}
                    >
                        <Icon name="chatbubble" size={20} color="#000000" />
                        <Typography bold color="#000000" style={styles.buttonText}>
                            {isLoading ? "로그인 중..." : "카카오로 계속하기"}
                        </Typography>
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                        <TouchableOpacity
                            style={styles.appleButton}
                            onPress={handleAppleSignIn}
                            disabled={isLoading}
                        >
                            <Icon name="logo-apple" size={20} color="#FFFFFF" />
                            <Typography bold color="#FFFFFF" style={styles.buttonText}>
                                {isLoading ? "로그인 중..." : "Apple로 계속하기"}
                            </Typography>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.guestButton}
                        onPress={handleGuestLogin}
                        disabled={isLoading}
                    >
                        <Typography color={Colors.textSecondary}>게스트로 시작하기</Typography>
                    </TouchableOpacity>
                </View>

                <Typography variant="caption" color={Colors.textSecondary} style={styles.infoText}>
                    서비스 이용을 위해 기기정보가 수집되며,{"\n"}
                    회원가입 시 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
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
    appleButton: {
        flexDirection: 'row',
        backgroundColor: '#000000',
        paddingVertical: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#555555', // 밝은 테두리색 추가
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
    buttonText: {
        fontSize: 16,
    },
    guestButton: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    infoText: {
        marginTop: 40,
        textAlign: 'center',
        lineHeight: 18,
    },
});
