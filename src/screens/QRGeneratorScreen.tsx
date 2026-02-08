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

import { ParentChildService, ChildInfo } from '../services/ParentChildService';

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

    // Child Selection
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('all'); // 'all' or specific id

    // Schedule State (for SCHEDULED tab)
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 3600000));
    const [selectedDays, setSelectedDays] = useState<string[]>(['월', '화', '수', '목', '금']);

    // UI Helpers
    const [isAppPickerVisible, setIsAppPickerVisible] = useState(false);
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');
    const [installedApps, setInstalledApps] = useState<{ label: string, packageName: string }[]>([]);
    const cardRef = useRef<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await ParentChildService.getLinkedChildren();
        setChildren(data);
        if (data.length > 0 && !params.childId) {
            // setSelectedChildId(data[0].id); // Default to first child or keep 'all'
        }
        generateQR();
    };

    const generateQR = async () => {
        try {
            console.log(`[QRGenerator] Generating ${qrType} QR for child ${selectedChildId}...`);

            let type: any = qrType === 'INSTANT' ? 'USER_INSTANT_LOCK' : 'USER_SCHEDULE_LOCK';
            let timeWindow: string | undefined = undefined;
            let days: string[] | undefined = undefined;
            let finalDuration = duration;

            if (qrType === 'SCHEDULED') {
                const sStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
                const eStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                timeWindow = `${sStr}-${eStr}`;
                days = selectedDays;

                const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
                finalDuration = diff > 0 ? diff : (24 * 60 + diff);
            }

            const result = await QrService.generateQr(
                type,
                finalDuration,
                lockTitle,
                selectedApps,
                timeWindow,
                days
            );

            if (result && result.success) {
                // Add target child info to payload if needed by scanner,
                // but usually the scanner just applies the policy.
                // If it's for a specific child, the backend might handle it.
                // For now, we use the returned payload.
                setQrValue(result.payload || result.qr_id);
            } else {
                // Fallback
                const fallback = {
                    v: 1,
                    type: qrType,
                    title: lockTitle,
                    duration: finalDuration,
                    apps: selectedApps,
                    childId: selectedChildId,
                    window: timeWindow,
                    days: days,
                    exp: Math.floor(Date.now() / 1000) + 3600
                };
                setQrValue(JSON.stringify(fallback));
            }
        } catch (error) {
            console.error("[QRGenerator] Failed to generate QR:", error);
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

    const toggleApp = (packageName: string) => {
        setSelectedApps(prev => prev.includes(packageName) ? prev.filter(p => p !== packageName) : [...prev, packageName]);
    };

    const handleSelectApps = async () => {
        try {
            const universalApps = UniversalAppMapper.getDefaultUniversalIds();
            const initialList = universalApps.map(id => ({ label: id.charAt(0).toUpperCase() + id.slice(1), packageName: id }));
            if (Platform.OS === 'android') {
                const apps = await NativeLockControl.getInstalledApps();
                const combined = [...initialList, ...apps.filter(app => !universalApps.includes(UniversalAppMapper.mapToUniversal(app.packageName, 'android')))];
                setInstalledApps(combined);
            } else {
                setInstalledApps(initialList);
            }
            setIsAppPickerVisible(true);
        } catch (e) {
            console.error("App Selection Error:", e);
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
                    onPress={() => setQrType('INSTANT')}
                >
                    <Typography bold={qrType === 'INSTANT'} color={qrType === 'INSTANT' ? Colors.primary : Colors.textSecondary}>즉시 잠금</Typography>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, qrType === 'SCHEDULED' && styles.activeTab]}
                    onPress={() => setQrType('SCHEDULED')}
                >
                    <Typography bold={qrType === 'SCHEDULED'} color={qrType === 'SCHEDULED' ? Colors.primary : Colors.textSecondary}>예약 잠금</Typography>
                </TouchableOpacity>
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
                            title={lockTitle || (qrType === 'INSTANT' ? '바로 잠금' : '예약 잠금')}
                            subtitle={qrSubtitle}
                            value={qrValue || 'pending'}
                        />
                    </ViewShot>
                </View>

                <View style={styles.actionContainer}>
                    <TouchableOpacity style={styles.generateButton} onPress={generateQR}>
                        <Icon name="refresh-outline" size={20} color="#FFF" />
                        <Typography bold color="#FFF">QR 생성/갱신</Typography>
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
                        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                            <Icon name="share-outline" size={20} color="#FFF" />
                            <Typography bold color="#FFF">공유</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <Modal visible={isAppPickerVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <Header title="앱 선택" showBack onBack={() => setIsAppPickerVisible(false)} />
                    <FlatList
                        data={installedApps}
                        keyExtractor={(item) => item.packageName}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.appItem} onPress={() => toggleApp(item.packageName)}>
                                <View style={[styles.checkbox, selectedApps.includes(item.packageName) && styles.checkboxActive]}>
                                    {selectedApps.includes(item.packageName) && <Icon name="checkmark" size={16} color="#FFF" />}
                                </View>
                                <Typography style={styles.appLabel}>{item.label}</Typography>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ padding: 20 }}
                    />
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={() => setIsAppPickerVisible(false)}>
                        <Typography bold color="#FFF">확인</Typography>
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
                                        <Typography variant="h1" bold>{((pickerTarget === 'start' ? startTime : endTime).getHours() + 11) % 12 + 1}시</Typography>
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
                                            let newMin = current.getMinutes() + 5;
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
                                            let newMin = current.getMinutes() - 5;
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
    actionContainer: { width: '100%', gap: 12, marginBottom: 30 },
    generateButton: { flexDirection: 'row', backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10 },
    secondaryActions: { flexDirection: 'row', gap: 12 },
    downloadButton: { flex: 1, flexDirection: 'row', backgroundColor: Colors.card, paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.border },
    shareButton: { flex: 1, flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10 },
    modalContainer: { flex: 1, backgroundColor: Colors.background },
    appItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: Colors.primary },
    appLabel: { fontSize: 16 },
    modalConfirmButton: { backgroundColor: Colors.primary, margin: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: Colors.background, borderRadius: 24, width: '100%', maxWidth: 400, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    timeValueBtn: { padding: 10, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
    timeAdjustBtn: { padding: 8 }
});
