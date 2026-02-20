import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppNavigation } from '../navigation/NavigationContext';
import { Icon } from './Icon';
import { ContextSwitcher } from './ContextSwitcher';

interface Props {
    title?: string;
    showBack?: boolean;
    onBack?: () => void;
    hasPermission?: boolean;
    showContextSwitcher?: boolean; // 컨텍스트 전환기 노출 여부
}

export const Header: React.FC<Props> = ({
    title = "락모먼트",
    showBack = false,
    onBack,
    hasPermission,
    showContextSwitcher = true
}) => {
    const insets = useSafeAreaInsets();
    const { navigate, currentScreen } = useAppNavigation();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate('Dashboard');
        }
    };

    const handleContextChange = () => {
        // 컨텍스트 변경 시 대시보드 리프레시 유도
        navigate('Dashboard', { refresh: Date.now() });
    };

    // Shield icon color: green if permission granted, red if denied, default gray if unknown
    const getShieldColor = () => {
        if (hasPermission === undefined) return Colors.text; // Unknown state
        return hasPermission ? '#10B981' : '#EF4444'; // Green : Red
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
            <View style={styles.leftContainer}>
                {showBack && (
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Icon name="chevron-back" size={28} color={Colors.primary} />
                    </TouchableOpacity>
                )}
                {showContextSwitcher ? (
                    <ContextSwitcher onContextChange={handleContextChange} />
                ) : (
                    <TouchableOpacity onPress={() => navigate('Dashboard')}>
                        <Typography variant="h1">{title}</Typography>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.rightIcons}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => navigate('QRScanner' as any)}
                >
                    <Icon
                        name="qr-code-outline"
                        size={26}
                        color={Colors.text}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => navigate('Permissions')}
                >
                    <Icon
                        name="shield-checkmark-outline"
                        size={26}
                        color={getShieldColor()}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => navigate('Settings')}
                >
                    <Icon
                        name="settings-outline"
                        size={26}
                        color={currentScreen === 'Settings' ? Colors.primary : Colors.text}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: Colors.background,
        paddingBottom: 10,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    backButton: {
        paddingRight: 5,
    },
    rightIcons: {
        flexDirection: 'row',
        gap: 15,
    },
    iconButton: {
        padding: 5,
    },
});
