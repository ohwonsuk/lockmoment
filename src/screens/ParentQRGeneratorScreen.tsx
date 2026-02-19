import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Share, TextInput, Modal, FlatList, Platform } from 'react-native';
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
import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { MetaDataService, AppCategory } from '../services/MetaDataService';
import { useAlert } from '../context/AlertContext';

const isIOS = Platform.OS === 'ios';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export const ParentQRGeneratorScreen: React.FC = () => {
    const { navigate, currentParams } = useAppNavigation();
    const { showAlert } = useAlert();
    const params = currentParams || {};

    // Base State
    const [qrType, setQrType] = useState<'INSTANT' | 'SCHEDULED'>('INSTANT');
    const [lockTitle, setLockTitle] = useState('자녀 잠금');
    const [duration, setDuration] = useState(60);
    const [selectedApps, setSelectedApps] = useState<string[]>([]);
    const [qrValue, setQrValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Child Selection
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('all');

    // Preset State
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

    // Meta Data State
    const [allCategories, setAllCategories] = useState<AppCategory[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);

    const [isStale, setIsStale] = useState(false);
    const [lastGeneratedConfig, setLastGeneratedConfig] = useState<string | null>(null);

    // Platform (Generic parent assumes platform independent or follows general standard)
    const [lockMethod, setLockMethod] = useState<'FULL' | 'CATEGORY' | 'APP'>('FULL');
    const [isAppPickerVisible, setIsAppPickerVisible] = useState(false);
    const [installedApps, setInstalledApps] = useState<{ label: string, packageName: string }[]>([]);

    const currentConfig = JSON.stringify({
        selectedChildId,
        selectedPresetId,
        selectedCategories,
        selectedApps,
        duration,
        lockTitle,
        qrType,
        lockMethod
    });

    // Schedule State
    const getRoundedDate = (date: Date) => {
        const rounded = new Date(date);
        rounded.setMinutes(Math.round(rounded.getMinutes() / 5) * 5);
        rounded.setSeconds(0);
        rounded.setMilliseconds(0);
        return rounded;
    };

    const [startTime, setStartTime] = useState(getRoundedDate(new Date()));
    const [endTime, setEndTime] = useState(getRoundedDate(new Date(Date.now() + 3600000)));
    const [selectedDays, setSelectedDays] = useState<string[]>(['월', '화', '수', '목', '금']);

    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
    const cardRef = useRef<any>(null);

    useEffect(() => {
        loadData();
    }, [qrType]);

    useEffect(() => {
        if (qrValue && lastGeneratedConfig && currentConfig !== lastGeneratedConfig) {
            setIsStale(true);
        } else {
            setIsStale(false);
        }
    }, [currentConfig, lastGeneratedConfig, qrValue]);

    const loadData = async () => {
        try {
            const [childrenData, systemPresets, personalPresets, categories] = await Promise.all([
                ParentChildService.getLinkedChildren(),
                PresetService.getPresets('SYSTEM'), // Parent can see system presets
                PresetService.getPersonalPresets(),  // And their own presets
                MetaDataService.getAppCategories()
            ]);

            setChildren(childrenData);
            if (childrenData.length > 0 && selectedChildId === 'all') {
                setSelectedChildId(childrenData[0].id);
            }

            const filteredPersonal = personalPresets.filter(p => {
                if (qrType === 'INSTANT') return !p.preset_type || p.preset_type === 'INSTANT';
                return p.preset_type === 'SCHEDULED';
            });

            setPresets([...filteredPersonal, ...systemPresets]);
            setAllCategories(categories);
        } catch (error) {
            console.error("[ParentQR] Load Data Failed:", error);
        }
    };

    const handlePresetSelect = (preset: Preset) => {
        if (selectedPresetId === preset.id) {
            setSelectedPresetId(null);
            setLockTitle(qrType === 'INSTANT' ? '자녀 잠금' : '자녀 예약 잠금');
            setSelectedCategories([]);
            setDuration(60);
            return;
        }

        setSelectedPresetId(preset.id);
        setLockTitle(preset.name);
        if (preset.default_duration_minutes) setDuration(preset.default_duration_minutes);
        if (preset.allowed_apps && preset.allowed_apps.length > 0) setSelectedApps(preset.allowed_apps);
        if (preset.blocked_categories && preset.blocked_categories.length > 0) setSelectedCategories(preset.blocked_categories);
    };

    const generateQR = async () => {
        setIsGenerating(true);
        let finalDuration = duration;
        let timeWindow: string | undefined = undefined;
        let days: string[] | undefined = undefined;

        try {
            if (qrType === 'SCHEDULED') {
                const sStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
                const eStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                timeWindow = `${sStr}-${eStr}`;
                days = selectedDays;
                const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
                finalDuration = diff > 0 ? diff : (24 * 60 + diff);
            }

            const result = await QrService.generateQr({
                qr_type: 'DYNAMIC', // Parent to Child is dynamic
                purpose: qrType === 'INSTANT' ? 'LOCK_ONLY' : 'LOCK_AND_ATTENDANCE',
                preset_id: selectedPresetId || undefined,
                duration_minutes: finalDuration,
                title: lockTitle,
                target_type: 'STUDENT',
                target_id: selectedChildId === 'all' ? undefined : selectedChildId,
                blocked_apps: lockMethod === 'APP' ? selectedApps : [],
                blocked_categories: lockMethod === 'CATEGORY' ? selectedCategories : [],
                time_window: timeWindow,
                days: days,
                one_time: qrType === 'INSTANT'
            });

            if (result && result.success) {
                setQrValue(result.payload || result.qr_id);
                setLastGeneratedConfig(currentConfig);
                setIsStale(false);
            } else {
                showAlert({ title: "생성 실패", message: result?.message || "QR 코드를 생성할 수 없습니다." });
            }
        } catch (error) {
            console.error("QR Generation Error:", error);
            showAlert({ title: "오류", message: "QR 코드 생성 중 오류가 발생했습니다." });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveSchedule = async () => {
        if (!lockTitle.trim() || selectedDays.length === 0) {
            showAlert({ title: "오류", message: "제목과 반복 요일을 입력해주세요." });
            return;
        }
        try {
            const sStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            const eStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;

            const res = await ParentChildService.createChildSchedule(selectedChildId, {
                name: lockTitle,
                startTime: sStr,
                endTime: eStr,
                days: selectedDays,
                lockType: lockMethod === 'FULL' ? 'FULL' : 'APP',
                blockedApps: lockMethod === 'APP' ? selectedApps : undefined,
                blockedCategories: lockMethod === 'CATEGORY' ? selectedCategories : undefined,
                isActive: true
            } as any);

            if (res.success) {
                showAlert({ title: "저장 완료", message: "자녀 예약 잠금이 서버에 저장되었습니다." });
            }
        } catch (e) {
            showAlert({ title: "저장 실패", message: "일시적인 오류가 발생했습니다." });
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            await CameraRoll.save(uri, { type: 'photo' });
            showAlert({ title: "저장 완료", message: "갤러리에 저장되었습니다." });
        } catch (e) {
            showAlert({ title: "저장 실패", message: "이미지를 저장하는 중 오류가 발생했습니다." });
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            await NSSHARE.open({ url: uri });
        } catch (e) { }
    };

    return (
        <View style={styles.container}>
            <Header title="자녀 관리용 QR 생성" />

            {/* Child Selection */}
            <View style={styles.childSection}>
                <Typography bold style={{ marginLeft: 20, marginBottom: 10 }}>대상 자녀 선택</Typography>
                <FlatList
                    horizontal
                    data={children}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.childItem, selectedChildId === item.id && styles.childItemActive]}
                            onPress={() => setSelectedChildId(item.id)}
                        >
                            <View style={[styles.childAvatar, { backgroundColor: '#2F7AFF' }]}>
                                <Typography color="#FFF" bold>{item.childName.substring(0, 1)}</Typography>
                            </View>
                            <Typography variant="caption" bold={selectedChildId === item.id}>{item.childName}</Typography>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingHorizontal: 20 }}
                    showsHorizontalScrollIndicator={false}
                />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, qrType === 'INSTANT' && styles.activeTab]} onPress={() => { setQrType('INSTANT'); setQrValue(""); }}>
                    <Typography bold={qrType === 'INSTANT'} color={qrType === 'INSTANT' ? Colors.primary : Colors.textSecondary}>즉시 잠금</Typography>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, qrType === 'SCHEDULED' && styles.activeTab]} onPress={() => { setQrType('SCHEDULED'); setQrValue(""); }}>
                    <Typography bold={qrType === 'SCHEDULED'} color={qrType === 'SCHEDULED' ? Colors.primary : Colors.textSecondary}>예약 잠금</Typography>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.presetSection}>
                    <Typography bold style={{ marginBottom: 10 }}>프리셋 선택</Typography>
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
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 제목</Typography>
                        <TextInput style={styles.textInput} value={lockTitle} onChangeText={setLockTitle} placeholder="잠금 제목 입력" placeholderTextColor={Colors.statusInactive} />
                    </View>

                    {qrType === 'INSTANT' ? (
                        <View style={styles.inputGroup}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 시간 (분)</Typography>
                            <TextInput style={styles.textInput} value={duration.toString()} onChangeText={(v) => setDuration(parseInt(v) || 0)} keyboardType="numeric" />
                        </View>
                    ) : (
                        <>
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>시간 설정</Typography>
                                <View style={styles.timeRow}>
                                    <View style={styles.pickerContainer}>
                                        <TouchableOpacity style={styles.timeInputsSmall} onPress={() => { setPickerTarget('start'); setIsTimePickerVisible(true); }}>
                                            <Typography bold>{startTime.getHours()}:{startTime.getMinutes().toString().padStart(2, '0')}</Typography>
                                        </TouchableOpacity>
                                        <Typography style={{ marginHorizontal: 8 }}>~</Typography>
                                        <TouchableOpacity style={styles.timeInputsSmall} onPress={() => { setPickerTarget('end'); setIsTimePickerVisible(true); }}>
                                            <Typography bold>{endTime.getHours()}:{endTime.getMinutes().toString().padStart(2, '0')}</Typography>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>반복 요일</Typography>
                                <View style={styles.daysRow}>
                                    {DAYS.map(d => (
                                        <TouchableOpacity key={d} style={[styles.dayCircle, selectedDays.includes(d) && styles.dayCircleActive]} onPress={() => setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}>
                                            <Typography color={selectedDays.includes(d) ? Colors.primary : Colors.textSecondary}>{d}</Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </>
                    )}

                    {/* Lock Method (Follows shared policy) */}
                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 12 }}>잠금 방식</Typography>
                        <View style={styles.methodContainer}>
                            {(['FULL', 'CATEGORY', 'APP'] as const).map(m => (
                                <TouchableOpacity key={m} style={[styles.methodItem, lockMethod === m && styles.methodItemActive]} onPress={() => setLockMethod(m)}>
                                    <Icon name={m === 'FULL' ? 'phone-portrait-outline' : (m === 'CATEGORY' ? 'grid-outline' : 'apps-outline')} size={24} color={lockMethod === m ? Colors.primary : Colors.textSecondary} />
                                    <Typography variant="caption" bold color={lockMethod === m ? Colors.primary : Colors.textSecondary}>{m === 'FULL' ? '전체' : (m === 'CATEGORY' ? '카테고리' : '개별앱')}</Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                <View style={styles.qrContainer}>
                    {qrValue ? (
                        <>
                            {isStale && (
                                <View style={styles.staleNotice}>
                                    <Icon name="alert-circle" size={16} color={Colors.primary} />
                                    <Typography variant="caption" color={Colors.primary} bold>설정이 변경되었습니다.</Typography>
                                </View>
                            )}
                            <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                                <QRCard title={lockTitle} subtitle={qrType === 'INSTANT' ? `${duration}분` : `${selectedDays.join('')}`} value={qrValue} />
                            </ViewShot>
                        </>
                    ) : (
                        <View style={styles.emptyQrBox}>
                            <Icon name="qr-code-outline" size={60} color={Colors.border} />
                            <Typography color={Colors.textSecondary} style={{ marginTop: 10 }}>자녀에게 전달할 QR 보드를 만드세요</Typography>
                        </View>
                    )}
                </View>

                <View style={styles.actionContainer}>
                    <TouchableOpacity style={styles.generateButton} onPress={generateQR} disabled={isGenerating}>
                        <Icon name="qr-code-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">{isGenerating ? "생성 중..." : "QR 코드 생성"}</Typography>
                    </TouchableOpacity>

                    {qrType === 'SCHEDULED' && (
                        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSchedule}>
                            <Icon name="cloud-upload-outline" size={20} color={Colors.primary} />
                            <Typography bold color={Colors.primary}>서버에 예약 저장</Typography>
                        </TouchableOpacity>
                    )}

                    {qrValue && (
                        <View style={styles.secondaryActions}>
                            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                                <Icon name="download-outline" size={20} color={Colors.text} />
                                <Typography bold>저장</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                                <Icon name="share-outline" size={20} color={Colors.primary} />
                                <Typography bold color={Colors.primary}>공유</Typography>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    childSection: { paddingVertical: 15, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
    childItem: { alignItems: 'center', marginRight: 15, width: 60 },
    childItemActive: { opacity: 1 },
    childAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4, borderWidth: 2, borderColor: 'transparent' },
    tabContainer: { flexDirection: 'row', padding: 20, gap: 10 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
    activeTab: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    scrollContent: { padding: 20 },
    presetSection: { marginBottom: 20 },
    configContainer: { backgroundColor: Colors.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
    inputGroup: { marginBottom: 20 },
    textInput: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
    timeRow: { marginTop: 4 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 12, borderRadius: 12 },
    timeInputsSmall: { flex: 1, alignItems: 'center' },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    dayCircleActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
    methodContainer: { flexDirection: 'row', gap: 10 },
    methodItem: { flex: 1, backgroundColor: Colors.background, padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    methodItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    qrContainer: { alignItems: 'center', marginTop: 20 },
    emptyQrBox: { width: '100%', aspectRatio: 1.2, backgroundColor: Colors.card, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
    staleNotice: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary + '15', padding: 8, borderRadius: 20, marginBottom: 10 },
    actionContainer: { marginTop: 20, gap: 12 },
    generateButton: { flexDirection: 'row', backgroundColor: Colors.primary, padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    saveButton: { flexDirection: 'row', backgroundColor: Colors.primary + '10', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.primary },
    secondaryActions: { flexDirection: 'row', gap: 12 },
    downloadButton: { flex: 1, flexDirection: 'row', backgroundColor: Colors.card, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
    shareButton: { flex: 1, flexDirection: 'row', backgroundColor: Colors.card, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
});
