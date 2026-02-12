import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { useAppNavigation } from '../navigation/NavigationContext';

export const BottomTabBar: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { currentScreen, navigate } = useAppNavigation();

    const tabs = [
        { name: 'Dashboard', label: '잠금', icon: 'lock-closed' },
        { name: 'Children', label: '자녀', icon: 'people' },
        { name: 'QR', label: 'QR', icon: 'qr-code' },
        { name: 'Notification', label: '알림', icon: 'notifications' },
        { name: 'MyInfo', label: '내 정보', icon: 'person' },
    ];

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {tabs.map((tab) => {
                const isActive = currentScreen === tab.name ||
                    (tab.name === 'Dashboard' && (currentScreen === 'Dashboard' || currentScreen === 'Locking')) ||
                    (tab.name === 'MyInfo' && currentScreen === 'Settings');
                // Map other screens to tabs if necessary

                return (
                    <TouchableOpacity
                        key={tab.name}
                        style={styles.tab}
                        onPress={() => navigate(tab.name as any)}
                    >
                        <Icon
                            name={isActive ? tab.icon : `${tab.icon}-outline`}
                            size={24}
                            color={isActive ? Colors.primary : Colors.textSecondary}
                        />
                        <Typography
                            variant="caption"
                            color={isActive ? Colors.primary : Colors.textSecondary}
                            style={{ marginTop: 4, fontSize: 10 }}
                        >
                            {tab.label}
                        </Typography>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: 10,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
