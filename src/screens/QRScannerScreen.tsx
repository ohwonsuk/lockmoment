import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Linking, Modal, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { StorageService } from '../services/StorageService';
import { NativeLockControl } from '../services/NativeLockControl';
import { QrService, QrScanResponse } from '../services/QrService';
import { UniversalAppMapper } from '../services/UniversalAppMapper';
import { Platform } from 'react-native';

const isIOS = Platform.OS === 'ios';

export const QRScannerScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [hasPermission, setHasPermission] = useState(false);
    const device = useCameraDevice('back');

    const [isProcessing, setIsProcessing] = useState(false);
    const [scanResult, setScanResult] = useState<QrScanResponse['lockPolicy'] | null>(null);
    const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

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
            if (codes.length > 0 && codes[0].value && !isProcessing && !isConfirmModalVisible) {
                const scannedData = codes[0].value;
                handleScannedData(scannedData);
            }
        }
    });

    const handleScannedData = async (data: string) => {
        setIsProcessing(true);
        try {
            console.log("Processing QR:", data);

            let qrPayload: any = null;
            try {
                qrPayload = JSON.parse(data);
            } catch (e) {
                throw new Error("유효하지 않은 QR 형식입니다.");
            }

            // 1. 클라이언트 사전 검증: 만료 시간(exp) 확인
            if (qrPayload.exp) {
                const now = Math.floor(Date.now() / 1000);
                if (qrPayload.exp < now) {
                    throw new Error("만료된 QR 코드입니다.");
                }
            }

            // 2. 서버 검증 API 호출
            const response = await QrService.scanQr(data);

            if (response && response.success && response.lockPolicy) {
                setScanResult(response.lockPolicy);
                setIsConfirmModalVisible(true);
            } else {
                throw new Error(response?.message || "스캔 처리에 실패했습니다.");
            }

        } catch (error: any) {
            console.error("QR Scan Error:", error);
            Alert.alert("오류", error.message || "QR 처리 중 오류가 발생했습니다.", [
                { text: "재시도", onPress: () => setIsProcessing(false) },
                { text: "나가기", onPress: () => navigate('Dashboard'), style: "cancel" }
            ]);
        }
    };

    const handleConfirmLock = async () => {
        if (!scanResult) return;
        setIsApplying(true);
        try {
            const { name, durationMinutes, allowedApps, preventAppRemoval } = scanResult;
            const durationMs = durationMinutes * 60 * 1000;

            const platform = isIOS ? 'ios' : 'android';
            const nativeAppIds = UniversalAppMapper.mapToNative(allowedApps || [], platform);
            const prevent = preventAppRemoval !== undefined ? preventAppRemoval : await StorageService.getPreventAppRemoval();

            // iOS 유의사항: 선택된 이력이 없는 경우 Picker 노출
            if (isIOS) {
                const count = await NativeLockControl.getSelectedAppCount();
                if (count === 0) {
                    await new Promise<void>((resolve) => {
                        Alert.alert(
                            "잠금 앱 설정 필요",
                            "iOS 보안 정책상 잠금 대상 앱을 직접 선택해 주셔야 합니다.\n다음 화면에서 차단할 앱들을 선택해 주세요.",
                            [{ text: "확인", onPress: () => resolve() }]
                        );
                    });
                    const newCount = await NativeLockControl.presentFamilyActivityPicker('app');
                    if (newCount === 0) {
                        setIsApplying(false);
                        return; // User cancelled or didn't select anything
                    }
                }
            }

            // 잠금 실행
            await NativeLockControl.startLock(
                durationMs,
                'app',
                name || "QR 잠금",
                JSON.stringify(nativeAppIds),
                prevent
            );

            setIsConfirmModalVisible(false);
            Alert.alert("잠금 활성화", `[${name}] 집중 모드가 시작되었습니다.`, [
                { text: "확인", onPress: () => navigate('Dashboard') }
            ]);
        } catch (error: any) {
            console.error("Lock Start Error:", error);
            Alert.alert("오류", "잠금을 시작하는 중 오류가 발생했습니다.");
        } finally {
            setIsApplying(false);
        }
    };

    const getAppLabel = (id: string) => {
        return id.charAt(0).toUpperCase() + id.slice(1);
    };

    return (
        <View style={styles.container}>
            <Header title="QR 스캔" showBack onBack={() => navigate('Dashboard')} />
            <View style={styles.cameraContainer}>
                {hasPermission && device && (
                    <Camera
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={!isConfirmModalVisible}
                        codeScanner={codeScanner}
                    />
                )}
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

            {/* Confirmation Modal */}
            <Modal visible={isConfirmModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Icon name="lock-closed" size={32} color={Colors.primary} />
                            <Typography variant="h2" bold style={{ marginTop: 10 }}>잠금 실행 확인</Typography>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.infoRow}>
                                <Typography variant="caption" color={Colors.textSecondary}>잠금 이름</Typography>
                                <Typography bold size={18}>{scanResult?.name}</Typography>
                            </View>

                            <View style={styles.infoRow}>
                                <Typography variant="caption" color={Colors.textSecondary}>잠금 시간</Typography>
                                <Typography bold size={18}>{scanResult?.durationMinutes}분</Typography>
                            </View>

                            <View style={styles.infoRow}>
                                <Typography variant="caption" color={Colors.textSecondary}>잠금 대상 앱 ({scanResult?.allowedApps?.length || 0})</Typography>
                                <View style={styles.appsList}>
                                    {scanResult?.allowedApps?.map((app, idx) => (
                                        <View key={idx} style={styles.appBadge}>
                                            <Typography size={12} color="#FFF">{getAppLabel(app)}</Typography>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.noticeBox}>
                                <Typography size={12} color={Colors.textSecondary}>
                                    확인 버튼을 누르면 즉시 잠금이 시작됩니다.
                                    {isIOS && "\n(iOS는 최초 1회 앱 선택이 필요할 수 있습니다)"}
                                </Typography>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: Colors.card }]}
                                onPress={() => {
                                    setIsConfirmModalVisible(false);
                                    setIsProcessing(false);
                                }}
                            >
                                <Typography bold>취소</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: Colors.primary }]}
                                onPress={handleConfirmLock}
                                disabled={isApplying}
                            >
                                {isApplying ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Typography bold color="#FFF">잠금 시작</Typography>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    cameraContainer: { flex: 1, position: 'relative' },
    scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    scannerFrame: { width: 250, height: 250, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', position: 'relative' },
    corner: { position: 'absolute', width: 20, height: 20, borderColor: Colors.primary, borderWidth: 4 },
    topLeft: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0 },
    topRight: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0 },
    bottomLeft: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0 },
    bottomRight: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0 },
    hintText: { marginTop: 40, fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: Colors.background, borderRadius: 24, width: '100%', maxWidth: 400, padding: 24 },
    modalHeader: { alignItems: 'center', marginBottom: 20 },
    modalBody: { maxHeight: 300 },
    infoRow: { marginBottom: 15 },
    appsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
    appBadge: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    noticeBox: { backgroundColor: Colors.card, padding: 12, borderRadius: 12, marginTop: 10 },
    modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20 },
    modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});
