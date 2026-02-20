import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';
import { StorageService } from '../services/StorageService';
import { useAlert } from '../context/AlertContext';

export const PinSettingsScreen: React.FC = () => {
    const { navigate, goBack } = useAppNavigation();
    const { showAlert } = useAlert();

    const [hasPin, setHasPin] = useState(false);
    const [step, setStep] = useState<'VERIFY' | 'NEW' | 'CONFIRM' | 'MENU'>('MENU');

    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    const [errorMsg, setErrorMsg] = useState('');
    const [pendingAction, setPendingAction] = useState<'CHANGE' | 'DELETE' | null>(null);

    useEffect(() => {
        loadPinStatus();
    }, []);

    const loadPinStatus = async () => {
        const pinStatus = await StorageService.getHasPin();
        setHasPin(pinStatus);
        setStep(pinStatus ? 'MENU' : 'NEW');
    };

    const handleSetPin = async () => {
        if (newPin !== confirmPin) {
            setErrorMsg('비밀번호가 일치하지 않습니다.');
            setConfirmPin('');
            return;
        }

        const success = await AuthService.setPin(newPin);
        if (success) {
            showAlert({
                title: "설정 완료",
                message: "비밀번호가 성공적으로 설정되었습니다.",
                confirmText: "확인",
                onConfirm: () => goBack()
            });
        } else {
            showAlert({
                title: "설정 실패",
                message: "비밀번호 설정 중 오류가 발생했습니다.",
                confirmText: "확인"
            });
        }
    };

    const handleVerifyCurrent = async () => {
        const success = await AuthService.verifyPin(currentPin);
        if (success) {
            setCurrentPin('');
            setErrorMsg('');

            if (pendingAction === 'DELETE') {
                performDelete();
            } else {
                setStep('NEW');
            }
        } else {
            setErrorMsg('현재 비밀번호가 일치하지 않습니다.');
            setCurrentPin('');
        }
    };

    const performDelete = async () => {
        const success = await AuthService.setPin("");
        if (success) {
            await StorageService.setHasPin(false);
            showAlert({
                title: "삭제 완료",
                message: "비밀번호가 삭제되었습니다.",
                confirmText: "확인",
                onConfirm: () => goBack()
            });
        } else {
            showAlert({
                title: "삭제 실패",
                message: "비밀번호 삭제 중 오류가 발생했습니다.",
                confirmText: "확인"
            });
        }
    };

    const renderInputStep = (
        title: string,
        subtitle: string,
        value: string,
        onChange: (val: string) => void,
        onAction: () => void,
        actionLabel: string
    ) => (
        <View style={styles.stepContainer}>
            <Typography variant="h2" bold style={styles.stepTitle}>{title}</Typography>
            <Typography color={Colors.textSecondary} style={styles.stepSubtitle}>{subtitle}</Typography>

            <TextInput
                style={styles.pinInput}
                value={value}
                onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned.length <= 6) {
                        onChange(cleaned);
                    }
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={Colors.border}
                autoFocus
            />

            {errorMsg ? <Typography color="#EF4444" style={styles.errorText}>{errorMsg}</Typography> : null}

            <TouchableOpacity
                style={[styles.actionButton, { opacity: value.length === 6 ? 1 : 0.5 }]}
                onPress={onAction}
                disabled={value.length !== 6}
            >
                <Typography color="white" bold>{actionLabel}</Typography>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => {
                setPendingAction(null);
                hasPin ? setStep('MENU') : goBack();
            }}>
                <Typography color={Colors.textSecondary}>취소</Typography>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <Header title="비밀번호(PIN) 설정" showBack />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    {step === 'MENU' && (
                        <View style={styles.menuList}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => {
                                setPendingAction('CHANGE');
                                setStep('VERIFY');
                            }}>
                                <View style={styles.menuIcon}>
                                    <Icon name="create-outline" size={24} color={Colors.text} />
                                </View>
                                <Typography style={styles.menuLabel}>비밀번호 변경</Typography>
                                <Icon name="chevron-forward" size={20} color={Colors.border} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                                onPress={() => {
                                    setPendingAction('DELETE');
                                    setStep('VERIFY');
                                }}
                            >
                                <View style={styles.menuIcon}>
                                    <Icon name="trash-outline" size={24} color="#EF4444" />
                                </View>
                                <Typography style={[styles.menuLabel, { color: '#EF4444' }]}>비밀번호 삭제</Typography>
                                <Icon name="chevron-forward" size={20} color={Colors.border} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 'VERIFY' && renderInputStep(
                        "인증",
                        "기존 비밀번호를 입력해주세요.",
                        currentPin,
                        setCurrentPin,
                        handleVerifyCurrent,
                        "확인"
                    )}

                    {step === 'NEW' && renderInputStep(
                        "새 비밀번호",
                        "사용할 6자리 비밀번호를 입력해주세요.",
                        newPin,
                        setNewPin,
                        () => { setStep('CONFIRM'); setErrorMsg(''); },
                        "다음"
                    )}

                    {step === 'CONFIRM' && renderInputStep(
                        "비밀번호 확인",
                        "비밀번호를 한번 더 입력해주세요.",
                        confirmPin,
                        setConfirmPin,
                        handleSetPin,
                        "설정 완료"
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: 20,
    },
    menuList: {
        backgroundColor: Colors.card,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuIcon: {
        width: 32,
        alignItems: 'center',
    },
    menuLabel: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
    },
    stepContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    stepTitle: {
        marginBottom: 8,
    },
    stepSubtitle: {
        textAlign: 'center',
        marginBottom: 32,
    },
    pinInput: {
        width: '100%',
        height: 64,
        backgroundColor: Colors.card,
        borderRadius: 16,
        paddingHorizontal: 20,
        fontSize: 28,
        textAlign: 'center',
        color: Colors.text,
        letterSpacing: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 16,
    },
    errorText: {
        marginBottom: 16,
    },
    actionButton: {
        width: '100%',
        height: 56,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    cancelButton: {
        marginTop: 20,
        padding: 8,
    }
});
