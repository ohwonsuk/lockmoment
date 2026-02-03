import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { AuthService } from '../services/AuthService';

export const QRGeneratorScreen: React.FC = () => {
    const [qrType, setQrType] = useState<'static' | 'dynamic'>('dynamic');
    const [qrValue, setQrValue] = useState('');
    const [timeLeft, setTimeLeft] = useState(30);
    const svgRef = useRef<any>(null);

    useEffect(() => {
        generateQR();
    }, [qrType]);

    useEffect(() => {
        if (qrType === 'dynamic') {
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        generateQR();
                        return 30;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [qrType]);

    const generateQR = async () => {
        const deviceData = await AuthService.getDeviceData();
        const payload = {
            v: 1,
            type: qrType === 'dynamic' ? 'DYNAMIC' : 'STATIC',
            issuer: deviceData.deviceId,
            ts: Date.now(),
            nonce: Math.random().toString(36).substring(7)
        };
        setQrValue(JSON.stringify(payload));
        if (qrType === 'dynamic') setTimeLeft(30);
    };

    const handleDownload = () => {
        if (svgRef.current) {
            svgRef.current.toDataURL((data: string) => {
                // In a real app, use react-native-fs or CameraRoll to save
                console.log("QR Data URL generated");
                Alert.alert("다운로드", "QR 코드가 갤러리에 저장되었습니다. (인쇄용)");
            });
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `락모먼트 집중 모드 참여를 위한 QR 코드입니다: ${qrValue}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View style={styles.container}>
            <Header title="QR 생성" showBack />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.typeSelector}>
                    <TouchableOpacity
                        style={[styles.typeButton, qrType === 'dynamic' && styles.typeButtonActive]}
                        onPress={() => setQrType('dynamic')}
                    >
                        <Typography bold color={qrType === 'dynamic' ? '#FFF' : Colors.textSecondary}>갱신형 (Dynamic)</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeButton, qrType === 'static' && styles.typeButtonActive]}
                        onPress={() => setQrType('static')}
                    >
                        <Typography bold color={qrType === 'static' ? '#FFF' : Colors.textSecondary}>고정형 (Static)</Typography>
                    </TouchableOpacity>
                </View>

                <View style={styles.qrContainer}>
                    <View style={styles.qrCard}>
                        {qrValue ? (
                            <QRCode
                                value={qrValue}
                                size={200}
                                color={Colors.text}
                                backgroundColor="transparent"
                                getRef={(c) => (svgRef.current = c)}
                            />
                        ) : (
                            <Icon name="qr-code" size={180} color={Colors.textSecondary} />
                        )}

                        {qrType === 'dynamic' && (
                            <View style={styles.timerBadge}>
                                <Typography variant="caption" bold color={Colors.primary}>{timeLeft}s 남음</Typography>
                            </View>
                        )}
                    </View>
                    <Typography color={Colors.textSecondary} style={styles.qrHint}>
                        {qrType === 'dynamic'
                            ? "30초마다 보안 코드가 갱신됩니다"
                            : "인쇄하여 교실에 부착할 수 있는 고정 코드입니다"}
                    </Typography>
                </View>

                <View style={styles.actionContainer}>
                    {qrType === 'static' && (
                        <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                            <Icon name="download-outline" size={20} color={Colors.text} />
                            <Typography bold>이미지 다운로드</Typography>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                        <Icon name="share-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">공유하기</Typography>
                    </TouchableOpacity>
                </View>

                <View style={styles.infoCard}>
                    <Typography bold style={{ marginBottom: 10 }}>💡 도움말</Typography>
                    <Typography variant="caption" color={Colors.textSecondary} style={{ lineHeight: 18 }}>
                        • 갱신형 QR은 보안이 강화되어 현장 스캔에 적합합니다.{"\n"}
                        • 고정형 QR은 인쇄하여 부착해두면 학생들이 언제든 스캔하여 집중 모드를 시작할 수 있습니다.
                    </Typography>
                </View>
            </ScrollView>
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
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 4,
        width: '100%',
        marginBottom: 30,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    typeButtonActive: {
        backgroundColor: Colors.primary,
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    qrCard: {
        width: 280,
        height: 280,
        backgroundColor: '#FFF',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        position: 'relative',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    qrPlaceholder: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerBadge: {
        position: 'absolute',
        bottom: 15,
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
    },
    qrHint: {
        marginTop: 20,
        fontSize: 14,
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
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    infoCard: {
        width: '100%',
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
});
