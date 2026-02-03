import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner, CameraPermissionStatus } from 'react-native-vision-camera';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';

export const QRScannerScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [hasPermission, setHasPermission] = useState(false);
    const device = useCameraDevice('back');

    useEffect(() => {
        const checkPermission = async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === 'granted');

            if (status !== 'granted') {
                Alert.alert(
                    "카메라 권한 필요",
                    "QR 스캔을 위해 카메라 권한이 필요합니다. 설정에서 권한을 허용해주세요.",
                    [
                        { text: "취소", onPress: () => navigate('Dashboard'), style: "cancel" },
                        { text: "설정으로 이동", onPress: () => Linking.openSettings() }
                    ]
                );
            }
        };
        checkPermission();
    }, []);

    const codeScanner = useCodeScanner({
        codeTypes: ['qr'],
        onCodeScanned: (codes) => {
            if (codes.length > 0 && codes[0].value) {
                const scannedData = codes[0].value;
                console.log("Scanned QR:", scannedData);

                // Handle scanned QR data (Validate and Trigger Lock)
                handleScannedData(scannedData);
            }
        }
    });

    const handleScannedData = (data: string) => {
        // Placeholder for validation logic
        // If valid, start lock
        Alert.alert("QR 스캔 성공", `데이터: ${data}\n잠금을 시작합니다.`, [
            { text: "확인", onPress: () => navigate('Dashboard') }
        ]);
    };

    if (!device || !hasPermission) {
        return (
            <View style={styles.container}>
                <Header title="QR 스캔" showBack />
                <View style={[styles.cameraContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Typography color={Colors.textSecondary}>카메라를 준비 중입니다...</Typography>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Header title="QR 스캔" showBack />
            <View style={styles.cameraContainer}>
                <Camera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={true}
                    codeScanner={codeScanner}
                />
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerFrame}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                    <Typography color="#FFF" style={styles.hintText}>
                        QR 코드를 사각형 안에 맞춰주세요
                    </Typography>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    scannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    scannerFrame: {
        width: 250,
        height: 250,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderColor: Colors.primary,
        borderWidth: 4,
    },
    topLeft: {
        top: -2,
        left: -2,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: -2,
        right: -2,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: -2,
        left: -2,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: -2,
        right: -2,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    hintText: {
        marginTop: 40,
        fontSize: 16,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 10,
    },
});
