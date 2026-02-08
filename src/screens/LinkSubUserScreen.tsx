import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { Header } from '../components/Header';

export const LinkSubUserScreen: React.FC<any> = ({ route }) => {
    const { navigate } = useAppNavigation();
    const { role } = route.params || { role: 'PARENT' };
    const [name, setName] = useState('');
    const [code, setCode] = useState('');

    const handleLink = () => {
        // Implementation for linking will be added later
        navigate('Dashboard');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <Header title={role === 'PARENT' ? '자녀 등록' : '학생 등록'} showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Typography variant="h1" bold>
                        {role === 'PARENT' ? '자녀의 기기를' : '학생의 기기를'} 연결하세요
                    </Typography>
                    <Typography color={Colors.textSecondary} style={styles.subtitle}>
                        {role === 'PARENT'
                            ? '자녀의 기기에 설치된 락모먼트 앱의 연결 코드를 입력해주세요.'
                            : '학생의 출석부에 등록된 코드를 입력하거나 기기를 연결해주세요.'}
                    </Typography>
                </View>

                <View style={styles.inputSection}>
                    <Typography variant="h2" bold style={styles.label}>
                        {role === 'PARENT' ? '자녀 이름' : '학생 이름'}
                    </Typography>
                    <TextInput
                        style={styles.input}
                        placeholder={role === 'PARENT' ? '예: 홍길동' : '학생 이름을 입력하세요'}
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor={Colors.textSecondary}
                    />

                    <Typography variant="h2" bold style={[styles.label, { marginTop: 24 }]}>
                        기기 연결 코드
                    </Typography>
                    <TextInput
                        style={styles.input}
                        placeholder="6자리 코드 입력"
                        value={code}
                        onChangeText={setCode}
                        maxLength={6}
                        keyboardType="number-pad"
                        placeholderTextColor={Colors.textSecondary}
                    />
                </View>

                <View style={styles.guideBox}>
                    <Icon name="information-circle" size={20} color={Colors.primary} />
                    <Typography variant="caption" color={Colors.textSecondary} style={styles.guideText}>
                        연결 코드는 {role === 'PARENT' ? '자녀' : '학생'} 기기의 '설정 &gt; 기기 연결' 메뉴에서 확인할 수 있습니다.
                    </Typography>
                </View>

                <TouchableOpacity
                    style={[styles.linkButton, (!name || !code) && styles.disabledButton]}
                    onPress={handleLink}
                    disabled={!name || !code}
                >
                    <Typography bold color="#FFF" style={styles.linkButtonText}>연결하기</Typography>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={() => navigate('Dashboard')}>
                    <Typography color={Colors.textSecondary}>건너뛰기</Typography>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: 24,
    },
    header: {
        marginBottom: 40,
    },
    subtitle: {
        marginTop: 10,
        lineHeight: 20,
    },
    inputSection: {
        marginBottom: 32,
    },
    label: {
        marginBottom: 12,
    },
    input: {
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: Colors.text,
    },
    guideBox: {
        flexDirection: 'row',
        backgroundColor: Colors.primary + '10',
        padding: 16,
        borderRadius: 12,
        gap: 10,
        marginBottom: 40,
    },
    guideText: {
        flex: 1,
        lineHeight: 18,
    },
    linkButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    disabledButton: {
        backgroundColor: Colors.statusInactive,
    },
    linkButtonText: {
        fontSize: 16,
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
});
