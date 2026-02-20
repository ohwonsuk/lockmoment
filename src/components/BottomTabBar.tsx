import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { useAppNavigation } from '../navigation/NavigationContext';
import { StorageService } from '../services/StorageService';

type TabItem = {
    name: string;
    label: string;
    icon: string;
};

const getTabs = (contextType: 'SELF' | 'CHILD' | 'STUDENT', userRole: string | null): TabItem[] => {
    switch (contextType) {
        case 'CHILD': // 부모 모드 (자녀 관리)
            return [
                { name: 'Dashboard', label: '잠금', icon: 'lock-closed' },
                { name: 'LinkSubUser', label: '자녀', icon: 'people' },
                { name: 'QR', label: 'QR', icon: 'qr-code' },
                { name: 'UsageReport', label: '리포트', icon: 'bar-chart' },
                { name: 'MyInfo', label: '내 정보', icon: 'person' },
            ];
        case 'STUDENT': // 선생님 모드 (학생 관리)
            return [
                { name: 'TeacherClass', label: '학생 관리', icon: 'school' },
                { name: 'AdminSchedule', label: '기관 스케쥴', icon: 'business' },
                { name: 'QR', label: 'QR출석', icon: 'qr-code' },
                { name: 'MyInfo', label: '내 정보', icon: 'person' },
            ];
        default: // 나 모드 (SELF)
            return [
                { name: 'Dashboard', label: '내 잠금', icon: 'lock-closed' },
                { name: 'ScheduleList', label: '스케쥴', icon: 'calendar' },
                { name: 'QRScanner', label: 'QR스캔', icon: 'qr-code' },
                { name: 'Notification', label: '알림', icon: 'notifications' },
                { name: 'MyInfo', label: '내 정보', icon: 'person' },
            ];
    }
};

export const BottomTabBar: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { currentScreen, navigate } = useAppNavigation();
    const [contextType, setContextType] = React.useState<'SELF' | 'CHILD' | 'STUDENT'>('SELF');
    const [userRole, setUserRole] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadContext = async () => {
            const context = await StorageService.getActiveContext();
            if (context) setContextType(context.type);

            const role = await StorageService.getUserRole();
            setUserRole(role);
        };
        loadContext();
    }, [currentScreen]); // 화면 전환 시 컨텍스트 재확인

    const tabs = getTabs(contextType, userRole);

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {tabs.map((tab) => {
                const isActive = currentScreen === tab.name ||
                    (tab.name === 'Dashboard' && (currentScreen === 'Dashboard' || currentScreen === 'Locking')) ||
                    (tab.name === 'ScheduleList' && currentScreen === 'ScheduleList') ||
                    (tab.name === 'LinkSubUser' && (currentScreen === 'LinkSubUser' || currentScreen === 'Children')) ||
                    (tab.name === 'MyInfo' && (currentScreen === 'MyInfo' || currentScreen === 'Settings'));

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
