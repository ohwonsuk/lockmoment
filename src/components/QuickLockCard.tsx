import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';

interface Props {
    onPress?: () => void;
}

export const QuickLockCard: React.FC<Props> = ({ onPress }) => {
    return (
        <TouchableOpacity style={styles.container} activeOpacity={0.8} onPress={onPress}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    {/* Simple Lock Icon */}
                    <View style={styles.lockIcon} />
                </View>
                <Typography variant="h1" bold style={styles.text}>바로 잠금</Typography>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.primary,
        marginHorizontal: 20,
        marginTop: 10,
        borderRadius: 16,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        // Shadow for premium feel
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    iconContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockIcon: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        borderRadius: 4,
    },
    text: {
        letterSpacing: -0.5,
    },
});
