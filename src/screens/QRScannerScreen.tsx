import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';

export const QRScannerScreen: React.FC = () => {
    return (
        <View style={styles.container}>
            <Header title="QR 스캔" showBack />
            <View style={styles.cameraContainer}>
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerFrame} />
                </View>
                <Typography color={Colors.text} style={styles.hintText}>
                    QR 코드를 사각형 안에 맞춰주세요
                </Typography>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerOverlay: {
        width: 250,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: Colors.primary,
        borderRadius: 20,
    },
    hintText: {
        marginTop: 40,
        fontSize: 16,
    },
});
