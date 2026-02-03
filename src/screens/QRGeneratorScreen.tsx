import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';

export const QRGeneratorScreen: React.FC = () => {
    const [qrType, setQrType] = useState<'static' | 'dynamic'>('dynamic');

    const handleDownload = () => {
        Alert.alert("다운로드", "QR 코드가 갤러리에 저장되었습니다. (인쇄용)");
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
                        <Typography bold color={qrType === 'dynamic' ? Colors.text : Colors.textSecondary}>갱신형 (Dynamic)</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.typeButton, qrType === 'static' && styles.typeButtonActive]}
                        onPress={() => setQrType('static')}
                    >
                        <Typography bold color={qrType === 'static' ? Colors.text : Colors.textSecondary}>고정형 (Static)</Typography>
                    </TouchableOpacity>
                </View>

                <View style={styles.qrContainer}>
                    <View style={styles.qrPlaceholder}>
                        <Icon name="qr-code" size={180} color={Colors.text} />
                        {qrType === 'dynamic' && (
                            <View style={styles.timerBadge}>
                                <Typography variant="caption" bold color={Colors.primary}>45s 남음</Typography>
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

                    <TouchableOpacity style={styles.shareButton}>
                        <Icon name="share-outline" size={20} color={Colors.text} />
                        <Typography bold>링크 공유하기</Typography>
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
    qrPlaceholder: {
        width: 280,
        height: 280,
        backgroundColor: Colors.card,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        position: 'relative',
    },
    timerBadge: {
        position: 'absolute',
        bottom: 10,
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
