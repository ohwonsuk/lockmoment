import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppNavigation } from '../navigation/NavigationContext';

interface Props {
    title?: string;
    showBack?: boolean;
}

export const Header: React.FC<Props> = ({ title = "락모먼트", showBack = false }) => {
    const insets = useSafeAreaInsets();
    const { navigate, currentScreen } = useAppNavigation();

    return (
        <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
            <View style={styles.leftContainer}>
                {showBack && (
                    <TouchableOpacity style={styles.backButton} onPress={() => navigate('Dashboard')}>
                        <Typography color={Colors.primary} bold>{"<"}</Typography>
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => navigate('Dashboard')}>
                    <Typography variant="h1">{title}</Typography>
                </TouchableOpacity>
            </View>

            <View style={styles.rightIcons}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => navigate('Permissions')}
                >
                    <View style={[
                        styles.shieldIcon,
                        currentScreen === 'Permissions' && { borderColor: Colors.primary }
                    ]} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => navigate('Settings')}
                >
                    <View style={[
                        styles.gearIcon,
                        currentScreen === 'Settings' && { borderColor: Colors.primary }
                    ]} />
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
    shieldIcon: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: Colors.text,
        borderRadius: 6,
    },
    gearIcon: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: Colors.text,
        borderRadius: 12,
    },
});
