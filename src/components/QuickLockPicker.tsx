import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';

interface Props {
    isVisible: boolean;
    onClose: () => void;
    onConfirm: (hours: number, minutes: number, type: 'app' | 'phone') => void;
}

export const QuickLockPicker: React.FC<Props> = ({ isVisible, onClose, onConfirm }) => {
    const [hours, setHours] = useState('01');
    const [minutes, setMinutes] = useState('00');
    const [lockType, setLockType] = useState<'app' | 'phone'>('app');

    const handleConfirm = () => {
        const h = parseInt(hours) || 0;
        const m = parseInt(minutes) || 0;
        if (h === 0 && m === 0) {
            onConfirm(0, 1, lockType); // Minimum 1 minute
        } else {
            onConfirm(h, m, lockType);
        }
    };

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[styles.typeButton, lockType === 'app' && styles.typeButtonActive]}
                            onPress={() => setLockType('app')}
                        >
                            <Typography variant="body" bold={lockType === 'app'} color={lockType === 'app' ? Colors.text : Colors.textSecondary}>앱 잠금</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeButton, lockType === 'phone' && styles.typeButtonActive]}
                            onPress={() => setLockType('phone')}
                        >
                            <Typography variant="body" bold={lockType === 'phone'} color={lockType === 'phone' ? Colors.text : Colors.textSecondary}>핸드폰 잠금</Typography>
                        </TouchableOpacity>
                    </View>

                    <Typography variant="h2" bold style={styles.title}>잠금 시간 설정</Typography>

                    <View style={styles.pickerRow}>
                        <View style={styles.inputGroup}>
                            <TextInput
                                style={styles.input}
                                value={hours}
                                onChangeText={setHours}
                                keyboardType="number-pad"
                                maxLength={2}
                                placeholder="00"
                                placeholderTextColor={Colors.textSecondary}
                            />
                            <Typography variant="caption" color={Colors.textSecondary}>시간</Typography>
                        </View>

                        <Typography variant="h2">:</Typography>

                        <View style={styles.inputGroup}>
                            <TextInput
                                style={styles.input}
                                value={minutes}
                                onChangeText={setMinutes}
                                keyboardType="number-pad"
                                maxLength={2}
                                placeholder="00"
                                placeholderTextColor={Colors.textSecondary}
                            />
                            <Typography variant="caption" color={Colors.textSecondary}>분</Typography>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Typography color={Colors.textSecondary}>취소</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                            <Typography bold>잠금 시작</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '85%',
        backgroundColor: Colors.card,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    title: {
        textAlign: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    typeButtonActive: {
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 40,
    },
    inputGroup: {
        alignItems: 'center',
        gap: 8,
    },
    input: {
        backgroundColor: Colors.background,
        color: Colors.text,
        fontSize: 40,
        fontWeight: 'bold',
        width: 80,
        height: 80,
        textAlign: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: 18,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: Colors.border,
    },
    confirmButton: {
        flex: 2,
        padding: 18,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: Colors.primary,
    }
});
