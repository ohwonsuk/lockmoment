import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Animated, Platform } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';

interface CustomAlertProps {
    isVisible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'info' | 'error' | 'success';
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
    isVisible,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = '확인',
    cancelText = '취소',
    type = 'info'
}) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (isVisible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="none"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
                    <View style={styles.content}>
                        <Typography variant="h2" bold style={styles.title}>{title}</Typography>
                        <Typography variant="body" color={Colors.textSecondary} style={styles.message}>
                            {message}
                        </Typography>
                    </View>

                    <View style={styles.footer}>
                        {onCancel && (
                            <TouchableOpacity style={styles.buttonSecondary} onPress={onCancel}>
                                <Typography color={Colors.textSecondary} bold>{cancelText}</Typography>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.buttonPrimary,
                                type === 'error' && { backgroundColor: '#EF4444' },
                                !onCancel && { flex: 1 }
                            ]}
                            onPress={onConfirm}
                        >
                            <Typography color="#FFFFFF" bold>{confirmText}</Typography>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    container: {
        width: '100%',
        backgroundColor: Colors.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        textAlign: 'center',
        lineHeight: 22,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    buttonPrimary: {
        flex: 1,
        height: 52,
        backgroundColor: Colors.primary,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonSecondary: {
        flex: 1,
        height: 52,
        backgroundColor: Colors.border,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
