import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { LockingScreen } from '../screens/LockingScreen';
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
