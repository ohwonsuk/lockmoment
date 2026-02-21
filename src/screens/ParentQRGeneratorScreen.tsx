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
import { StorageService, ParentLockHistory } from '../services/StorageService';
import { useAppNavigation } from '../navigation/NavigationContext';
import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { MetaDataService, AppCategory } from '../services/MetaDataService';
import { useAlert } from '../context/AlertContext';
import { LockService } from '../services/LockService';

const isIOS = Platform.OS === 'ios';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export const ParentQRGeneratorScreen: React.FC = () => {
    const { currentParams, goBack } = useAppNavigation();
    const { showAlert } = useAlert();
    const params = currentParams || {};

    const mode = params.mode || 'CREATE';
    const editChildId = params.childId || 'all';
    const editScheduleId = params.scheduleId;
    const scheduleData = params.scheduleData;

    // Base State
    const [qrType, setQrType] = useState<'INSTANT' | 'SCHEDULED'>(mode === 'EDIT' ? 'SCHEDULED' : 'INSTANT');
    const [lockTitle, setLockTitle] = useState(scheduleData?.name || '자녀 잠금');
    const [duration, setDuration] = useState(60);
    const [selectedApps, setSelectedApps] = useState<string[]>(scheduleData?.blockedApps || []);
    const [qrValue, setQrValue] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Child Selection
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>(editChildId);

    // History State
    const [qrHistory, setQrHistory] = useState<ParentLockHistory[]>([]);
    const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);

    // Meta Data State
    const [allCategories, setAllCategories] = useState<AppCategory[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(scheduleData?.blockedCategories || []);
    const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);

    const [isStale, setIsStale] = useState(false);
    const [lastGeneratedConfig, setLastGeneratedConfig] = useState<string | null>(null);

    // Platform (Generic parent assumes platform independent or follows general standard)
    const initLockType = (scheduleData?.lockType === 'APP_ONLY' || scheduleData?.lockType === 'APP' || scheduleData?.lock_type === 'APP') ? 'APP' : 'FULL';
    const [lockMethod, setLockMethod] = useState<'FULL' | 'CATEGORY' | 'APP'>(scheduleData ? initLockType as any : 'FULL');
    const [isAppPickerVisible, setIsAppPickerVisible] = useState(false);
    const [installedApps, setInstalledApps] = useState<{ label: string, packageName: string }[]>([]);


    // Schedule State
    const getInitDate = (timeStr?: string) => {
        if (!timeStr) {
            const rounded = new Date();
            rounded.setMinutes(Math.round(rounded.getMinutes() / 5) * 5);
            rounded.setSeconds(0);
            rounded.setMilliseconds(0);
            return rounded;
        }
        const [h, m] = timeStr.split(':');
        const d = new Date();
        d.setHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
        return d;
    };

    const EN_TO_KO: Record<string, string> = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };
    const initDays = (scheduleData?.days || []).map((d: string) => EN_TO_KO[d] || d);

    const [startTime, setStartTime] = useState(getInitDate(scheduleData?.startTime || scheduleData?.start_time));
    const [endTime, setEndTime] = useState(getInitDate(scheduleData?.endTime || scheduleData?.end_time || '23:59'));
    const [selectedDays, setSelectedDays] = useState<string[]>(scheduleData ? initDays : ['월', '화', '수', '목', '금']);

    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
    const [tempHour, setTempHour] = useState('');
    const [tempMin, setTempMin] = useState('');
    const cardRef = useRef<any>(null);

    useEffect(() => {
        if (isTimePickerVisible) {
            const cur = pickerTarget === 'start' ? startTime : endTime;
            setTempHour((cur.getHours() % 12 || 12).toString());
            setTempMin(cur.getMinutes().toString().padStart(2, '0'));
        }
    }, [isTimePickerVisible, pickerTarget]);

    const currentConfig = JSON.stringify({
        selectedChildId,
        selectedCategories,
        selectedApps,
        duration,
        lockTitle,
        qrType,
        lockMethod,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        selectedDays
    });

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
            const [childrenData, historyData, categories] = await Promise.all([
                ParentChildService.getLinkedChildren(),
                StorageService.getParentQRHistory(),
                MetaDataService.getAppCategories()
            ]);

            setChildren(childrenData);
            if (childrenData.length > 0 && selectedChildId === 'all') {
                setSelectedChildId(childrenData[0].id);
            }

            // De-duplicate history: same name and duration -> keep latest
            const uniqueHistory: ParentLockHistory[] = [];
            const seen = new Set<string>();

            const sorted = historyData.sort((a, b) => b.date - a.date);
            for (const item of sorted) {
                const key = `${item.name}_${item.duration}`;
                if (!seen.has(key)) {
                    uniqueHistory.push(item);
                    seen.add(key);
                }
            }
            setQrHistory(uniqueHistory);
            setAllCategories(categories);
        } catch (error) {
            console.error("[ParentQR] Load Data Failed:", error);
        }
    };

    const handleHistorySelect = (item: ParentLockHistory) => {
        setLockTitle(item.name);
        setDuration(item.duration);
        setQrType(item.qrType);
        setLockMethod(item.lockMethod);
        setSelectedApps(item.selectedApps || []);
        setSelectedCategories(item.selectedCategories || []);
        setIsHistoryModalVisible(false);
    };

    // Time Picker Helpers

    const handleHourChange = (val: string, isStart: boolean) => {
        setTempHour(val);
        const setTime = isStart ? setStartTime : setEndTime;
        const current = isStart ? startTime : endTime;
        const isPM = current.getHours() >= 12;
        let h = parseInt(val);
        if (isNaN(h)) return;
        if (h > 12) h = 12;
        if (h === 12) h = 0;
        const newDate = new Date(current);
        newDate.setHours(isPM ? h + 12 : h);
        setTime(newDate);
    };

    const handleMinuteChange = (val: string, isStart: boolean) => {
        setTempMin(val);
        const setTime = isStart ? setStartTime : setEndTime;
        const current = isStart ? startTime : endTime;
        let m = parseInt(val);
        if (isNaN(m)) return;
        if (m >= 60) m = 59;
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
            const currentMin = newDate.getMinutes();
            if (currentMin % 5 !== 0) {
                newDate.setMinutes(delta > 0 ? Math.ceil(currentMin / 5) * 5 : Math.floor(currentMin / 5) * 5);
            } else {
                newDate.setMinutes(currentMin + delta);
            }
        }
        setTime(newDate);
        // Sync temp state after adjustment
        setTimeout(() => {
            const updated = isStart ? (type === 'hour' ? newDate : newDate) : newDate; // just updated
            setTempHour((newDate.getHours() % 12 || 12).toString());
            setTempMin(newDate.getMinutes().toString().padStart(2, '0'));
        }, 0);
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

                const schedulePayload = {
                    name: lockTitle,
                    startTime: sStr,
                    endTime: eStr,
                    days: selectedDays,
                    lockType: lockMethod === 'FULL' ? 'FULL' : 'APP',
                    blockedApps: lockMethod === 'APP' ? selectedApps : undefined,
                    blockedCategories: lockMethod === 'CATEGORY' ? selectedCategories : undefined,
                    isActive: scheduleData?.isActive ?? true
                };

                let saveRes;
                if (mode === 'EDIT') {
                    saveRes = await ParentChildService.updateChildSchedule(selectedChildId, editScheduleId, schedulePayload as any);
                } else {
                    saveRes = await ParentChildService.createChildSchedule(selectedChildId, schedulePayload as any);
                }

                if (!saveRes.success) {
                    console.log("Server schedule save failed, but QR will still be generated");
                }
            }

            const result = await QrService.generateQr({
                qr_type: 'DYNAMIC',
                purpose: qrType === 'INSTANT' ? 'LOCK_ONLY' : 'LOCK_AND_ATTENDANCE',
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

                // Save to History
                const child = children.find(c => c.id === selectedChildId);
                const platform = child?.deviceName?.toUpperCase().includes('IOS') ? 'IOS' :
                    (child?.deviceName?.toUpperCase().includes('ANDROID') ? 'ANDROID' : 'UNKNOWN');

                await StorageService.saveParentQRHistory({
                    name: lockTitle,
                    duration: duration,
                    lockMethod: lockMethod,
                    selectedApps: selectedApps,
                    selectedCategories: selectedCategories,
                    qrType: qrType,
                    platform: platform as any
                });
                loadData(); // Refresh history list
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

    const handleDelete = async () => {
        showAlert({
            title: "스케줄 삭제",
            message: "이 스케줄을 삭제하시겠습니까?",
            cancelText: "취소",
            confirmText: "삭제",
            onConfirm: async () => {
                setIsGenerating(true);
                try {
                    const result = await ParentChildService.deleteChildSchedule(selectedChildId, editScheduleId);
                    if (result.success) {
                        try {
                            await LockService.syncSchedules();
                        } catch (e) { }
                        goBack();
                    } else {
                        showAlert({ title: "오류", message: result.message || "삭제에 실패했습니다." });
                    }
                } catch (e) {
                    showAlert({ title: "오류", message: "네트워크 오류가 발생했습니다." });
                } finally {
                    setIsGenerating(false);
                }
            }
        });
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

    const isChildIOS = () => {
        if (selectedChildId === 'all') return false;
        const child = children.find(c => c.id === selectedChildId);
        return child?.deviceName?.toUpperCase().includes('IOS');
    };

    return (
        <View style={styles.container}>
            <Header title={mode === 'EDIT' ? "예약 스케줄 변경" : "자녀 관리용 QR 생성"} showBack={mode === 'EDIT'} onBack={() => goBack()} />

            {/* Child Selection & Tabs (Hidden in EDIT mode) */}
            {mode !== 'EDIT' && (
                <>
                    <View style={styles.childSelectRow}>
                        <Typography bold style={styles.childSelectLabel}>자녀선택</Typography>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childBoxContainer}>
                            {children.length > 1 && (
                                <TouchableOpacity
                                    style={[styles.childBox, selectedChildId === 'all' && styles.childBoxActive]}
                                    onPress={() => setSelectedChildId('all')}
                                >
                                    <Typography color={selectedChildId === 'all' ? '#FFF' : Colors.text} bold={selectedChildId === 'all'}>전체</Typography>
                                </TouchableOpacity>
                            )}
                            {children.map(child => (
                                <TouchableOpacity
                                    key={child.id}
                                    style={[styles.childBox, selectedChildId === child.id && styles.childBoxActive]}
                                    onPress={() => setSelectedChildId(child.id)}
                                >
                                    <Typography color={selectedChildId === child.id ? '#FFF' : Colors.text} bold={selectedChildId === child.id}>{child.childName}</Typography>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.tabContainer}>
                        <TouchableOpacity style={[styles.tab, qrType === 'INSTANT' && styles.activeTab]} onPress={() => { setQrType('INSTANT'); setQrValue(""); }}>
                            <Typography bold={qrType === 'INSTANT'} color={qrType === 'INSTANT' ? Colors.primary : Colors.textSecondary}>즉시 잠금</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tab, qrType === 'SCHEDULED' && styles.activeTab]} onPress={() => { setQrType('SCHEDULED'); setQrValue(""); }}>
                            <Typography bold={qrType === 'SCHEDULED'} color={qrType === 'SCHEDULED' ? Colors.primary : Colors.textSecondary}>예약 잠금</Typography>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* History Section (Hidden in EDIT mode) */}
                {mode !== 'EDIT' && (
                    <View style={styles.historySection}>
                        <TouchableOpacity style={styles.historyButton} onPress={() => setIsHistoryModalVisible(true)}>
                            <Icon name="time-outline" size={20} color={Colors.primary} />
                            <Typography bold color={Colors.primary}>이전 이력에서 불러오기</Typography>
                            <Icon name="chevron-forward" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* History Modal */}
                <Modal visible={isHistoryModalVisible} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Typography variant="h2" bold>최근 사용 이력</Typography>
                                <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                                    <Icon name="close" size={24} color={Colors.text} />
                                </TouchableOpacity>
                            </View>
                            {qrHistory.length > 0 ? (
                                <FlatList
                                    data={qrHistory}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity style={styles.historyItem} onPress={() => handleHistorySelect(item)}>
                                            <View style={styles.historyItemInfo}>
                                                <Typography bold>{item.name}</Typography>
                                                <Typography variant="caption" color={Colors.textSecondary}>
                                                    {item.duration}분 • {item.lockMethod === 'FULL' ? '전체' : (item.lockMethod === 'CATEGORY' ? '카테고리' : '개별앱')}
                                                </Typography>
                                            </View>
                                            <Typography variant="caption" color={Colors.statusInactive}>
                                                {new Date(item.date).toLocaleDateString()}
                                            </Typography>
                                        </TouchableOpacity>
                                    )}
                                />
                            ) : (
                                <View style={styles.emptyHistory}>
                                    <Typography color={Colors.textSecondary}>최근 이력이 없습니다.</Typography>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>

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
                                <View style={styles.timeBoxContainer}>
                                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }} onPress={() => { setPickerTarget('start'); setIsTimePickerVisible(true); }}>
                                        <Typography variant="h2" bold>{startTime.getHours() < 12 ? '오전' : '오후'} {startTime.getHours() % 12 || 12}:{startTime.getMinutes().toString().padStart(2, '0')}</Typography>
                                    </TouchableOpacity>
                                    <Typography style={{ marginHorizontal: 10 }}>~</Typography>
                                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }} onPress={() => { setPickerTarget('end'); setIsTimePickerVisible(true); }}>
                                        <Typography variant="h2" bold>{endTime.getHours() < 12 ? '오전' : '오후'} {endTime.getHours() % 12 || 12}:{endTime.getMinutes().toString().padStart(2, '0')}</Typography>
                                    </TouchableOpacity>
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

                    {/* Lock Method Refactored */}
                    <View style={styles.inputGroup}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 12 }}>잠금 방식</Typography>
                        {isChildIOS() ? (
                            <View style={styles.iosMethodNotice}>
                                <Icon name="logo-apple" size={24} color={Colors.text} />
                                <View style={{ flex: 1 }}>
                                    <Typography bold>스크린타임 설정 연동</Typography>
                                    <Typography variant="caption" color={Colors.textSecondary}>자녀 폰의 락모먼트 앱에 설정된 차단 앱 기준</Typography>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.methodContainer}>
                                {(['FULL', 'CATEGORY', 'APP'] as const).map(m => (
                                    <TouchableOpacity key={m} style={[styles.methodItem, lockMethod === m && styles.methodItemActive]} onPress={() => setLockMethod(m)}>
                                        <Icon name={m === 'FULL' ? 'phone-portrait-outline' : (m === 'CATEGORY' ? 'grid-outline' : 'apps-outline')} size={24} color={lockMethod === m ? Colors.primary : Colors.textSecondary} />
                                        <Typography variant="caption" bold color={lockMethod === m ? Colors.primary : Colors.textSecondary}>{m === 'FULL' ? '전체' : (m === 'CATEGORY' ? '카테고리' : '개별앱')}</Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* QR Display */}
                <View style={styles.qrContainer}>
                    {qrValue ? (
                        <View style={styles.qrWrapper}>
                            {isStale && (
                                <View style={styles.staleBanner}>
                                    <Icon name="alert-circle" size={18} color={Colors.primary} />
                                    <View>
                                        <Typography bold color={Colors.primary} variant="caption">잠금 조건이 변경되었습니다.</Typography>
                                        <Typography color={Colors.primary} variant="caption" style={{ fontSize: 10 }}>QR 코드를 다시 생성해 주세요.</Typography>
                                    </View>
                                </View>
                            )}
                            <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                                <QRCard title={lockTitle} subtitle={qrType === 'INSTANT' ? `${duration}분` : `${selectedDays.join('')}`} value={qrValue} />
                            </ViewShot>
                        </View>
                    ) : (
                        <View style={styles.emptyQrBox}>
                            <Icon name="qr-code-outline" size={60} color={Colors.border} />
                            <Typography color={Colors.textSecondary} style={{ marginTop: 10 }}>자녀에게 전달할 QR 보드를 만드세요</Typography>
                        </View>
                    )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity style={styles.generateButton} onPress={generateQR} disabled={isGenerating}>
                        <Icon name="qr-code-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">
                            {isGenerating ? "생성 중..." : (qrValue && isStale ? "QR코드 다시 생성하기" : "QR 코드 생성하기")}
                        </Typography>
                    </TouchableOpacity>

                    {qrValue && (
                        <View style={styles.secondaryActions}>
                            <TouchableOpacity style={styles.downloadButtonActive} onPress={handleDownload}>
                                <Icon name="download-outline" size={20} color="#FFF" />
                                <Typography bold color="#FFF">이미지저장</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.shareButtonActive} onPress={handleShare}>
                                <Icon name="share-outline" size={20} color="#FFF" />
                                <Typography bold color="#FFF">공유</Typography>
                            </TouchableOpacity>
                        </View>
                    )}

                    {mode === 'EDIT' && (
                        <TouchableOpacity
                            style={[styles.deleteButton, { marginTop: 12 }]}
                            onPress={handleDelete}
                            disabled={isGenerating}
                        >
                            <Typography bold color="#FF4B4B">스케줄 삭제</Typography>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* Time Picker Modal */}
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
                                <TouchableOpacity onPress={() => adjustTimeValue('hour', 1)} style={styles.stepBtn}><Icon name="chevron-up" size={24} color={Colors.textSecondary} /></TouchableOpacity>
                                <TextInput
                                    style={[styles.textInput, styles.timeInputModal]}
                                    keyboardType="numeric"
                                    value={tempHour}
                                    onChangeText={(v) => handleHourChange(v, pickerTarget === 'start')}
                                    maxLength={2}
                                />
                                <TouchableOpacity onPress={() => adjustTimeValue('hour', -1)} style={styles.stepBtn}><Icon name="chevron-down" size={24} color={Colors.textSecondary} /></TouchableOpacity>
                            </View>
                            <Typography style={{ fontSize: 24, alignSelf: 'center' }}>:</Typography>
                            <View style={styles.stepperColumn}>
                                <TouchableOpacity onPress={() => adjustTimeValue('min', 5)} style={styles.stepBtn}><Icon name="chevron-up" size={24} color={Colors.textSecondary} /></TouchableOpacity>
                                <TextInput
                                    style={[styles.textInput, styles.timeInputModal]}
                                    keyboardType="numeric"
                                    value={tempMin}
                                    onChangeText={(v) => handleMinuteChange(v, pickerTarget === 'start')}
                                    maxLength={2}
                                />
                                <TouchableOpacity onPress={() => adjustTimeValue('min', -5)} style={styles.stepBtn}><Icon name="chevron-down" size={24} color={Colors.textSecondary} /></TouchableOpacity>
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
    childSelectRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
    childSelectLabel: { marginRight: 15, fontSize: 16 },
    childBoxContainer: { gap: 8 },
    childBox: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
    childBoxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

    tabContainer: { flexDirection: 'row', padding: 20, paddingBottom: 0, gap: 10 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
    activeTab: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },

    scrollContent: { padding: 20 },

    historySection: { marginBottom: 20 },
    historyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '10', padding: 14, borderRadius: 12, gap: 10, borderWidth: 1, borderColor: Colors.primary + '30' },

    iosMethodNotice: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, gap: 12 },

    configContainer: { backgroundColor: Colors.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
    inputGroup: { marginBottom: 20 },
    textInput: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
    timeRow: { marginTop: 4 },
    timeBoxContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10 },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    dayCircleActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
    methodContainer: { flexDirection: 'row', gap: 10 },
    methodItem: { flex: 1, backgroundColor: Colors.background, padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    methodItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    qrContainer: { alignItems: 'center', marginTop: 20 },
    qrWrapper: { width: '100%', alignItems: 'center' },
    staleBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '15', padding: 12, borderRadius: 12, marginBottom: 12, gap: 10, alignSelf: 'stretch', borderWidth: 1, borderColor: Colors.primary + '30' },
    emptyQrBox: { width: '100%', aspectRatio: 1.2, backgroundColor: Colors.card, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
    staleNotice: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary + '15', padding: 8, borderRadius: 20, marginBottom: 10 },

    actionContainer: { marginTop: 20, gap: 12 },
    generateButton: { flexDirection: 'row', backgroundColor: Colors.primary, padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    saveButton: { flexDirection: 'row', backgroundColor: Colors.primary + '10', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.primary },
    deleteButton: { backgroundColor: 'transparent', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#FF4B4B22' },
    secondaryActions: { flexDirection: 'row', gap: 12 },
    downloadButtonActive: { flex: 1, flexDirection: 'row', backgroundColor: '#34C759', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
    shareButtonActive: { flex: 1, flexDirection: 'row', backgroundColor: Colors.primary, padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: Colors.card, borderRadius: 24, padding: 20, maxHeight: '80%' },
    timeValueBtn: { backgroundColor: Colors.card, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
    stepperColumn: { alignItems: 'center', gap: 5 },
    stepBtn: { padding: 5 },
    timeInputModal: { width: 80, textAlign: 'center', fontSize: 24, paddingVertical: 10, backgroundColor: Colors.card },
    modalConfirmButton: { marginHorizontal: 20, backgroundColor: Colors.primary, padding: 18, borderRadius: 16, alignItems: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.border },
    historyItemInfo: { flex: 1 },
    emptyHistory: { padding: 40, alignItems: 'center' }
});
