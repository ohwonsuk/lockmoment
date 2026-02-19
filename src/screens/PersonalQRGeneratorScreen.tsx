import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, Platform } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { QrService } from '../services/QrService';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { QRCard } from '../components/QRCard';
import { NativeLockControl } from '../services/NativeLockControl';
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import NSSHARE from 'react-native-share';
import { PresetService, Preset } from '../services/PresetService';
import { PresetItem } from '../components/PresetItem';
import { useAppNavigation } from '../navigation/NavigationContext';
import { MetaDataService, AppCategory } from '../services/MetaDataService';
import { StorageService, Schedule } from '../services/StorageService';
import { ParentChildService } from '../services/ParentChildService';
import { useAlert } from '../context/AlertContext';
import { LockService } from '../services/LockService';

const isIOS = Platform.OS === 'ios';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export const PersonalQRGeneratorScreen: React.FC = () => {
    const { navigate, currentParams } = useAppNavigation();
    const { showAlert } = useAlert();
    const params = currentParams || {};

    // Base State
    const [qrType, setQrType] = useState<'INSTANT' | 'SCHEDULED'>(params.type || 'INSTANT');
    const isDirectNavigation = !!params.type;
    const [lockTitle, setLockTitle] = useState(params.title || '나의 잠금');
    const [duration, setDuration] = useState(params.duration || 60);

    // BUG FIX: Initialize with empty array if no params provided, instead of default 4 apps
    const [selectedApps, setSelectedApps] = useState<string[]>(params.apps || []);
    const [qrValue, setQrValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Preset State
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

    // Meta Data State
    const [allCategories, setAllCategories] = useState<AppCategory[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);

    const [lastGeneratedConfig, setLastGeneratedConfig] = useState<any>(null);
    const [isStale, setIsStale] = useState(false);

    // Platform Specific Local Settings
    const [lockMethod, setLockMethod] = useState<'FULL' | 'CATEGORY' | 'APP'>(isIOS ? 'CATEGORY' : 'FULL');
    const [installedApps, setInstalledApps] = useState<{ label: string, packageName: string, icon?: string }[]>([]);
    const [isAppPickerVisible, setIsAppPickerVisible] = useState(false);
    const [iosCounts, setIosCounts] = useState({ apps: 0, categories: 0 });

    const configKey = `@lockmoment_last_qr_config_personal_${qrType}`;

    const currentConfig = JSON.stringify({
        selectedPresetId,
        selectedCategories,
        selectedApps,
        duration,
        lockTitle,
        qrType,
        lockMethod,
        selectedDays: [] // Basic personal lock doesn't strictly need days unless scheduled
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

    // UI Helpers
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
    const cardRef = useRef<any>(null);

    useEffect(() => {
        loadData();
        if (!isIOS) {
            loadInstalledApps();
        }
        if (isIOS) {
            updateIosCounts();
        }
        loadLocalSettings();
    }, []);

    const loadLocalSettings = async () => {
        try {
            const saved = await StorageService.getItem(configKey);
            if (saved) {
                const config = JSON.parse(saved);
                if (config.lockMethod) setLockMethod(config.lockMethod);
                if (config.selectedCategories) setSelectedCategories(config.selectedCategories);
                if (config.selectedApps) setSelectedApps(config.selectedApps);
                if (config.duration) setDuration(config.duration);
                if (config.lockTitle) setLockTitle(config.lockTitle);
            }
        } catch (e) { }
    };

    const saveLocalSettings = async () => {
        try {
            const config = {
                lockMethod,
                selectedCategories,
                selectedApps,
                duration,
                lockTitle
            };
            await StorageService.setItem(configKey, JSON.stringify(config));
        } catch (e) { }
    };

    const loadInstalledApps = async () => {
        try {
            const apps = await NativeLockControl.getInstalledApps();
            if (apps) {
                setInstalledApps(apps.sort((a, b) => a.label.localeCompare(b.label)));
            }
        } catch (e) { console.error("Load Apps Error:", e); }
    };

    const updateIosCounts = async () => {
        if (!isIOS) return;
        try {
            const [a, c] = await Promise.all([
                NativeLockControl.getSelectedAppCount(),
                NativeLockControl.getSelectedCategoryCount()
            ]);
            setIosCounts({ apps: a, categories: c });
        } catch (e) { }
    };

    useEffect(() => {
        if (qrValue && lastGeneratedConfig && currentConfig !== lastGeneratedConfig) {
            setIsStale(true);
        } else {
            setIsStale(false);
        }
    }, [currentConfig, lastGeneratedConfig, qrValue]);

    const loadData = async () => {
        try {
            const [personalPresets, categories] = await Promise.all([
                PresetService.getPersonalPresets(),
                MetaDataService.getAppCategories()
            ]);

            const filteredPresets = personalPresets.filter(p => {
                if (qrType === 'INSTANT') return !p.preset_type || p.preset_type === 'INSTANT';
                return p.preset_type === 'SCHEDULED';
            });

            setPresets(filteredPresets);
            setAllCategories(categories);
        } catch (error) {
            console.error("[PersonalQR] Load Data Failed:", error);
        }
    };

    const handlePresetSelect = (preset: Preset) => {
        if (selectedPresetId === preset.id) {
            setSelectedPresetId(null);
            setLockTitle(qrType === 'INSTANT' ? '나의 잠금' : '나의 예약 잠금');
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

    const toggleCategory = (id: string) => {
        setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const handleSaveSchedule = async () => {
        if (qrType !== 'SCHEDULED') return;

        try {
            const sStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            const eStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;

            const presetData: Partial<Preset> = {
                name: lockTitle,
                start_time: sStr,
                end_time: eStr,
                days: selectedDays,
                lock_type: lockMethod === 'FULL' ? 'FULL' : 'APP_ONLY',
                preset_type: 'SCHEDULED',
                purpose: 'LOCK_ONLY',
                scope: 'USER',
                allowed_apps: lockMethod === 'APP' ? selectedApps : [],
                blocked_categories: lockMethod === 'CATEGORY' ? selectedCategories : [],
                isActive: true
            };

            const saved = await PresetService.savePersonalPreset(presetData);

            if (saved) {
                // Sync schedules to native alarms immediately
                await LockService.syncSchedules();

                showAlert({
                    title: "저장 완료",
                    message: "예약 잠금이 저장되었습니다.",
                    onConfirm: () => navigate('Dashboard')
                });
            }
        } catch (error) {
            console.error("Save Schedule Error:", error);
            showAlert({ title: "오류", message: "저장 중 오류가 발생했습니다." });
        }
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
                qr_type: 'STATIC', // Personal is usually static
                purpose: qrType === 'INSTANT' ? 'LOCK_ONLY' : 'LOCK_AND_ATTENDANCE',
                preset_id: selectedPresetId || undefined,
                duration_minutes: finalDuration,
                title: lockTitle,
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
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStartLock = async () => {
        try {
            const prevent = await StorageService.getPreventAppRemoval();
            const success = await NativeLockControl.startLock(
                duration * 60000,
                lockMethod === 'FULL' ? 'FULL' : 'APP',
                lockTitle,
                lockMethod === 'APP' ? JSON.stringify(selectedApps) :
                    (lockMethod === 'CATEGORY' ? JSON.stringify(selectedCategories) : undefined),
                prevent
            );
            if (success) {
                await saveLocalSettings();
                navigate('Dashboard');
            } else {
                showAlert({ title: "잠금 실패", message: "잠금을 시작할 수 없습니다." });
            }
        } catch (error) {
            console.error("Start Lock Error:", error);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            await CameraRoll.save(uri, { type: 'photo' });
            showAlert({ title: "저장 완료", message: "갤러리에 저장되었습니다." });
        } catch (e) { }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            await NSSHARE.open({ url: uri });
        } catch (e) { }
    };

    const handleHourChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartTime : setEndTime;
        const current = isStart ? startTime : endTime;
        const isPM = current.getHours() >= 12;
        let h = parseInt(val);
        if (isNaN(h)) h = 12;
        if (h === 12) h = 0;
        const newDate = new Date(current);
        newDate.setHours(isPM ? h + 12 : h);
        setTime(newDate);
    };

    const handleMinuteChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartTime : setEndTime;
        const current = isStart ? startTime : endTime;
        let m = parseInt(val);
        if (isNaN(m)) m = 0;
        const newDate = new Date(current);
        newDate.setMinutes(m);
        setTime(newDate);
    };

    const handleAmPmChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartTime : setEndTime;
        const current = isStart ? startTime : endTime;
        const isPM = val === '오후';
        if (isPM !== (current.getHours() >= 12)) {
            const newDate = new Date(current);
            const h = newDate.getHours();
            newDate.setHours(isPM ? h + 12 : h - 12);
            setTime(newDate);
        }
    };

    const adjustTimeValue = (type: 'hour' | 'min', delta: number) => {
        const isStart = pickerTarget === 'start';
        const setTime = isStart ? setStartTime : setEndTime;
        const current = isStart ? startTime : endTime;
        const newDate = new Date(current);

        if (type === 'hour') {
            newDate.setHours(newDate.getHours() + delta);
        } else {
            // Round to nearest 5 when stepping if not already
            const currentMin = newDate.getMinutes();
            if (currentMin % 5 !== 0) {
                const rounded = delta > 0 ? Math.ceil(currentMin / 5) * 5 : Math.floor(currentMin / 5) * 5;
                newDate.setMinutes(rounded);
            } else {
                newDate.setMinutes(currentMin + delta);
            }
        }
        setTime(newDate);
    };

    const qrSubtitle = qrType === 'INSTANT'
        ? `${duration}분 집중 모드`
        : `${selectedDays.join(', ')} / ${startTime.getHours()}:${startTime.getMinutes().toString().padStart(2, '0')}`;

    return (
        <View style={styles.container}>
            <Header title={qrType === 'INSTANT' ? "바로잠금" : "예약잠금"} showBack={isDirectNavigation} />

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, qrType === 'INSTANT' && styles.activeTab]} onPress={() => { setQrType('INSTANT'); setQrValue(""); }}>
                    <Typography bold={qrType === 'INSTANT'} color={qrType === 'INSTANT' ? Colors.primary : Colors.textSecondary}>바로 잠금</Typography>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, qrType === 'SCHEDULED' && styles.activeTab]} onPress={() => { setQrType('SCHEDULED'); setQrValue(""); }}>
                    <Typography bold={qrType === 'SCHEDULED'} color={qrType === 'SCHEDULED' ? Colors.primary : Colors.textSecondary}>예약 잠금</Typography>
                </TouchableOpacity>
            </View>

            <View style={styles.presetSection}>
                <View style={styles.sectionHeader}>
                    <Typography bold>사전 등록 선택</Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>원하는 상황을 선택하세요</Typography>
                    <TouchableOpacity
                        style={styles.addPresetLink}
                        onPress={() => navigate('PersonalPreset')}
                    >
                        <Icon name="add-circle-outline" size={20} color={Colors.primary} />
                        <Typography color={Colors.primary} bold>사전등록하기</Typography>
                    </TouchableOpacity>
                </View>
                <FlatList
                    horizontal
                    data={presets}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <PresetItem preset={item} isSelected={selectedPresetId === item.id} onPress={handlePresetSelect} />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetList}
                />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.configContainer}>
                    {/* Configuration inputs remain same but grouped cleaner */}
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
                                            <Typography bold>{startTime.getHours() < 12 ? '오전' : '오후'} {startTime.getHours() % 12 || 12}:{startTime.getMinutes().toString().padStart(2, '0')}</Typography>
                                        </TouchableOpacity>
                                        <Typography style={{ marginHorizontal: 8 }}>~</Typography>
                                        <TouchableOpacity style={styles.timeInputsSmall} onPress={() => { setPickerTarget('end'); setIsTimePickerVisible(true); }}>
                                            <Typography bold>{endTime.getHours() < 12 ? '오전' : '오후'} {endTime.getHours() % 12 || 12}:{endTime.getMinutes().toString().padStart(2, '0')}</Typography>
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

                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 12 }}>잠금 방식 설정</Typography>
                        {!isIOS ? (
                            <View style={styles.methodContainer}>
                                {(['FULL', 'CATEGORY', 'APP'] as const).map(m => (
                                    <TouchableOpacity key={m} style={[styles.methodItem, lockMethod === m && styles.methodItemActive]} onPress={() => setLockMethod(m)}>
                                        <Icon name={m === 'FULL' ? 'phone-portrait-outline' : (m === 'CATEGORY' ? 'grid-outline' : 'apps-outline')} size={24} color={lockMethod === m ? Colors.primary : Colors.textSecondary} />
                                        <Typography variant="caption" bold color={lockMethod === m ? Colors.primary : Colors.textSecondary}>{m === 'FULL' ? '전체' : (m === 'CATEGORY' ? '카테고리' : '개별앱')}</Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.iosSummaryCard}>
                                <View style={styles.iosSummaryInfo}>
                                    <Icon name="logo-apple" size={20} color={Colors.text} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Typography bold>스크린타임 설정 연동</Typography>
                                        <Typography variant="caption" color={Colors.textSecondary}>{iosCounts.categories}개 카테고리, {iosCounts.apps}개 앱 선택됨</Typography>
                                    </View>
                                    <TouchableOpacity style={styles.iosModifyBtn} onPress={() => navigate('AppLockSettings')}>
                                        <Typography variant="caption" bold color={Colors.primary}>수정</Typography>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>

                    {!isIOS && lockMethod === 'CATEGORY' && (
                        <TouchableOpacity style={styles.appPickerButton} onPress={() => setIsCategoryPickerVisible(true)}>
                            <Icon name="grid-outline" size={20} color={Colors.primary} />
                            <Typography color={Colors.primary} bold>{selectedCategories.length > 0 ? `${selectedCategories.length}개 선택됨` : "카테고리 선택"}</Typography>
                        </TouchableOpacity>
                    )}
                    {!isIOS && lockMethod === 'APP' && (
                        <TouchableOpacity style={styles.appPickerButton} onPress={() => setIsAppPickerVisible(true)}>
                            <Icon name="apps-outline" size={20} color={Colors.primary} />
                            <Typography color={Colors.primary} bold>{selectedApps.length > 0 ? `${selectedApps.length}개 선택됨` : "앱 선택"}</Typography>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ACTION BUTTON (Above QR) */}
                <View style={{ marginTop: 24, marginBottom: 16 }}>
                    {qrType === 'INSTANT' ? (
                        <TouchableOpacity style={styles.mainActionBtn} onPress={handleStartLock}>
                            <Icon name="play-circle" size={24} color="#FFF" />
                            <Typography bold color="#FFF">지금 바로 잠금 시작</Typography>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.mainActionBtn} onPress={handleSaveSchedule}>
                            <Icon name="bookmark" size={24} color="#FFF" />
                            <Typography bold color="#FFF">내 예약에 저장하기</Typography>
                        </TouchableOpacity>
                    )}
                </View>

                {/* QR CONTAINER */}
                <View style={styles.qrContainer}>
                    {qrValue ? (
                        <>
                            {isStale && (
                                <View style={styles.staleNotice}>
                                    <Icon name="alert-circle" size={16} color={Colors.primary} />
                                    <Typography variant="caption" color={Colors.primary} bold>설정이 변경되었습니다. QR을 다시 생성해주세요.</Typography>
                                </View>
                            )}
                            <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                                <QRCard title={lockTitle} subtitle={qrSubtitle} value={qrValue} />
                            </ViewShot>
                        </>
                    ) : (
                        <View style={styles.emptyQrBox}>
                            <Icon name="qr-code-outline" size={60} color={Colors.border} />
                            <Typography color={Colors.textSecondary} style={{ marginTop: 12, textAlign: 'center', paddingHorizontal: 20 }}>
                                설정 완료 후 아래 버튼을 눌러 QR을 생성하세요
                            </Typography>
                        </View>
                    )}
                </View>

                {/* GENERATE BUTTON (Below QR) */}
                <View style={{ marginTop: 24 }}>
                    <TouchableOpacity style={styles.generateButton} onPress={generateQR} disabled={isGenerating}>
                        <Icon name="qr-code-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">
                            {isGenerating ? "생성 중..." : (qrValue && isStale ? "QR 갱신하기" : "QR 코드 생성하기")}
                        </Typography>
                    </TouchableOpacity>
                </View>

                {/* SECONDARY ACTIONS (Bottom) */}
                <View style={styles.secondaryActions}>
                    <TouchableOpacity
                        style={[styles.downloadButton, !qrValue && styles.disabledBtn]}
                        onPress={handleDownload}
                        disabled={!qrValue}
                    >
                        <Icon name="download-outline" size={20} color={qrValue ? Colors.text : Colors.border} />
                        <Typography bold color={qrValue ? Colors.text : Colors.border}>이미지 저장</Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.shareButton, !qrValue && styles.disabledBtn]}
                        onPress={handleShare}
                        disabled={!qrValue}
                    >
                        <Icon name="share-outline" size={20} color={qrValue ? Colors.primary : Colors.border} />
                        <Typography bold color={qrValue ? Colors.primary : Colors.border}>공유하기</Typography>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Modals - Category/App/Time Pickers (Keep same as original) */}
            <Modal visible={isCategoryPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <Header title="카테고리 선택" showBack onBack={() => setIsCategoryPickerVisible(false)} />
                    <FlatList
                        data={allCategories}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.categoryItem} onPress={() => toggleCategory(item.id)}>
                                <View style={[styles.checkbox, selectedCategories.includes(item.id) && styles.checkboxActive]}>
                                    {selectedCategories.includes(item.id) && <Icon name="checkmark" size={16} color="#FFF" />}
                                </View>
                                <Typography>{item.display_name}</Typography>
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={() => setIsCategoryPickerVisible(false)}>
                        <Typography bold color="#FFF">선택 완료</Typography>
                    </TouchableOpacity>
                </View>
            </Modal>

            <Modal visible={isAppPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <Header title="앱 선택" showBack onBack={() => setIsAppPickerVisible(false)} />
                    <FlatList
                        data={installedApps}
                        keyExtractor={item => item.packageName}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.categoryItem} onPress={() => {
                                setSelectedApps(prev => prev.includes(item.packageName) ? prev.filter(p => p !== item.packageName) : [...prev, item.packageName]);
                            }}>
                                <View style={[styles.checkbox, selectedApps.includes(item.packageName) && styles.checkboxActive]}>
                                    {selectedApps.includes(item.packageName) && <Icon name="checkmark" size={16} color="#FFF" />}
                                </View>
                                <Typography>{item.label}</Typography>
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={() => setIsAppPickerVisible(false)}>
                        <Typography bold color="#FFF">선택 완료 ({selectedApps.length})</Typography>
                    </TouchableOpacity>
                </View>
            </Modal>

            <Modal visible={isTimePickerVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Typography bold>{pickerTarget === 'start' ? '시작' : '종료'} 시간 설정</Typography>
                            <TouchableOpacity onPress={() => setIsTimePickerVisible(false)}><Icon name="close" size={24} color={Colors.text} /></TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 15, alignItems: 'center' }}>
                            <TouchableOpacity style={styles.timeValueBtn} onPress={() => handleAmPmChange((pickerTarget === 'start' ? startTime : endTime).getHours() < 12 ? '오후' : '오전', pickerTarget === 'start')}>
                                <Typography bold>{(pickerTarget === 'start' ? startTime : endTime).getHours() < 12 ? '오전' : '오후'}</Typography>
                            </TouchableOpacity>

                            <View style={styles.stepperColumn}>
                                <TouchableOpacity onPress={() => adjustTimeValue('hour', 1)} style={styles.stepBtn}>
                                    <Icon name="chevron-up" size={24} color={Colors.textSecondary} />
                                </TouchableOpacity>
                                <TextInput
                                    style={[styles.textInput, styles.timeInputModal]}
                                    keyboardType="numeric"
                                    value={((pickerTarget === 'start' ? startTime : endTime).getHours() % 12 || 12).toString()}
                                    onChangeText={(v) => handleHourChange(v, pickerTarget === 'start')}
                                    maxLength={2}
                                />
                                <TouchableOpacity onPress={() => adjustTimeValue('hour', -1)} style={styles.stepBtn}>
                                    <Icon name="chevron-down" size={24} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <Typography style={{ fontSize: 24, alignSelf: 'center', marginTop: 0 }}>:</Typography>

                            <View style={styles.stepperColumn}>
                                <TouchableOpacity onPress={() => adjustTimeValue('min', 5)} style={styles.stepBtn}>
                                    <Icon name="chevron-up" size={24} color={Colors.textSecondary} />
                                </TouchableOpacity>
                                <TextInput
                                    style={[styles.textInput, styles.timeInputModal]}
                                    keyboardType="numeric"
                                    value={(pickerTarget === 'start' ? startTime : endTime).getMinutes().toString().padStart(2, '0')}
                                    onChangeText={(v) => handleMinuteChange(v, pickerTarget === 'start')}
                                    maxLength={2}
                                />
                                <TouchableOpacity onPress={() => adjustTimeValue('min', -5)} style={styles.stepBtn}>
                                    <Icon name="chevron-down" size={24} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.modalConfirmButton, { marginTop: 30, marginHorizontal: 0 }]} onPress={() => setIsTimePickerVisible(false)}>
                            <Typography bold color="#FFF">완료</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    tabContainer: { flexDirection: 'row', backgroundColor: Colors.card, marginHorizontal: 20, marginTop: 10, borderRadius: 12, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: Colors.background, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    presetSection: { paddingVertical: 10 },
    sectionHeader: { paddingHorizontal: 20, marginBottom: 8 },
    presetList: { paddingLeft: 20 },
    scrollContent: { padding: 20 },
    configContainer: { backgroundColor: Colors.card, padding: 20, borderRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1, borderColor: Colors.border },
    inputGroup: { marginBottom: 20 },
    textInput: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
    timeRow: { marginTop: 4 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 12, borderRadius: 12 },
    timeInputsSmall: { flex: 1, alignItems: 'center' },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    dayCircleActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
    methodContainer: { flexDirection: 'row', gap: 10 },
    methodItem: { flex: 1, backgroundColor: Colors.background, padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    methodItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    iosSummaryCard: { backgroundColor: Colors.background, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
    iosSummaryInfo: { flexDirection: 'row', alignItems: 'center' },
    iosModifyBtn: { backgroundColor: Colors.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    appPickerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: Colors.primary + '10', padding: 12, borderRadius: 12 },
    startLockBtn: { marginHorizontal: 0, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginBottom: 10 },
    mainActionBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, gap: 10 },
    qrContainer: { alignItems: 'center', marginVertical: 10 },
    emptyQrBox: { width: '100%', aspectRatio: 1.2, backgroundColor: Colors.card, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
    staleNotice: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary + '15', padding: 8, borderRadius: 20, marginBottom: 10 },
    generateButton: { flexDirection: 'row', backgroundColor: Colors.primary, padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    addPresetLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    secondaryActions: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 40 },
    downloadButton: { flex: 1, flexDirection: 'row', backgroundColor: Colors.card, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
    shareButton: { flex: 1, flexDirection: 'row', backgroundColor: Colors.card, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
    disabledBtn: { opacity: 0.5, borderColor: Colors.border },
    modalContainer: { flex: 1, backgroundColor: Colors.background },
    categoryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    modalConfirmButton: { margin: 20, backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: Colors.card, borderRadius: 20, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    timeValueBtn: { backgroundColor: Colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, height: 50, justifyContent: 'center' },
    stepperColumn: { alignItems: 'center', gap: 4 },
    stepBtn: { padding: 4 },
    timeInputModal: { width: 70, textAlign: 'center', fontSize: 22, height: 60, fontWeight: 'bold' },
});

