import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { LockingScreen } from '../screens/LockingScreen';
import { AddScheduleScreen } from '../screens/AddScheduleScreen';
import { AppSelectScreen } from '../screens/AppSelectScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { QRScannerScreen } from '../screens/QRScannerScreen';
import { QRGeneratorScreen } from '../screens/QRGeneratorScreen';
import { TeacherClassScreen } from '../screens/TeacherClassScreen';
import { JoinScreen } from '../screens/JoinScreen';
import { JoinInfoScreen } from '../screens/JoinInfoScreen';
import { JoinCompleteScreen } from '../screens/JoinCompleteScreen';
import { LinkSubUserScreen } from '../screens/LinkSubUserScreen';
import { PermissionGuideScreen } from '../screens/PermissionGuideScreen';
import { AdminScheduleScreen } from '../screens/AdminScheduleScreen';
import { AppleJoinScreen } from '../screens/AppleJoinScreen';
import { Colors } from '../theme/Colors';
import { useAppNavigation } from './NavigationContext';
import { BottomTabBar } from '../components/BottomTabBar';
import { TabletKioskScreen } from '../screens/TabletKioskScreen';
import { ChildrenScreen } from '../screens/ChildrenScreen';
import { ChildDetailScreen } from '../screens/ChildDetailScreen';
// Placeholder screens for new tabs
import { NotificationScreen } from '../screens/NotificationScreen';
import { MyInfoScreen } from '../screens/MyInfoScreen';
import { ScheduleListScreen } from '../screens/ScheduleListScreen';
import { ScheduleEditScreen } from '../screens/ScheduleEditScreen';
import { UsageReportScreen } from '../screens/UsageReportScreen';
import { PersonalPresetScreen } from '../screens/PersonalPresetScreen';
import { AppLockSettingsScreen } from '../screens/AppLockSettingsScreen';

export const AppNavigator: React.FC = () => {
    const { currentScreen, currentParams } = useAppNavigation();

    const renderScreen = () => {
        switch (currentScreen) {
            case 'PermissionGuide':
                return <PermissionGuideScreen />;
            case 'Dashboard':
                return <DashboardScreen />;
            case 'Settings':
                return <SettingsScreen />;
            case 'Permissions':
                return <PermissionsScreen />;
            case 'History':
                return <HistoryScreen />;
            case 'Locking':
                return <LockingScreen />;
            case 'AddSchedule':
                return <AddScheduleScreen />;
            case 'AppSelect':
                return <AppSelectScreen />;
            case 'NotificationSettings':
                return <NotificationSettingsScreen />;
            case 'Login':
                return <LoginScreen />;
            case 'QRScanner':
                return <QRScannerScreen />;
            case 'QRGenerator':
                return <QRGeneratorScreen />;
            case 'TeacherClass':
                return <TeacherClassScreen />;
            case 'Join':
                return <JoinScreen />;
            case 'JoinInfo':
                return <JoinInfoScreen />;
            case 'JoinComplete':
                return <JoinCompleteScreen route={{ params: currentParams }} />;
            case 'AppleJoin':
                return <AppleJoinScreen />;
            case 'LinkSubUser':
                return <LinkSubUserScreen route={{ params: currentParams }} />;
            case 'AdminSchedule':
                return <AdminScheduleScreen />;
            case 'Children':
                return <ChildrenScreen />;
            case 'QR':
                return <QRGeneratorScreen />; // Reuse for now, will refactor
            case 'Notification':
                return <NotificationScreen />;
            case 'MyInfo':
                return <MyInfoScreen />;
            case 'ScheduleList':
                return <ScheduleListScreen />;
            case 'TabletKiosk':
                return <TabletKioskScreen />;
            case 'ChildDetail':
                return <ChildDetailScreen />;
            case 'ScheduleEdit':
                return <ScheduleEditScreen />;
            case 'UsageReport':
                return <UsageReportScreen />;
            case 'PersonalPreset':
                return <PersonalPresetScreen />;
            case 'AppLockSettings':
                return <AppLockSettingsScreen />;

            default:
                return <DashboardScreen />;
        }
    };

    const isTabBarVisible = () => {
        const mainTabs = ['Dashboard', 'Children', 'QR', 'Notification', 'MyInfo', 'Settings', 'ScheduleList', 'History'];
        return mainTabs.includes(currentScreen);
    };

    return (
        <View style={styles.container}>
            <View style={{ flex: 1 }}>
                {renderScreen()}
            </View>
            {isTabBarVisible() && <BottomTabBar />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
});
