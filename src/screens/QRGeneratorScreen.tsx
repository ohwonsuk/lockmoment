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
import { PresetService, Preset } from '../services/PresetService';
import { PresetItem } from '../components/PresetItem';

import { useAppNavigation } from '../navigation/NavigationContext';

import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { MetaDataService, AppCategory } from '../services/MetaDataService';

const isIOS = Platform.OS === 'ios';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export const QRGeneratorScreen: React.FC = () => {
    const { navigate, currentParams } = useAppNavigation();
    const params = currentParams || {};

    // Base State
    const [qrType, setQrType] = useState<'INSTANT' | 'SCHEDULED'>('INSTANT');
    const [lockTitle, setLockTitle] = useState(params.title || '바로 잠금');
    const [duration, setDuration] = useState(params.duration || 60);
    const [selectedApps, setSelectedApps] = useState<string[]>(params.apps || UniversalAppMapper.getDefaultUniversalIds());
    const [qrValue, setQrValue] = useState('');

    // Preset State
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [isLoadingPresets, setIsLoadingPresets] = useState(false);

    // Child Selection
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('all'); // 'all' or specific id

    // Schedule State (for SCHEDULED tab)
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

    // Meta Data State
    const [allCategories, setAllCategories] = useState<AppCategory[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);

    const [lastGeneratedConfig, setLastGeneratedConfig] = useState<string>("");
    const [isStale, setIsStale] = useState(false);

    // 현재 설정 상태 요약 (변경 감지용 - 고정 포맷 사용)
    const currentConfig = JSON.stringify({
        selectedPresetId,
        selectedCategories,
        duration,
        lockTitle,
        qrType,
        startTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
        endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
        selectedDays
    });

    // UI Helpers
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
    const cardRef = useRef<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    // 설정 변경 시 갱신 필요(Stale) 상태 판별 및 자동 갱신 로직
    useEffect(() => {
        // 즉시 잠금: 설정이 변경되었고 마지막 생성 시점과 다를 때만 자동 갱신
        if (qrType === 'INSTANT') {
            if (currentConfig !== lastGeneratedConfig) {
                const timer = setTimeout(() => {
                    generateQR(false);
                }, 800);
                return () => clearTimeout(timer);
            }
            setIsStale(false);
        } else {
            // 예약 잠금: QR이 이미 생성된 상태(qrValue 존재)에서 설정이 달라진 경우만 안내 표시
            if (qrValue && lastGeneratedConfig && currentConfig !== lastGeneratedConfig) {
                setIsStale(true);
            } else {
                setIsStale(false);
            }
        }
    }, [currentConfig, lastGeneratedConfig, qrValue, qrType]);

    const loadData = async () => {
        setIsLoadingPresets(true);
        try {
            const [childrenData, systemPresets, categories] = await Promise.all([
                ParentChildService.getLinkedChildren(),
                PresetService.getPresets('SYSTEM'),
                MetaDataService.getAppCategories()
            ]);

            setChildren(childrenData);
            setPresets(systemPresets);
            setAllCategories(categories);

            // 초기 Preset 선택 (수업 집중 등)
            if (systemPresets.length > 0) {
                const defaultPreset = systemPresets.find(p => p.name.includes('수업')) || systemPresets[0];
                handlePresetSelect(defaultPreset);
            }
        } catch (error) {
            console.error("[QRGenerator] Load Data Failed:", error);
        } finally {
            setIsLoadingPresets(false);
        }
    };

    const handlePresetSelect = (preset: Preset) => {
        if (selectedPresetId === preset.id) {
            setSelectedPresetId(null);
            setLockTitle(qrType === 'INSTANT' ? '바로 잠금' : '예약 잠금');
            setSelectedCategories([]);
            setDuration(60);
            return;
        }

        setSelectedPresetId(preset.id);
        setLockTitle(preset.name);

        if (preset.default_duration_minutes) {
            setDuration(preset.default_duration_minutes);
        }

        if (preset.allowed_apps && preset.allowed_apps.length > 0) {
            setSelectedApps(preset.allowed_apps);
        } else if (preset.lock_type === 'FULL') {
            setSelectedApps([]); // 전체 잠금인 경우 앱 목록 비움
        }

        // 카테고리 설정 반영
        if (preset.blocked_categories && preset.blocked_categories.length > 0) {
            setSelectedCategories(preset.blocked_categories);
        } else {
            setSelectedCategories([]);
        }
    };

    const getCategoryLabel = (id: string) => {
        return allCategories.find(c => c.id === id)?.display_name || id;
    };

    const toggleCategory = (id: string) => {
        setSelectedCategories(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const generateQR = async (manual = true) => {
        if (manual && !selectedPresetId && selectedCategories.length === 0) {
            setIsCategoryPickerVisible(true);
            return;
        }

        // 자동 갱신인데 선택된게 없으면 무시
        if (!manual && !selectedPresetId && selectedCategories.length === 0) return;

        let timeWindow: string | undefined = undefined;
        let days: string[] | undefined = undefined;
        let finalDuration = duration;

        try {
            setQrValue(""); // 생성 시작 시 이전 값 초기화하여 혼선 방지
            console.log(`[QRGenerator] Generating ${qrType} QR for child ${selectedChildId}...`);

            let qr_type: 'DYNAMIC' | 'STATIC' = 'DYNAMIC';

            const selectedPreset = presets.find(p => p.id === selectedPresetId);
            let purpose: any = selectedPreset?.purpose || (qrType === 'INSTANT' ? 'LOCK_ONLY' : 'LOCK_AND_ATTENDANCE');

            if (qrType === 'SCHEDULED') {
                const sStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
                const eStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                timeWindow = `${sStr}-${eStr}`;
                days = selectedDays;

                const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
                finalDuration = diff > 0 ? diff : (24 * 60 + diff);
            }

            const result = await QrService.generateQr({
                qr_type,
                purpose,
                preset_id: selectedPresetId || undefined,
                duration_minutes: finalDuration,
                title: lockTitle,
                blocked_apps: selectedApps,
                blocked_categories: selectedCategories,
                time_window: timeWindow,
                days: days,
                one_time: qrType === 'INSTANT'
            });

            if (result && result.success) {
                setQrValue(result.payload || result.qr_id);
                setLastGeneratedConfig(currentConfig);
                setIsStale(false);
            } else {
                throw new Error(result?.message || "QR 생성 응답이 올바르지 않습니다.");
            }
        } catch (error) {
            console.error("[QRGenerator] Failed to generate QR:", error);
            // Fallback (Offline or Error)
            const fallback = {
                v: 1,
                type: qrType,
                title: lockTitle,
                duration: finalDuration,
                apps: selectedApps,
                presetId: selectedPresetId,
                childId: selectedChildId,
                window: timeWindow,
                days: days,
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            setQrValue(JSON.stringify(fallback));
            setLastGeneratedConfig(currentConfig);
            setIsStale(false);
        }
    };

    // Time Picker Logic (from AddScheduleScreen)
    const handleMinuteChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartTime : setEndTime;
        const currentTime = isStart ? startTime : endTime;
        const newMinutes = parseInt(val);
        const oldMinutes = currentTime.getMinutes();
        const newDate = new Date(currentTime);
        if (oldMinutes > 45 && newMinutes < 15) newDate.setHours(newDate.getHours() + 1);
        else if (oldMinutes < 15 && newMinutes > 45) newDate.setHours(newDate.getHours() - 1);
        newDate.setMinutes(newMinutes);
        setTime(newDate);
    };

    const handleHourChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartTime : setEndTime;
        const currentTime = isStart ? startTime : endTime;
        const isPM = currentTime.getHours() >= 12;
        let h = parseInt(val);
        if (h === 12) h = 0;
        const newDate = new Date(currentTime);
        newDate.setHours(isPM ? h + 12 : h);
        setTime(newDate);
    };

    const handleAmPmChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartTime : setEndTime;
        const currentTime = isStart ? startTime : endTime;
        const newIsPM = val === '오후';
        const currentIsPM = currentTime.getHours() >= 12;
        if (newIsPM !== currentIsPM) {
            const newDate = new Date(currentTime);
            const h = newDate.getHours();
            newDate.setHours(newIsPM ? h + 12 : h - 12);
            setTime(newDate);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            if (Platform.OS === 'android') {
                const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
                if (status !== 'granted' && Platform.Version < 33) return;
            }
            await CameraRoll.save(uri, { type: 'photo' });
            Alert.alert("저장 완료", "QR 코드가 갤러리에 저장되었습니다.");
        } catch (error) { console.error("Download Error:", error); }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            await NSSHARE.open({ url: uri, title: 'QR 코드 공유', type: 'image/png' });
        } catch (error) { console.error("Share Error:", error); }
    };

    const handleSaveSchedule = async () => {
        if (!lockTitle.trim()) {
            Alert.alert("오류", "잠금 제목을 입력해주세요.");
            return;
        }
        if (selectedDays.length === 0) {
            Alert.alert("오류", "반복 요일을 선택해주세요.");
            return;
        }

        try {
            const sStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            const eStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;

            const schedule = {
                name: lockTitle,
                startTime: sStr,
                endTime: eStr,
                days: selectedDays,
                apps: selectedApps,
                isActive: true
            };

            if (selectedChildId === 'all') {
                // Save for all children
                let successCount = 0;
                for (const child of children) {
                    const result = await ParentChildService.saveChildSchedule(child.id, schedule);
                    if (result.success) successCount++;
                }
                Alert.alert(
                    "저장 완료",
                    `${successCount}명의 자녀에게 예약 잠금이 저장되었습니다.\n\n잠금 제목: ${lockTitle}\n시간: ${sStr} ~ ${eStr}\n요일: ${selectedDays.join(', ')}`
                );
            } else {
                // Save for selected child
                const result = await ParentChildService.saveChildSchedule(selectedChildId, schedule);
                if (result.success) {
                    const childName = children.find(c => c.id === selectedChildId)?.childName || '선택한 자녀';
                    Alert.alert(
                        "저장 완료",
                        `${childName}에게 예약 잠금이 저장되었습니다.\n\n잠금 제목: ${lockTitle}\n시간: ${sStr} ~ ${eStr}\n요일: ${selectedDays.join(', ')}`
                    );
                } else {
                    Alert.alert("저장 실패", result.message || "예약 저장에 실패했습니다.");
                }
            }
        } catch (error) {
            console.error("Save Schedule Error:", error);
            Alert.alert("오류", "예약 저장 중 오류가 발생했습니다.");
        }
    };

    const qrSubtitle = qrType === 'INSTANT'
        ? `${duration}분 집중 모드`
        : `${selectedDays.join(', ')} / ${startTime.getHours()}:${startTime.getMinutes().toString().padStart(2, '0')}`;

    return (
        <View style={styles.container}>
            <Header title="QR 생성" showBack />

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, qrType === 'INSTANT' && styles.activeTab]}
                    onPress={() => {
                        setQrType('INSTANT');
                        setQrValue("");
                        setLastGeneratedConfig("");
                        setIsStale(false);
                    }}
                >
                    <Typography bold={qrType === 'INSTANT'} color={qrType === 'INSTANT' ? Colors.primary : Colors.textSecondary}>즉시 잠금</Typography>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, qrType === 'SCHEDULED' && styles.activeTab]}
                    onPress={() => {
                        setQrType('SCHEDULED');
                        setQrValue("");
                        setLastGeneratedConfig("");
                        setIsStale(false);
                    }}
                >
                    <Typography bold={qrType === 'SCHEDULED'} color={qrType === 'SCHEDULED' ? Colors.primary : Colors.textSecondary}>예약 잠금</Typography>
                </TouchableOpacity>
            </View>

            <View style={styles.presetSection}>
                <View style={styles.sectionHeader}>
                    <Typography bold>사전 등록 선택</Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>원하는 상황을 선택하세요</Typography>
                </View>
                <FlatList
                    horizontal
                    data={presets}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <PresetItem
                            preset={item}
                            isSelected={selectedPresetId === item.id}
                            onPress={handlePresetSelect}
                        />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetList}
                />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.configContainer}>
                    {/* 대상 자녀 선택 */}
                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 대상 자녀</Typography>
                        <View style={styles.childSelector}>
                            <TouchableOpacity
                                style={[styles.childItem, selectedChildId === 'all' && styles.childItemActive]}
                                onPress={() => setSelectedChildId('all')}
                            >
                                <Typography style={{ fontSize: 13 }} bold={selectedChildId === 'all'} color={selectedChildId === 'all' ? Colors.primary : Colors.text}>전체</Typography>
                            </TouchableOpacity>
                            {children.map(child => (
                                <TouchableOpacity
                                    key={child.id}
                                    style={[styles.childItem, selectedChildId === child.id && styles.childItemActive]}
                                    onPress={() => setSelectedChildId(child.id)}
                                >
                                    <Typography style={{ fontSize: 13 }} bold={selectedChildId === child.id} color={selectedChildId === child.id ? Colors.primary : Colors.text}>{child.childName}</Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

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

                    {qrType === 'INSTANT' ? (
                        <View style={styles.inputGroup}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 시간 (분)</Typography>
                            <TextInput
                                style={styles.textInput}
                                value={duration.toString()}
                                onChangeText={(val) => setDuration(parseInt(val) || 0)}
                                keyboardType="numeric"
                            />
                        </View>
                    ) : (
                        <>
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>시간 설정</Typography>
                                <View style={styles.timeRow}>
                                    <View style={styles.pickerContainer}>
                                        <Typography variant="caption" color={Colors.textSecondary}>시작</Typography>
                                        <TouchableOpacity style={styles.timeInputsSmall} onPress={() => { setPickerTarget('start'); setIsTimePickerVisible(true); }}>
                                            <Typography bold>{startTime.getHours() >= 12 ? '오후' : '오전'} {((startTime.getHours() + 11) % 12 + 1)}:{startTime.getMinutes().toString().padStart(2, '0')}</Typography>
                                        </TouchableOpacity>
                                        <Typography style={{ marginHorizontal: 8 }}>~</Typography>
                                        <Typography variant="caption" color={Colors.textSecondary}>종료</Typography>
                                        <TouchableOpacity style={styles.timeInputsSmall} onPress={() => { setPickerTarget('end'); setIsTimePickerVisible(true); }}>
                                            <Typography bold>{endTime.getHours() >= 12 ? '오후' : '오전'} {((endTime.getHours() + 11) % 12 + 1)}:{endTime.getMinutes().toString().padStart(2, '0')}</Typography>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>반복 요일</Typography>
                                <View style={styles.daysRow}>
                                    {DAYS.map(day => (
                                        <TouchableOpacity
                                            key={day}
                                            style={[styles.dayCircle, selectedDays.includes(day) && styles.dayCircleActive]}
                                            onPress={() => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                        >
                                            <Typography style={{ fontSize: 12 }} color={selectedDays.includes(day) ? Colors.text : Colors.textSecondary}>{day}</Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </>
                    )}

                    {/* 프리셋 정보 또는 앱/카테고리 선택 */}
                    {selectedPresetId ? (
                        <View style={styles.policyInfoBox}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 4 }}>사전 등록 정보</Typography>
                            <Typography style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 8 }}>
                                {presets.find(p => p.id === selectedPresetId)?.description}
                            </Typography>
                            <View style={styles.tagContainer}>
                                {presets.find(p => p.id === selectedPresetId)?.lock_type === 'FULL' ? (
                                    <View style={styles.policyTag}><Typography style={styles.tagText}>전체 잠금</Typography></View>
                                ) : (
                                    <>
                                        {selectedCategories.length > 0 ? (
                                            selectedCategories.map(cat => (
                                                <View key={cat} style={[styles.policyTag, { backgroundColor: Colors.primary + '15' }]}>
                                                    <Typography style={[styles.tagText, { color: Colors.primary }]}>{getCategoryLabel(cat)}</Typography>
                                                </View>
                                            ))
                                        ) : (
                                            selectedApps.length > 0 && (
                                                <View style={styles.policyTag}><Typography style={styles.tagText}>{selectedApps.length}개 앱 차단</Typography></View>
                                            )
                                        )}
                                    </>
                                )}
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.appPickerButton} onPress={() => setIsCategoryPickerVisible(true)}>
                            <Icon name="apps-outline" size={20} color={Colors.primary} />
                            <Typography color={Colors.primary} bold>
                                {selectedCategories.length > 0 ? `${selectedCategories.length}개의 카테고리 선택됨` : "잠글 카테고리 선택하기"}
                            </Typography>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.qrContainer}>
                    {qrValue ? (
                        <>
                            {isStale && (
                                <View style={styles.staleNotice}>
                                    <Icon name="alert-circle" size={16} color={Colors.primary} />
                                    <Typography variant="caption" color={Colors.primary} bold>설정이 변경되었습니다. QR을 갱신해주세요.</Typography>
                                </View>
                            )}
                            <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                                <QRCard
                                    title={lockTitle || (qrType === 'INSTANT' ? '바로 잠금' : '예약 잠금')}
                                    subtitle={qrSubtitle}
                                    value={qrValue}
                                />
                            </ViewShot>
                        </>
                    ) : (
                        <View style={styles.emptyQrBox}>
                            <Icon name="qr-code-outline" size={60} color={Colors.border} />
                            <Typography color={Colors.textSecondary} style={{ marginTop: 12 }}>
                                {qrType === 'SCHEDULED' ? '조건 설정 후 아래 생성 버튼을 눌러주세요' : 'QR를 생성 중입니다...'}
                            </Typography>
                        </View>
                    )}
                </View>

                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={[
                            styles.generateButton,
                            isStale && { backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#FFF' },
                            !qrValue && qrType === 'SCHEDULED' && { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.primary }
                        ]}
                        onPress={() => generateQR(true)}
                    >
                        <Icon
                            name={isStale ? "refresh-outline" : (qrValue ? "checkmark-circle" : "qr-code-outline")}
                            size={20}
                            color={(!qrValue && qrType === 'SCHEDULED') ? Colors.primary : "#FFF"}
                        />
                        <Typography
                            bold
                            color={(!qrValue && qrType === 'SCHEDULED') ? Colors.primary : "#FFF"}
                        >
                            {qrValue ? (isStale ? "설정 반영하여 갱신" : "QR 생성 완료") : "QR 코드 생성하기"}
                        </Typography>
                    </TouchableOpacity>

                    <View style={styles.secondaryActions}>
                        {qrType === 'SCHEDULED' ? (
                            <TouchableOpacity style={[styles.downloadButton, { flex: 1 }]} onPress={handleSaveSchedule}>
                                <Icon name="save-outline" size={20} color={Colors.primary} />
                                <Typography bold color={Colors.primary}>예약 저장</Typography>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
                                <Icon name="download-outline" size={20} color={Colors.text} />
                                <Typography bold>이미지 저장</Typography>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.shareButton, { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}
                            onPress={handleShare}
                        >
                            <Icon name="share-outline" size={20} color={Colors.primary} />
                            <Typography bold color={Colors.primary}>공유하기</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Category Picker Modal */}
            <Modal visible={isCategoryPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <Header title="잠글 카테고리 선택" showBack onBack={() => setIsCategoryPickerVisible(false)} />
                    <View style={{ padding: 20 }}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 20 }}>
                            잠금 시간 동안 차단될 카테고리를 선택해주세요.
                        </Typography>
                        <FlatList
                            data={allCategories}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.categoryItem} onPress={() => toggleCategory(item.id)}>
                                    <View style={[styles.checkbox, selectedCategories.includes(item.id) && styles.checkboxActive]}>
                                        {selectedCategories.includes(item.id) && <Icon name="checkmark" size={16} color="#FFF" />}
                                    </View>
                                    <Typography style={{ fontSize: 16 }}>{item.display_name}</Typography>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={() => setIsCategoryPickerVisible(false)}>
                        <Typography bold color="#FFF">선택 완료</Typography>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Time Picker Modal */}
            <Modal visible={isTimePickerVisible} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]}>
                    <View style={[styles.modalContent, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h2" bold>{pickerTarget === 'start' ? '시작' : '종료'} 시간 설정</Typography>
                            <TouchableOpacity onPress={() => setIsTimePickerVisible(false)}>
                                <Icon name="close" size={24} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ gap: 20, marginBottom: 30 }}>
                            {/* AM/PM Toggle */}
                            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                                <TouchableOpacity
                                    style={[styles.timeValueBtn, { minWidth: 80 }]}
                                    onPress={() => handleAmPmChange((pickerTarget === 'start' ? startTime : endTime).getHours() < 12 ? '오후' : '오전', pickerTarget === 'start')}
                                >
                                    <Typography variant="h2" bold>{(pickerTarget === 'start' ? startTime : endTime).getHours() < 12 ? '오전' : '오후'}</Typography>
                                </TouchableOpacity>
                            </View>

                            {/* Hour : Minute */}
                            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                {/* Hour */}
                                <View style={{ alignItems: 'center' }}>
                                    <TouchableOpacity
                                        style={styles.timeAdjustBtn}
                                        onPress={() => {
                                            const current = pickerTarget === 'start' ? startTime : endTime;
                                            let newHour = ((current.getHours() + 11) % 12 + 1) + 1;
                                            if (newHour > 12) newHour = 1;
                                            handleHourChange(newHour.toString(), pickerTarget === 'start');
                                        }}
                                    >
                                        <Icon name="chevron-up" size={24} color={Colors.primary} />
                                    </TouchableOpacity>
                                    <View style={[styles.timeValueBtn, { minWidth: 70, justifyContent: 'center', alignItems: 'center' }]}>
                                        <Typography variant="h1" bold>{(pickerTarget === 'start' ? startTime : endTime).getHours() % 12 || 12}시</Typography>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.timeAdjustBtn}
                                        onPress={() => {
                                            const current = pickerTarget === 'start' ? startTime : endTime;
                                            let newHour = ((current.getHours() + 11) % 12 + 1) - 1;
                                            if (newHour < 1) newHour = 12;
                                            handleHourChange(newHour.toString(), pickerTarget === 'start');
                                        }}
                                    >
                                        <Icon name="chevron-down" size={24} color={Colors.primary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Minute */}
                                <View style={{ alignItems: 'center' }}>
                                    <TouchableOpacity
                                        style={styles.timeAdjustBtn}
                                        onPress={() => {
                                            const current = pickerTarget === 'start' ? startTime : endTime;
                                            const mins = current.getMinutes();
                                            let newMin = (Math.floor(mins / 5) * 5) + 5;
                                            if (newMin >= 60) newMin = 0;
                                            handleMinuteChange(newMin.toString(), pickerTarget === 'start');
                                        }}
                                    >
                                        <Icon name="chevron-up" size={24} color={Colors.primary} />
                                    </TouchableOpacity>
                                    <View style={[styles.timeValueBtn, { minWidth: 70, justifyContent: 'center', alignItems: 'center' }]}>
                                        <Typography variant="h1" bold>{(pickerTarget === 'start' ? startTime : endTime).getMinutes().toString().padStart(2, '0')}분</Typography>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.timeAdjustBtn}
                                        onPress={() => {
                                            const current = pickerTarget === 'start' ? startTime : endTime;
                                            const mins = current.getMinutes();
                                            let newMin = (Math.ceil(mins / 5) * 5) - 5;
                                            if (newMin < 0) newMin = 55;
                                            handleMinuteChange(newMin.toString(), pickerTarget === 'start');
                                        }}
                                    >
                                        <Icon name="chevron-down" size={24} color={Colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: 12 }}>
                                * 원활한 동작을 위해 시간 설정 로직은 개발 중입니다.
                            </Typography>
                        </View>
                        <TouchableOpacity style={styles.modalConfirmButton} onPress={() => setIsTimePickerVisible(false)}>
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
    presetSection: { width: '100%', paddingVertical: 10, paddingLeft: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    presetList: { paddingRight: 20 },
    scrollContent: { padding: 20, alignItems: 'center' },
    configContainer: { width: '100%', backgroundColor: Colors.card, padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
    inputGroup: { marginBottom: 16 },
    textInput: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
    childSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    childItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
    childItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
    timeRow: { marginTop: 4 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
    timeInputsSmall: { marginLeft: 8, backgroundColor: Colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    dayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    dayCircleActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
    appPickerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginTop: 10 },
    qrContainer: { alignItems: 'center', marginBottom: 20 },
    policyInfoBox: { backgroundColor: Colors.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginTop: 10, alignSelf: 'stretch' },
    tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    policyTag: { backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
    tagText: { fontSize: 11, color: Colors.textSecondary },
    actionContainer: { width: '100%', gap: 12, marginBottom: 30 },
    generateButton: { flexDirection: 'row', backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10 },
    secondaryActions: { flexDirection: 'row', gap: 12 },
    downloadButton: { flex: 1, flexDirection: 'row', backgroundColor: Colors.card, paddingVertical: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
    shareButton: { flex: 1, flexDirection: 'row', backgroundColor: Colors.card, paddingVertical: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border },
    staleNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
    emptyQrBox: { width: '100%', minHeight: 400, backgroundColor: Colors.card, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
    modalContainer: { flex: 1, backgroundColor: Colors.background },
    categoryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, marginHorizontal: 20 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    modalConfirmButton: { margin: 20, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: Colors.background, borderRadius: 24, width: '100%', maxWidth: 400, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    timeAdjustBtn: { padding: 8 },
    timeValueBtn: { backgroundColor: Colors.card, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
});
