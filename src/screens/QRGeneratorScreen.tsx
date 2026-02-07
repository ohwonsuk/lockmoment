import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { AuthService } from '../services/AuthService';
import { QrService } from '../services/QrService';
import { Platform, PermissionsAndroid, TextInput, Modal, FlatList } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { QRCard } from '../components/QRCard';
import { NativeLockControl } from '../services/NativeLockControl';
import { UniversalAppMapper } from '../services/UniversalAppMapper';
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import NSSHARE from 'react-native-share';

import { useAppNavigation } from '../navigation/NavigationContext';

export const QRGeneratorScreen: React.FC = () => {
    const { currentParams } = useAppNavigation();
    const params = currentParams || {};

    const [qrValue, setQrValue] = useState('');
    const [lockTitle, setLockTitle] = useState(params.title || '바로 잠금');
    const [duration, setDuration] = useState(params.duration || 60);
    const [isAppPickerVisible, setIsAppPickerVisible] = useState(false);
    const [installedApps, setInstalledApps] = useState<{ label: string, packageName: string }[]>([]);
    const [selectedApps, setSelectedApps] = useState<string[]>(params.apps || UniversalAppMapper.getDefaultUniversalIds());

    const cardRef = useRef<any>(null);

    useEffect(() => {
        generateQR();
    }, []);

    const generateQR = async () => {
        try {
            const qrType = params.type === 'SCHEDULED' ? 'USER_SCHEDULE_LOCK' : 'USER_INSTANT_LOCK';
            console.log(`[QRGenerator] Generating ${qrType} QR...`);
            const result = await QrService.generateQr(
                qrType,
                duration,
                lockTitle,
                selectedApps
            );

            if (result && result.success) {
                setQrValue(result.payload || result.qr_id);
                console.log("[QRGenerator] QR Generated successfully");
            } else {
                const deviceData = await AuthService.getDeviceData();
                const fallbackPayload = {
                    v: 1,
                    type: 'DYNAMIC',
                    title: lockTitle,
                    duration,
                    apps: selectedApps,
                    issuer: deviceData.deviceId,
                    exp: Math.floor(Date.now() / 1000) + 3600,
                };
                setQrValue(JSON.stringify(fallbackPayload));
                console.warn("[QRGenerator] Backend QR failed, using fallback");
            }
        } catch (error) {
            console.error("[QRGenerator] Failed to generate QR:", error);
        }
    };

    const handleSelectApps = async () => {
        try {
            // Get all universal mappings
            const universalApps = UniversalAppMapper.getDefaultUniversalIds();
            const initialList = universalApps.map(id => ({ label: id.charAt(0).toUpperCase() + id.slice(1), packageName: id, isUniversal: true }));

            if (Platform.OS === 'android') {
                const apps = await NativeLockControl.getInstalledApps();
                // Merge or filter? Let's show all.
                const combined = [
                    ...initialList,
                    ...apps.filter(app => !universalApps.includes(UniversalAppMapper.mapToUniversal(app.packageName, 'android')))
                ];
                setInstalledApps(combined);
            } else {
                setInstalledApps(initialList);
            }
            setIsAppPickerVisible(true);
        } catch (e) {
            console.error("App Selection Error:", e);
        }
    };

    const toggleApp = (packageName: string) => {
        setSelectedApps(prev =>
            prev.includes(packageName)
                ? prev.filter(p => p !== packageName)
                : [...prev, packageName]
        );
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            if (Platform.OS === 'android') {
                const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
                const status = await PermissionsAndroid.request(permission);
                if (status !== 'granted') return;
            }
            await CameraRoll.save(uri, { type: 'photo' });
            Alert.alert("저장 완료", "QR 코드가 갤러리에 저장되었습니다.");
        } catch (error) {
            console.error("Download Error:", error);
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            await NSSHARE.open({
                title: 'QR 코드 공유',
                url: uri,
                type: 'image/png',
                message: `락모먼트 집중 모드 참여를 위한 QR 코드입니다: ${lockTitle}`,
            });
        } catch (error) {
            console.error("Share Error:", error);
        }
    };

    return (
        <View style={styles.container}>
            <Header title="QR 생성" showBack />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.configContainer}>
                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 제목</Typography>
                        <TextInput
                            style={styles.textInput}
                            value={lockTitle}
                            onChangeText={setLockTitle}
                            placeholder="예: 영어 단어 암기"
                            placeholderTextColor={Colors.statusInactive}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 시간 (분)</Typography>
                        <TextInput
                            style={styles.textInput}
                            value={duration.toString()}
                            onChangeText={(val) => setDuration(parseInt(val) || 0)}
                            keyboardType="numeric"
                            placeholder="60"
                            placeholderTextColor={Colors.statusInactive}
                        />
                    </View>

                    <TouchableOpacity style={styles.appPickerButton} onPress={handleSelectApps}>
                        <Icon name="apps-outline" size={20} color={Colors.primary} />
                        <Typography color={Colors.primary} bold>
                            {selectedApps.length > 0 ? `${selectedApps.length}개의 앱 선택됨` : "잠글 앱 선택하기"}
                        </Typography>
                    </TouchableOpacity>
                </View>

                <View style={styles.qrContainer}>
                    <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                        <QRCard
                            title={lockTitle || '바로 잠금'}
                            subtitle={`${duration}분 집중 모드`}
                            value={qrValue || 'pending'}
                        />
                    </ViewShot>
                    <Typography color={Colors.textSecondary} style={styles.qrHint}>
                        상단의 정보를 수정한 후 아래 'QR 생성/갱신' 버튼을 누르세요
                    </Typography>
                </View>

                <View style={styles.actionContainer}>
                    <TouchableOpacity style={styles.generateButton} onPress={generateQR}>
                        <Icon name="refresh-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">QR 생성/갱신</Typography>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                        <Icon name="download-outline" size={20} color={Colors.text} />
                        <Typography bold>이미지 다운로드</Typography>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                        <Icon name="share-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">공유하기</Typography>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <Modal visible={isAppPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <Header title="앱 선택" showBack onBack={() => setIsAppPickerVisible(false)} />
                    <FlatList
                        data={installedApps}
                        keyExtractor={(item) => item.packageName}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.appItem}
                                onPress={() => toggleApp(item.packageName)}
                            >
                                <View style={[styles.checkbox, selectedApps.includes(item.packageName) && styles.checkboxActive]}>
                                    {selectedApps.includes(item.packageName) && <Icon name="checkmark" size={16} color="#FFF" />}
                                </View>
                                <Typography style={styles.appLabel}>{item.label}</Typography>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ padding: 20 }}
                    />
                    <TouchableOpacity
                        style={styles.modalConfirmButton}
                        onPress={() => setIsAppPickerVisible(false)}
                    >
                        <Typography bold color="#FFF">확인</Typography>
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        padding: 20,
        alignItems: 'center',
    },
    configContainer: {
        width: '100%',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    inputGroup: {
        marginBottom: 16,
    },
    textInput: {
        backgroundColor: Colors.background,
        borderRadius: 8,
        padding: 12,
        color: Colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    appPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    generateButton: {
        flexDirection: 'row',
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    qrHint: {
        marginTop: 20,
        fontSize: 14,
        textAlign: 'center',
    },
    actionContainer: {
        width: '100%',
        gap: 12,
        marginBottom: 30,
    },
    downloadButton: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        paddingVertical: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    shareButton: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        paddingVertical: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    appItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: Colors.primary,
    },
    appLabel: {
        fontSize: 16,
    },
    modalConfirmButton: {
        backgroundColor: Colors.primary,
        margin: 20,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    }
});
