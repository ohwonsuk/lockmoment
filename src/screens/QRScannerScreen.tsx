import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Modal, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { StorageService, Schedule } from '../services/StorageService';
import { NativeLockControl } from '../services/NativeLockControl';
import { QrService, QrScanResponse } from '../services/QrService';
import { ParentChildService } from '../services/ParentChildService';
import { UniversalAppMapper } from '../services/UniversalAppMapper';
import { LockService } from '../services/LockService';
import { MetaDataService, AppCategory } from '../services/MetaDataService';
import { Platform } from 'react-native';
import { useAlert } from '../context/AlertContext';

const isIOS = Platform.OS === 'ios';

export const QRScannerScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const { showAlert } = useAlert();
    const [hasPermission, setHasPermission] = useState(false);
    const device = useCameraDevice('back');

    const [isProcessing, setIsProcessing] = useState(false);
    const isScanningRef = React.useRef(false);
    const [scanResult, setScanResult] = useState<QrScanResponse['lockPolicy'] | null>(null);
    const [registrationInfo, setRegistrationInfo] = useState<QrScanResponse['registrationInfo'] | null>(null);
    const [rawQrData, setRawQrData] = useState<string | null>(null);
    const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
    const [isRegistrationModalVisible, setIsRegistrationModalVisible] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [allCategories, setAllCategories] = useState<AppCategory[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [iosCounts, setIosCounts] = useState({ apps: 0, categories: 0 });

    useEffect(() => {
        const loadInitialData = async () => {
            const role = await StorageService.getUserRole();
            setUserRole(role);

            const categories = await MetaDataService.getAppCategories();
            setAllCategories(categories);
        };
        const checkPermission = async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === 'granted');

            if (status !== 'granted') {
                showAlert({
                    title: "카메라 권한 필요",
                    message: "QR 스캔을 위해 카메라 권한이 필요합니다. 설정에서 권한을 허용해주세요.",
                    cancelText: "취소",
                    confirmText: "설정으로 이동",
                    onCancel: () => navigate('Dashboard'),
                    onConfirm: () => Linking.openSettings()
                });
            }
        };

        loadInitialData();
        checkPermission();
    }, []);

    const codeScanner = useCodeScanner({
        codeTypes: ['qr'],
        onCodeScanned: (codes) => {
            if (codes.length > 0 && codes[0].value && !isScanningRef.current && !isConfirmModalVisible && !isRegistrationModalVisible) {
                isScanningRef.current = true;
                const scannedData = codes[0].value;
                handleScannedData(scannedData);
            }
        }
    });

    const handleScannedData = async (data: string) => {
        setIsProcessing(true);
        setRawQrData(data);
        try {
            console.log("Processing QR:", data);

            let qrPayload: any = null;
            try {
                qrPayload = JSON.parse(data);
            } catch (e) {
                // If not JSON, maybe it's a raw token string or URL - handle appropriately if needed
            }

            // Client-side exp check if available
            if (qrPayload && qrPayload.exp) {
                const now = Math.floor(Date.now() / 1000);
                if (qrPayload.exp < now) {
                    throw new Error("만료된 QR 코드입니다.");
                }
            }

            // 2. 서버 검증 API 호출
            const response = await QrService.scanQr(data);

            if (response && response.success) {
                if (response.registrationInfo) {
                    setRegistrationInfo(response.registrationInfo);
                    setIsRegistrationModalVisible(true);
                } else if (response.lockPolicy) {
                    setScanResult(response.lockPolicy);
                    if (isIOS) {
                        try {
                            const appCount = await NativeLockControl.getSelectedAppCount();
                            const catCount = await NativeLockControl.getSelectedCategoryCount();
                            setIosCounts({
                                apps: appCount || 0,
                                categories: catCount || 0
                            });
                        } catch (e) {
                            console.error("Failed to get iOS selection count:", e);
                        }
                    }
                    setIsConfirmModalVisible(true);
                } else if (response.purpose === 'ATTENDANCE_ONLY') {
                    setIsProcessing(false);
                    isScanningRef.current = false;
                    showAlert({
                        title: "출석 완료",
                        message: "출석이 성공적으로 확인되었습니다.",
                        onConfirm: () => navigate('Dashboard')
                    });
                } else {
                    throw new Error("처리할 수 없는 QR 데이터입니다.");
                }
            } else {
                throw new Error(response?.message || "스캔 처리에 실패했습니다.");
            }

        } catch (error: any) {
            console.error("QR Scan Error:", error);
            setIsProcessing(false);
            isScanningRef.current = false;
            showAlert({
                title: "오류",
                message: error.message || "QR 처리 중 오류가 발생했습니다.",
                cancelText: "나가기",
                confirmText: "재시도",
                onCancel: () => navigate('Dashboard'),
                onConfirm: () => {
                    // Reset will happen automatically on next scan attempt if needed
                    // but we can also do it here
                }
            });
        } finally {
            // Processing should be false once the modal is shown or error is handled
            // But we keep it true while the modal is opening to avoid double-triggers
        }
    };

    const handleConfirmRegistration = async () => {
        if (!registrationInfo || !rawQrData) return;
        setIsApplying(true);
        try {
            console.log("Linking with payload:", rawQrData);
            const response = await ParentChildService.linkChild(rawQrData);

            setIsRegistrationModalVisible(false);
            if (response.success) {
                // 기기 이전 등으로 인한 신원 전환 처리 (새 토큰 수신 시)
                if (response.data?.accessToken) {
                    console.log("[QRScanner] Identity merged, updating tokens...");
                    await StorageService.setAccessToken(response.data.accessToken);
                    if (response.data.refreshToken) {
                        await StorageService.setRefreshToken(response.data.refreshToken);
                    }
                    if (response.data.user) {
                        await StorageService.setUserProfile(response.data.user);
                        if (response.data.user.role) {
                            await StorageService.setUserRole(response.data.user.role);
                        }
                    }
                }

                // 연결 성공 후 즉시 스케줄 동기화 실행
                console.log("[QRScanner] Linking success, triggering schedule sync...");
                await LockService.syncSchedules();

                showAlert({
                    title: "등록 완료",
                    message: `[${registrationInfo.parentName}] 님의 기기와 연결되었습니다. 이제 보호자가 원격으로 잠금을 관리할 수 있습니다.`,
                    onConfirm: () => navigate('Dashboard')
                });
            } else {
                showAlert({ title: "등록 실패", message: response.message || "부모 기기와 연결하는 중 오류가 발생했습니다." });
            }
        } catch (error: any) {
            console.error("Registration Error:", error);
            showAlert({ title: "등록 실패", message: error.message || "부모 기기와 연결하는 중 오류가 발생했습니다." });
        } finally {
            setIsApplying(false);
            setRawQrData(null);
        }
    };

    const handleConfirmLock = async () => {
        if (!scanResult) return;
        setIsApplying(true);
        try {
            // Check permissions first
            const platform = isIOS ? 'ios' : 'android';
            let hasPermission = false;

            if (platform === 'ios') {
                const authStatus = await NativeLockControl.checkAuthorization();
                hasPermission = authStatus === 2;
            } else {
                hasPermission = await NativeLockControl.checkAccessibilityPermission();
            }

            if (!hasPermission) {
                setIsConfirmModalVisible(false);
                setIsApplying(false);
                showAlert({
                    title: "권한 필요",
                    message: "잠금 기능을 사용하려면 먼저 권한을 허용해주세요.\n\n권한 설정 페이지로 이동하시겠습니까?",
                    cancelText: "취소",
                    confirmText: "권한 설정",
                    onCancel: () => navigate('Dashboard'),
                    onConfirm: () => navigate('Permissions')
                });
                return;
            }

            const { name, durationMinutes, allowedApps, preventAppRemoval, lock_type, timeWindow, days } = scanResult;
            const durationMs = durationMinutes * 60 * 1000;

            const nativeAppIds = UniversalAppMapper.mapToNative(allowedApps || [], platform);
            const prevent = preventAppRemoval !== undefined ? preventAppRemoval : await StorageService.getPreventAppRemoval();

            // iOS 유의사항: APP 모드인데 선택된 이력이 없는 경우 Picker 노출 (FULL은 Picker 불필요)
            if (isIOS && lock_type !== 'FULL') {
                const aCount = await NativeLockControl.getSelectedAppCount();
                const cCount = await NativeLockControl.getSelectedCategoryCount();
                const count = (aCount || 0) + (cCount || 0);

                if (count === 0) {
                    setIsConfirmModalVisible(false); // Hide modal first so alert is visible!
                    await new Promise<void>((resolve) => {
                        showAlert({
                            title: "잠금 앱 설정 필요",
                            message: "iOS 보안 정책상 잠금 대상 앱 또는 카테고리를 1개 이상 직접 선택해 주셔야 합니다.\n다음 화면에서 제한할 항목을 선택해 주세요.",
                            onConfirm: () => resolve()
                        });
                    });
                    const newCount = await NativeLockControl.presentFamilyActivityPicker('APP') as number;
                    if (newCount === 0) {
                        setIsApplying(false);
                        setIsProcessing(false);
                        isScanningRef.current = false;
                        return; // User cancelled or didn't select anything
                    }
                }
            }

            // 잠금 실행 (예약 vs 즉시)
            if (timeWindow && days && days.length > 0) {
                const [start, end] = timeWindow.split('-');

                const currentSchedules = await StorageService.getSchedules();
                const isDuplicate = currentSchedules.some(s =>
                    s.name === name &&
                    s.startTime === start &&
                    s.endTime === end &&
                    JSON.stringify((s.days || []).slice().sort()) === JSON.stringify([...days].sort()) &&
                    s.source === 'LOCAL'
                );

                if (isDuplicate) {
                    setIsConfirmModalVisible(false);
                    setIsApplying(false);
                    setIsProcessing(false);
                    isScanningRef.current = false;
                    showAlert({
                        title: "안내",
                        message: "이미 동일한 예약 잠금이 등록되어 있습니다.",
                        onConfirm: () => navigate('Dashboard')
                    });
                    return;
                }

                // 1. Save to Storage for persistence and list visibility
                const newSchedule: Schedule = {
                    id: `qr_${Date.now()}`,
                    name: name || "예약 잠금",
                    startTime: start,
                    endTime: end,
                    days: days,
                    lockType: lock_type || 'APP',
                    isActive: true,
                    lockedApps: nativeAppIds,
                    source: 'LOCAL',
                    isReadOnly: userRole === 'STUDENT' || userRole === 'CHILD'
                };

                await StorageService.saveSchedule(newSchedule);
                console.log("[QRScanner] Schedule saved to storage:", newSchedule.id);

                // Close modal immediately so the UI doesn't look stuck
                // 2. Sync with Native in background (DO NOT AWAIT - to prevent UI hang)
                console.log("[QRScanner] Triggering background sync...");
                LockService.syncSchedules()
                    .then(() => console.log("[QRScanner] Background sync completed"))
                    .catch(e => console.error("[QRScanner] Background sync failed:", e));

                // Success alert and navigate
                showAlert({
                    title: "예약 등록 완료",
                    message: `[${name}] 예약 잠금이 등록되었습니다.\n설정된 시간에 자동으로 잠금이 시작됩니다.`,
                    onConfirm: () => navigate('Dashboard')
                });
            } else {
                await NativeLockControl.startLock(
                    durationMs,
                    lock_type || 'APP',
                    name || "QR 잠금",
                    JSON.stringify(nativeAppIds),
                    prevent
                );

                setIsConfirmModalVisible(false);
                setIsApplying(false);
                setIsProcessing(false);
                isScanningRef.current = false;

                showAlert({
                    title: "잠금 활성화",
                    message: `[${name}] 집중 모드가 시작되었습니다.`,
                    onConfirm: () => navigate('Dashboard')
                });
            }
        } catch (error: any) {
            console.error("Lock Start Error:", error);
            showAlert({ title: "오류", message: "잠금을 시작하는 중 오류가 발생했습니다." });
        } finally {
            setIsConfirmModalVisible(false);
            setIsApplying(false);
            setIsProcessing(false);
            isScanningRef.current = false;
        }
    };

    const getAppLabel = (id: string) => {
        // 우선 카테고리에서 찾아보고 없으면 기본 변환
        const cat = allCategories.find(c => c.id === id);
        if (cat) return cat.display_name;
        return id.charAt(0).toUpperCase() + id.slice(1);
    };

    const getCategoryLabel = (id: string) => {
        return allCategories.find(c => c.id === id)?.display_name || id;
    };

    return (
        <View style={styles.container}>
            <Header title="QR 스캔" showBack onBack={() => navigate('Dashboard')} />
            <View style={styles.cameraContainer}>
                {hasPermission && device && (
                    <Camera
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={!isConfirmModalVisible && !isRegistrationModalVisible}
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
                                <Typography bold style={{ fontSize: 18 }}>{scanResult?.name}</Typography>
                            </View>

                            <View style={styles.infoRow}>
                                <Typography variant="caption" color={Colors.textSecondary}>잠금 시간</Typography>
                                <Typography bold style={{ fontSize: 18 }}>
                                    {scanResult?.timeWindow && scanResult?.days ?
                                        `${scanResult.timeWindow} (${scanResult.days.map(d => {
                                            const map: Record<string, string> = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
                                            return map[d] || d;
                                        }).join(',')})` :
                                        `${scanResult?.durationMinutes}분`}
                                </Typography>
                            </View>

                            <View style={styles.infoRow}>
                                <Typography variant="caption" color={Colors.textSecondary}>
                                    잠금 대상 {scanResult?.lock_type === 'FULL' ? '(전체)' : (
                                        isIOS ? `(카테고리 ${iosCounts.categories}개, 앱 ${iosCounts.apps}개)` : `(${((scanResult?.allowedApps?.length || 0) + (scanResult?.blockedCategories?.length || 0))})`
                                    )}
                                </Typography>
                                <View style={styles.appsList}>
                                    {/* 카테고리 표시 */}
                                    {scanResult?.blockedCategories?.map((cat: string, idx: number) => (
                                        <View key={`cat-${idx}`} style={[styles.appBadge, { backgroundColor: Colors.primary + '20', borderWidth: 1, borderColor: Colors.primary }]}>
                                            <Typography style={{ fontSize: 12, color: Colors.primary }}>{getCategoryLabel(cat)}</Typography>
                                        </View>
                                    ))}
                                    {/* 개별 앱 표시 */}
                                    {Array.isArray(scanResult?.allowedApps) && scanResult?.allowedApps.length > 0 ? (
                                        scanResult?.allowedApps?.map((app: string, idx: number) => (
                                            <View key={`app-${idx}`} style={styles.appBadge}>
                                                <Typography style={{ fontSize: 12, color: '#FFF' }}>{getAppLabel(app)}</Typography>
                                            </View>
                                        ))
                                    ) : (
                                        (!scanResult?.blockedCategories || scanResult?.blockedCategories.length === 0) && (
                                            <Typography variant="caption" color={Colors.textSecondary}>
                                                {scanResult?.lock_type === 'FULL' ? '모든 앱 및 카테고리가 차단됩니다.' : '제한 없음'}
                                            </Typography>
                                        )
                                    )}
                                </View>
                            </View>

                            <View style={styles.noticeBox}>
                                <Typography style={{ fontSize: 12, color: Colors.textSecondary }}>
                                    {(scanResult?.timeWindow && scanResult?.days && scanResult.days.length > 0) ?
                                        '확인 버튼을 누르면 예정된 시간에 잠금이 시작됩니다.' :
                                        '확인 버튼을 누르면 즉시 잠금이 시작됩니다.'}
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
                                    isScanningRef.current = false;
                                    navigate('Dashboard');
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

            {/* Registration Confirmation Modal */}
            <Modal visible={isRegistrationModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Icon name="person-add" size={32} color={Colors.primary} />
                            <Typography variant="h2" bold style={{ marginTop: 10 }}>보호자 연결 확인</Typography>
                        </View>

                        <View style={styles.modalBody}>
                            <View style={styles.infoRow}>
                                <Typography variant="caption" color={Colors.textSecondary}>보호자(부모)</Typography>
                                <Typography bold style={{ fontSize: 18 }}>{registrationInfo?.parentName}</Typography>
                            </View>

                            <View style={styles.infoRow}>
                                <Typography variant="caption" color={Colors.textSecondary}>등록될 이름</Typography>
                                <Typography bold style={{ fontSize: 18 }}>{registrationInfo?.childName}</Typography>
                            </View>

                            <View style={styles.noticeBox}>
                                <Typography style={{ fontSize: 12, color: Colors.textSecondary }}>
                                    연결에 동의하시면 보호자가 이 기기의 잠금 상태를 원격으로 제어할 수 있게 됩니다.
                                </Typography>
                            </View>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: Colors.card }]}
                                onPress={() => {
                                    setIsRegistrationModalVisible(false);
                                    setIsProcessing(false);
                                }}
                            >
                                <Typography bold>거부</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: Colors.primary }]}
                                onPress={handleConfirmRegistration}
                                disabled={isApplying}
                            >
                                {isApplying ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Typography bold color="#FFF">연결 동의</Typography>
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
