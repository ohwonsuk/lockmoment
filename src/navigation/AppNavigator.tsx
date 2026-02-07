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
import { Colors } from '../theme/Colors';
import { useAppNavigation } from './NavigationContext';

export const AppNavigator: React.FC = () => {
    const { currentScreen } = useAppNavigation();

    const renderScreen = () => {
        switch (currentScreen) {
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
            default:
                return <DashboardScreen />;
        }
    };

    return <View style={styles.container}>{renderScreen()}</View>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
});
