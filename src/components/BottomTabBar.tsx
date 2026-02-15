import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { useAppNavigation } from '../navigation/NavigationContext';
import { StorageService } from '../services/StorageService';

export const BottomTabBar: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { currentScreen, navigate } = useAppNavigation();
    const [userRole, setUserRole] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadRole = async () => {
            const role = await StorageService.getUserRole();
            setUserRole(role);
        };
        loadRole();
    }, [currentScreen]);

    const getTabs = () => {
        if (userRole === 'STUDENT' || userRole === 'CHILD') {
            return [
                { name: 'Dashboard', label: '잠금', icon: 'lock-closed' },
                { name: 'ScheduleList', label: '스케줄', icon: 'calendar' }, // 스케줄 확인용
                { name: 'QRScanner', label: 'QR스캔', icon: 'qr-code' },
                { name: 'MyInfo', label: '내 정보', icon: 'person' },
            ];
        }
        return [
            { name: 'Dashboard', label: '잠금', icon: 'lock-closed' },
            { name: 'Children', label: '자녀', icon: 'people' },
            { name: 'QR', label: 'QR', icon: 'qr-code' },
            { name: 'Notification', label: '알림', icon: 'notifications' },
            { name: 'MyInfo', label: '내 정보', icon: 'person' },
        ];
    };

    const tabs = getTabs();

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {tabs.map((tab) => {
                const isActive = currentScreen === tab.name ||
                    (tab.name === 'Dashboard' && (currentScreen === 'Dashboard' || currentScreen === 'Locking')) ||
                    (tab.name === 'History' && currentScreen === 'History') ||
                    (tab.name === 'MyInfo' && (currentScreen === 'MyInfo' || currentScreen === 'Settings'));
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
