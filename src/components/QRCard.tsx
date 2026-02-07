import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { Icon } from './Icon';

interface QRCardProps {
    title: string;
    subtitle: string;
    value: string;
    size?: number;
    getRef?: (ref: any) => void;
}

export const QRCard: React.FC<QRCardProps> = ({ title, subtitle, value, size = 200, getRef }) => {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Icon name="lock-closed" size={24} color={Colors.primary} />
                <Typography variant="h2" bold style={styles.title}>{title}</Typography>
            </View>

            <View style={styles.qrWrapper}>
                <QRCode
                    value={value || 'placeholder'}
                    size={size}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                    getRef={getRef}
                />
            </View>

            <View style={styles.footer}>
                <Typography variant="caption" color={Colors.statusInactive} bold>{subtitle}</Typography>
                <Typography variant="caption" color={Colors.statusInactive} style={styles.brand}>LockMoment</Typography>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        width: 300,
        // Shadow for UI display
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        width: '100%',
        justifyContent: 'center',
    },
    title: {
        color: '#000000',
        fontSize: 18,
    },
    qrWrapper: {
        padding: 10,
        backgroundColor: '#FFFFFF',
    },
    footer: {
        marginTop: 20,
        alignItems: 'center',
        width: '100%',
    },
    brand: {
        marginTop: 4,
        fontSize: 10,
        opacity: 0.5,
    }
});
