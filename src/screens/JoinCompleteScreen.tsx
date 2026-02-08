import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';

export const JoinCompleteScreen: React.FC<any> = ({ route }) => {
    const { navigate } = useAppNavigation();
    const { role } = route.params || { role: 'PARENT' };

    const handleNext = () => {
        navigate('LinkSubUser' as any, { role });
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <View style={styles.circle}>
                        <Icon name="checkmark-done" size={60} color={Colors.primary} />
                    </View>
                </View>

                <Typography variant="h1" bold style={styles.title}>가입 완료!</Typography>
                <Typography color={Colors.textSecondary} style={styles.subtitle}>
                    락모먼트의 회원이 되신 것을 환영합니다.{"\n"}
                    {role === 'PARENT' ? '자녀' : '학생'}를 등록하고 관리를 시작해보세요.
                </Typography>

                <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                    <Typography bold color="#FFF" style={styles.buttonText}>
                        {role === 'PARENT' ? '자녀 등록하러 가기' : '학생 등록하러 가기'}
                    </Typography>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigate('Dashboard')}>
                    <Typography color={Colors.textSecondary}>나중에 하기</Typography>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 30,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 40,
    },
    circle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        marginBottom: 16,
    },
    subtitle: {
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 60,
    },
    primaryButton: {
        width: '100%',
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonText: {
        fontSize: 16,
    },
    secondaryButton: {
        paddingVertical: 12,
    },
});
