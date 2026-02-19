import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, Platform } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { QrService } from '../services/QrService';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { QRCard } from '../components/QRCard';
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import NSSHARE from 'react-native-share';
import { PresetService, Preset } from '../services/PresetService';
import { PresetItem } from '../components/PresetItem';
import { useAppNavigation } from '../navigation/NavigationContext';
import { MetaDataService, AppCategory } from '../services/MetaDataService';
import { useAlert } from '../context/AlertContext';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export const TeacherQRGeneratorScreen: React.FC = () => {
    const { navigate, currentParams } = useAppNavigation();
    const { showAlert } = useAlert();

    // Teacher usually generates FOR students (Dynamic QR)
    const [qrValue, setQrValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [lockTitle, setLockTitle] = useState('학원 수업 잠금');
    const [duration, setDuration] = useState(90); // Default for school/academy

    // Preset State - Specialized for Teachers
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

    // Meta Data
    const [allCategories, setAllCategories] = useState<AppCategory[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Platform standard lock methods
    const [lockMethod, setLockMethod] = useState<'FULL' | 'CATEGORY' | 'APP'>('FULL');
    const [selectedApps, setSelectedApps] = useState<string[]>([]);

    const cardRef = useRef<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [systemPresets, categories] = await Promise.all([
                PresetService.getPresets('SYSTEM'),
                MetaDataService.getAppCategories()
            ]);

            // Filter system presets that are likely for schools (e.g., includes "수업", "자기주도")
            const teacherPresets = systemPresets.filter(p =>
                p.name.includes('수업') || p.name.includes('집중') || p.name.includes('학교')
            );

            setPresets(teacherPresets.length > 0 ? teacherPresets : systemPresets);
            setAllCategories(categories);
        } catch (error) {
            console.error("[TeacherQR] Load Data Failed:", error);
        }
    };

    const handlePresetSelect = (preset: Preset) => {
        setSelectedPresetId(preset.id);
        setLockTitle(preset.name);
        if (preset.default_duration_minutes) setDuration(preset.default_duration_minutes);
        if (preset.blocked_categories) setSelectedCategories(preset.blocked_categories);
    };

    const generateQR = async () => {
        setIsGenerating(true);
        try {
            const result = await QrService.generateQr({
                qr_type: 'DYNAMIC',
                purpose: 'LOCK_ONLY',
                preset_id: selectedPresetId || undefined,
                duration_minutes: duration,
                title: lockTitle,
                blocked_apps: lockMethod === 'APP' ? selectedApps : [],
                blocked_categories: lockMethod === 'CATEGORY' ? selectedCategories : [],
                one_time: true
            });

            if (result && result.success) {
                setQrValue(result.payload || result.qr_id);
            } else {
                showAlert({ title: "생성 실패", message: "QR 코드를 생성할 수 없습니다." });
            }
        } catch (error) {
            console.error("Teacher QR Error:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            await CameraRoll.save(uri, { type: 'photo' });
            showAlert({ title: "저장 완료", message: "학생들에게 배포할 이미지가 저장되었습니다." });
        } catch (e) {
            showAlert({ title: "저장 실패", message: "이미지를 저장하는 중 오류가 발생했습니다." });
        }
    };

    return (
        <View style={styles.container}>
            <Header title="선생님용 수업 자동 잠금" />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.infoBox}>
                    <Icon name="school-outline" size={24} color={Colors.primary} />
                    <Typography style={{ marginLeft: 10, flex: 1 }}>수업 시간에 맞춰 학생들 기기를 제어할 수 있는 QR 코드를 생성합니다.</Typography>
                </View>

                <View style={styles.presetSection}>
                    <Typography bold style={{ marginBottom: 10 }}>수업 상황 선택</Typography>
                    <FlatList
                        horizontal
                        data={presets}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <PresetItem preset={item} isSelected={selectedPresetId === item.id} onPress={handlePresetSelect} />}
                        showsHorizontalScrollIndicator={false}
                    />
                </View>

                <View style={styles.configContainer}>
                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>수업/활동 명</Typography>
                        <TextInput style={styles.textInput} value={lockTitle} onChangeText={setLockTitle} placeholder="예: 영어 1교시" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 지속 시간 (분)</Typography>
                        <TextInput style={styles.textInput} value={duration.toString()} onChangeText={(v) => setDuration(parseInt(v) || 0)} keyboardType="numeric" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 12 }}>잠금 강도/방식</Typography>
                        <View style={styles.methodContainer}>
                            {(['FULL', 'CATEGORY'] as const).map(m => (
                                <TouchableOpacity key={m} style={[styles.methodItem, lockMethod === m && styles.methodItemActive]} onPress={() => setLockMethod(m)}>
                                    <Icon name={m === 'FULL' ? 'shield-checkmark-outline' : 'grid-outline'} size={24} color={lockMethod === m ? Colors.primary : Colors.textSecondary} />
                                    <Typography variant="caption" bold color={lockMethod === m ? Colors.primary : Colors.textSecondary}>{m === 'FULL' ? '수업 집중(전체잠금)' : '일부 제한(카테고리)'}</Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                <View style={styles.qrContainer}>
                    {qrValue ? (
                        <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                            <QRCard title={lockTitle} subtitle={`제한 시간: ${duration}분`} value={qrValue} />
                        </ViewShot>
                    ) : (
                        <View style={styles.emptyQrBox}>
                            <Icon name="qr-code-outline" size={80} color={Colors.border} />
                            <Typography color={Colors.textSecondary} style={{ marginTop: 15 }}>학생들이 스캔할 수업용 QR을 만드세요</Typography>
                        </View>
                    )}
                </View>

                <View style={styles.actionContainer}>
                    <TouchableOpacity style={styles.generateButton} onPress={generateQR} disabled={isGenerating}>
                        <Icon name="qr-code-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">{isGenerating ? "생성 중..." : "수업용 QR 생성"}</Typography>
                    </TouchableOpacity>

                    {qrValue && (
                        <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                            <Icon name="download-outline" size={20} color={Colors.text} />
                            <Typography bold>칠판/배포용 이미지 저장</Typography>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { padding: 20 },
    infoBox: { flexDirection: 'row', backgroundColor: Colors.card, padding: 15, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
    presetSection: { marginBottom: 20 },
    configContainer: { backgroundColor: Colors.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
    inputGroup: { marginBottom: 20 },
    textInput: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
    methodContainer: { flexDirection: 'row', gap: 10 },
    methodItem: { flex: 1, backgroundColor: Colors.background, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    methodItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    qrContainer: { alignItems: 'center', marginTop: 25 },
    emptyQrBox: { width: '100%', aspectRatio: 1.1, backgroundColor: Colors.card, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
    actionContainer: { marginTop: 20, gap: 12 },
    generateButton: { flexDirection: 'row', backgroundColor: Colors.primary, padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    downloadButton: { flexDirection: 'row', backgroundColor: Colors.card, padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.border },
});
