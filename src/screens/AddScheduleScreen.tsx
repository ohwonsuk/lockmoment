import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Switch, Platform, Modal, FlatList, Alert, PermissionsAndroid } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { Header } from '../components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker as IOSPicker } from '@react-native-picker/picker';
import { Picker as AndroidPicker } from 'react-native-wheel-pick';
import { StorageService, Schedule } from '../services/StorageService';
import { NativeLockControl } from '../services/NativeLockControl';
import { useAlert } from '../context/AlertContext';
import { UniversalAppMapper } from '../services/UniversalAppMapper';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { QRCard } from '../components/QRCard';
import { QrService } from '../services/QrService';
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import NSSHARE from 'react-native-share';

const isIOS = Platform.OS === 'ios';

export const AddScheduleScreen: React.FC = () => {
    const { navigate, currentParams } = useAppNavigation();
    const { showAlert } = useAlert();
    const insets = useSafeAreaInsets();
    const cardRef = useRef(null);

    const [name, setName] = useState('예약 잠금');
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 3600000));
    const [selectedDays, setSelectedDays] = useState<string[]>(['월', '화', '수', '목', '금']);
    const [lockType, setLockType] = useState('app');
    const [lockedApps, setLockedApps] = useState<string[]>(UniversalAppMapper.getDefaultUniversalIds());
    const [editingId, setEditingId] = useState<string | null>(null);

    // App Picker State
    const [isAppPickerVisible, setIsAppPickerVisible] = useState(false);
    const [installedApps, setInstalledApps] = useState<{ label: string, packageName: string }[]>([]);

    // QR Modal State
    const [isQRModalVisible, setIsQRModalVisible] = useState(false);
    const [qrValue, setQrValue] = useState('');

    const isLoadedRef = useRef(false);

    useEffect(() => {
        const id = (globalThis as any).editingScheduleId;
        const prepare = async () => {
            if (id) {
                setEditingId(id);
                const data = await loadSchedule(id);
                isLoadedRef.current = true;
                if (currentParams?.showQR && data) {
                    handleGenerateQR(data);
                }
            } else {
                setLockedApps(UniversalAppMapper.getDefaultUniversalIds());
                isLoadedRef.current = true;
            }
        };
        prepare();
    }, []);

    const loadSchedule = async (id: string) => {
        const schedules = await StorageService.getSchedules();
        const schedule = schedules.find(s => s.id === id);
        if (schedule) {
            setName(schedule.name);
            setSelectedDays(schedule.days);
            setLockType(schedule.lockType || 'app');

            // Legacy/Missing apps check
            let resolvedApps = [];
            if (schedule.lockedApps && schedule.lockedApps.length > 0) {
                resolvedApps = schedule.lockedApps;
            } else if ((schedule as any).allowedApp) {
                resolvedApps = [(schedule as any).allowedApp.packageName];
            } else {
                resolvedApps = UniversalAppMapper.getDefaultUniversalIds();
            }
            setLockedApps(resolvedApps);

            const [sH, sM] = schedule.startTime.split(':');
            const [eH, eM] = schedule.endTime.split(':');

            const sDate = new Date();
            sDate.setHours(parseInt(sH), parseInt(sM), 0, 0);
            setStartTime(sDate);

            const eDate = new Date();
            eDate.setHours(parseInt(eH), parseInt(eM), 0, 0);
            setEndTime(eDate);

            return {
                name: schedule.name,
                days: schedule.days,
                lockedApps: resolvedApps,
                startTime: sDate,
                endTime: eDate
            };
        }
    };

    const days = ['월', '화', '수', '목', '금', '토', '일'];

    const toggleDay = (day: string) => {
        if (selectedDays.includes(day)) {
            setSelectedDays(selectedDays.filter(d => d !== day));
        } else {
            setSelectedDays([...selectedDays, day]);
        }
    };

    const handleMinuteChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartTime : setEndTime;
        const currentTime = isStart ? startTime : endTime;
        const newMinutes = parseInt(val);
        const oldMinutes = currentTime.getMinutes();
        const newDate = new Date(currentTime);

        if (oldMinutes > 45 && newMinutes < 15) {
            newDate.setHours(newDate.getHours() + 1);
        } else if (oldMinutes < 15 && newMinutes > 45) {
            newDate.setHours(newDate.getHours() - 1);
        }
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
            const currentHour = newDate.getHours();
            if (newIsPM) {
                newDate.setHours(currentHour + 12);
            } else {
                newDate.setHours(currentHour - 12);
            }
            setTime(newDate);
        }
    };

    const handleAppSelect = async () => {
        try {
            const universalAppsList = UniversalAppMapper.getDefaultUniversalIds();
            const initialList = universalAppsList.map(id => ({
                label: id.charAt(0).toUpperCase() + id.slice(1),
                packageName: id
            }));

            if (Platform.OS === 'android') {
                const apps = await NativeLockControl.getInstalledApps();
                // Ensure all user apps are shown by filtering against mapped universal apps
                const otherApps = apps.filter(app => {
                    const uni = UniversalAppMapper.mapToUniversal(app.packageName, 'android');
                    return !universalAppsList.includes(uni);
                });

                const combined = [
                    ...initialList,
                    ...otherApps
                ];
                setInstalledApps(combined);
            } else {
                // On iOS, we can't fetch installed apps list, only show Universal ones or use FamilyActivityPicker button?
                // For now, consistent with user's screenshot showing custom modal.
                setInstalledApps(initialList);
            }
            setIsAppPickerVisible(true);
        } catch (e) {
            console.error("App Selection Error:", e);
        }
    };

    const toggleApp = (packageName: string) => {
        setLockedApps(prev =>
            prev.includes(packageName)
                ? prev.filter(p => p !== packageName)
                : [...prev, packageName]
        );
    };

    const handleSave = async () => {
        const newSchedule: Schedule = {
            id: editingId || Date.now().toString(),
            name,
            startTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
            days: selectedDays,
            lockType,
            lockedApps: lockedApps,
            isActive: true,
        };

        await StorageService.saveSchedule(newSchedule);

        const notificationSettings = await StorageService.getNotificationSettings();
        const preLockMinutes = (notificationSettings.enabled && notificationSettings.preLockEnabled)
            ? notificationSettings.preLockMinutes
            : 0;

        const authStatus = await NativeLockControl.checkAuthorization();
        const isAuthorized = authStatus === 2;

        if (!isAuthorized) {
            showAlert({
                title: "권한 설정 필요",
                message: "예약 잠금 기능이 정상적으로 동작하려면 '스크린 타임(또는 접근성)'과 '알림' 권한이 모두 허용되어야 합니다. 권한 설정 화면으로 이동하시겠습니까?",
                confirmText: "이동",
                cancelText: "취소",
                onConfirm: () => navigate('Permissions')
            });
            return;
        }

        try {
            const preventRemoval = await StorageService.getPreventAppRemoval();

            // CRITICAL: Map universal IDs to native package names before sending to native side
            const nativeLockedApps = UniversalAppMapper.mapToNative(lockedApps, Platform.OS as any);

            await NativeLockControl.scheduleAlarm(
                newSchedule.id,
                newSchedule.startTime,
                newSchedule.endTime,
                newSchedule.days,
                newSchedule.lockType,
                newSchedule.name,
                JSON.stringify(nativeLockedApps),
                preventRemoval,
                preLockMinutes
            );
        } catch (error) {
            console.error('Failed to schedule alarm:', error);
        }

        showAlert({
            title: "저장 완료",
            message: editingId ? "예약이 수정되었습니다." : "예약 잠금이 저장되었습니다.",
            onConfirm: () => navigate('Dashboard')
        });
    };

    const handleDelete = async () => {
        if (!editingId) return;
        showAlert({
            title: "삭제 확인",
            message: "이 예약을 삭제하시겠습니까?",
            confirmText: "삭제",
            cancelText: "취소",
            type: 'error',
            onConfirm: async () => {
                await NativeLockControl.cancelAlarm(editingId);
                await StorageService.deleteSchedule(editingId);
                navigate('Dashboard');
            }
        });
    };

    const handleGenerateQR = async (overrideData?: any) => {
        const targetStartTime = overrideData?.startTime || startTime;
        const targetEndTime = overrideData?.endTime || endTime;
        const targetName = overrideData?.name || name;
        const targetApps = overrideData?.lockedApps || lockedApps;
        const targetDays = overrideData?.days || selectedDays;

        const durationMin = Math.floor((targetEndTime.getTime() - targetStartTime.getTime()) / 60000);
        const cappedDuration = durationMin > 0 ? durationMin : (24 * 60 + durationMin);

        const startStr = `${targetStartTime.getHours().toString().padStart(2, '0')}:${targetStartTime.getMinutes().toString().padStart(2, '0')}`;
        const endStr = `${targetEndTime.getHours().toString().padStart(2, '0')}:${targetEndTime.getMinutes().toString().padStart(2, '0')}`;
        const timeWindow = `${startStr}-${endStr}`;

        setIsQRModalVisible(true);
        const result = await QrService.generateQr(
            'USER_SCHEDULE_LOCK',
            cappedDuration,
            targetName,
            targetApps,
            timeWindow,
            targetDays
        );
        if (result && result.payload) {
            setQrValue(result.payload);
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        try {
            const uri = await captureRef(cardRef, { format: "png", quality: 0.8 });
            if (Platform.OS === 'android') {
                const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
                const status = await PermissionsAndroid.request(permission);
                if (status !== 'granted' && Platform.Version < 33) return;
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
                message: `락모먼트 예약 잠금 QR 코드: ${name}`,
            });
        } catch (error) {
            console.error("Share Error:", error);
        }
    };

    const formatDurationText = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (h > 0 && m > 0) return `${h}시간 ${m}분`;
        if (h > 0) return `${h}시간`;
        return `${m}분`;
    };

    const durationMin = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
    const displayDuration = durationMin > 0 ? durationMin : (24 * 60 + durationMin);
    const qrSubtitle = `${selectedDays.join(', ')} / ${startTime.getHours()}:${startTime.getMinutes().toString().padStart(2, '0')} (${formatDurationText(displayDuration)})`;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigate('Dashboard')} style={styles.headerButton}>
                    <Icon name="close" size={28} />
                </TouchableOpacity>
                <Typography variant="h2" bold>{editingId ? "예약 수정" : "예약 추가"}</Typography>
                <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                    <Typography color={Colors.primary} bold>저장</Typography>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>일정 이름</Typography>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor={Colors.textSecondary}
                    />
                </View>

                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>시간 설정</Typography>
                    <View style={styles.timeRow}>
                        <View style={styles.timeCard}>
                            <Typography variant="caption" color={Colors.textSecondary} style={styles.timeLabel}>시작 시간</Typography>
                            <View style={styles.pickerContainer}>
                                {isIOS ? (
                                    <IOSPicker
                                        style={styles.ampmPicker}
                                        selectedValue={startTime.getHours() >= 12 ? '오후' : '오전'}
                                        onValueChange={(val) => handleAmPmChange(val, true)}
                                        itemStyle={styles.pickerItemIOS}
                                    >
                                        <IOSPicker.Item label="오전" value="오전" />
                                        <IOSPicker.Item label="오후" value="오후" />
                                    </IOSPicker>
                                ) : (
                                    <AndroidPicker
                                        style={styles.ampmPicker}
                                        selectedValue={startTime.getHours() >= 12 ? '오후' : '오전'}
                                        pickerData={['오전', '오후']}
                                        onValueChange={(val: any) => handleAmPmChange(val, true)}
                                    />
                                )}
                                <Typography style={styles.colonText}>:</Typography>
                                {isIOS ? (
                                    <IOSPicker
                                        style={styles.hourPicker}
                                        selectedValue={((startTime.getHours() + 11) % 12 + 1).toString()}
                                        onValueChange={(val) => handleHourChange(val, true)}
                                        itemStyle={styles.pickerItemIOS}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <IOSPicker.Item key={i} label={(i + 1).toString()} value={(i + 1).toString()} />
                                        ))}
                                    </IOSPicker>
                                ) : (
                                    <AndroidPicker
                                        style={styles.hourPicker}
                                        selectedValue={((startTime.getHours() + 11) % 12 + 1).toString()}
                                        pickerData={Array.from({ length: 12 }, (_, i) => (i + 1).toString())}
                                        onValueChange={(val: any) => handleHourChange(val, true)}
                                    />
                                )}
                                <Typography style={styles.colonText}>:</Typography>
                                {isIOS ? (
                                    <IOSPicker
                                        style={styles.minutePicker}
                                        selectedValue={startTime.getMinutes().toString().padStart(2, '0')}
                                        onValueChange={(val) => handleMinuteChange(val, true)}
                                        itemStyle={styles.pickerItemIOS}
                                    >
                                        {Array.from({ length: 60 }, (_, i) => (
                                            <IOSPicker.Item key={i} label={i.toString().padStart(2, '0')} value={i.toString().padStart(2, '0')} />
                                        ))}
                                    </IOSPicker>
                                ) : (
                                    <AndroidPicker
                                        style={styles.minutePicker}
                                        selectedValue={startTime.getMinutes().toString().padStart(2, '0')}
                                        pickerData={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
                                        onValueChange={(val: any) => handleMinuteChange(val, true)}
                                    />
                                )}
                            </View>
                        </View>

                        <View style={styles.timeCard}>
                            <Typography variant="caption" color={Colors.textSecondary} style={styles.timeLabel}>종료 시간</Typography>
                            <View style={styles.pickerContainer}>
                                {isIOS ? (
                                    <IOSPicker
                                        style={styles.ampmPicker}
                                        selectedValue={endTime.getHours() >= 12 ? '오후' : '오전'}
                                        onValueChange={(val) => handleAmPmChange(val, false)}
                                        itemStyle={styles.pickerItemIOS}
                                    >
                                        <IOSPicker.Item label="오전" value="오전" />
                                        <IOSPicker.Item label="오후" value="오후" />
                                    </IOSPicker>
                                ) : (
                                    <AndroidPicker
                                        style={styles.ampmPicker}
                                        selectedValue={endTime.getHours() >= 12 ? '오후' : '오전'}
                                        pickerData={['오전', '오후']}
                                        onValueChange={(val: any) => handleAmPmChange(val, false)}
                                    />
                                )}
                                <Typography style={styles.colonText}>:</Typography>
                                {isIOS ? (
                                    <IOSPicker
                                        style={styles.hourPicker}
                                        selectedValue={((endTime.getHours() + 11) % 12 + 1).toString()}
                                        onValueChange={(val) => handleHourChange(val, false)}
                                        itemStyle={styles.pickerItemIOS}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <IOSPicker.Item key={i} label={(i + 1).toString()} value={(i + 1).toString()} />
                                        ))}
                                    </IOSPicker>
                                ) : (
                                    <AndroidPicker
                                        style={styles.hourPicker}
                                        selectedValue={((endTime.getHours() + 11) % 12 + 1).toString()}
                                        pickerData={Array.from({ length: 12 }, (_, i) => (i + 1).toString())}
                                        onValueChange={(val: any) => handleHourChange(val, false)}
                                    />
                                )}
                                <Typography style={styles.colonText}>:</Typography>
                                {isIOS ? (
                                    <IOSPicker
                                        style={styles.minutePicker}
                                        selectedValue={endTime.getMinutes().toString().padStart(2, '0')}
                                        onValueChange={(val) => handleMinuteChange(val, false)}
                                        itemStyle={styles.pickerItemIOS}
                                    >
                                        {Array.from({ length: 60 }, (_, i) => (
                                            <IOSPicker.Item key={i} label={i.toString().padStart(2, '0')} value={i.toString().padStart(2, '0')} />
                                        ))}
                                    </IOSPicker>
                                ) : (
                                    <AndroidPicker
                                        style={styles.minutePicker}
                                        selectedValue={endTime.getMinutes().toString().padStart(2, '0')}
                                        pickerData={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
                                        onValueChange={(val: any) => handleMinuteChange(val, false)}
                                    />
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {Platform.OS === 'android' && (
                    <View style={styles.section}>
                        <Typography variant="h2" bold style={styles.sectionTitle}>잠금 설정</Typography>
                        <View style={styles.lockTypeRow}>
                            <TouchableOpacity
                                style={[styles.lockTypeButton, lockType === 'phone' && styles.lockTypeButtonActive]}
                                onPress={() => setLockType('phone')}
                            >
                                <Icon name="phone-portrait-outline" size={24} color={lockType === 'phone' ? Colors.primary : Colors.textSecondary} />
                                <Typography bold color={lockType === 'phone' ? Colors.primary : Colors.textSecondary}>핸드폰 잠금</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.lockTypeButton, lockType === 'app' && styles.lockTypeButtonActive]}
                                onPress={() => setLockType('app')}
                            >
                                <Icon name="apps-outline" size={24} color={lockType === 'app' ? Colors.primary : Colors.textSecondary} />
                                <Typography bold color={lockType === 'app' ? Colors.primary : Colors.textSecondary}>앱 잠금</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>반복 요일</Typography>
                    <View style={styles.daysRow}>
                        {days.map(day => (
                            <TouchableOpacity
                                key={day}
                                style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonActive]}
                                onPress={() => toggleDay(day)}
                            >
                                <Typography color={selectedDays.includes(day) ? Colors.text : Colors.textSecondary}>{day}</Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>잠금 앱</Typography>
                    <TouchableOpacity style={styles.appSelector} onPress={handleAppSelect}>
                        <View style={styles.appSelectorLeft}>
                            <Icon name="apps-outline" size={24} color={Colors.primary} />
                            <Typography style={styles.appSelectorText}>
                                {lockedApps.length > 0 ? `${lockedApps.length}개의 앱 선택됨` : "잠글 앱 선택하기"}
                            </Typography>
                        </View>
                        <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {editingId && (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: Colors.card, marginTop: 30 }]}
                        onPress={handleGenerateQR}
                    >
                        <Icon name="qr-code-outline" size={20} color={Colors.primary} />
                        <Typography bold color={Colors.primary}>QR 코드 생성하기</Typography>
                    </TouchableOpacity>
                )}

                {editingId && (
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                        <Typography color="#FF3B30" bold>일정 삭제하기</Typography>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* App Selection Modal */}
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
                                <View style={[styles.checkbox, lockedApps.includes(item.packageName) && styles.checkboxActive]}>
                                    {lockedApps.includes(item.packageName) && <Icon name="checkmark" size={16} color="#FFF" />}
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

            {/* QR Code Modal */}
            <Modal visible={isQRModalVisible} animationType="fade" transparent>
                <View style={styles.qrModalOverlay}>
                    <View style={styles.qrModalContent}>
                        <View style={styles.qrModalHeader}>
                            <Typography variant="h2" bold>예약 QR 코드</Typography>
                            <TouchableOpacity onPress={() => setIsQRModalVisible(false)}>
                                <Icon name="close" size={24} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.qrCardContainer}>
                            <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                                <QRCard
                                    title={name}
                                    subtitle={qrSubtitle}
                                    value={qrValue || 'pending'}
                                />
                            </ViewShot>
                        </View>

                        <View style={styles.qrModalActions}>
                            <TouchableOpacity style={styles.qrModalButton} onPress={handleDownload}>
                                <Icon name="download-outline" size={20} color={Colors.text} />
                                <Typography bold>다운로드</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.qrModalButton, { backgroundColor: Colors.primary }]} onPress={handleShare}>
                                <Icon name="share-outline" size={20} color="#FFF" />
                                <Typography bold color="#FFF">공유하기</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 56 },
    headerButton: { padding: 5 },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    section: { marginTop: 30 },
    sectionTitle: { marginBottom: 15, fontSize: 18 },
    input: { backgroundColor: Colors.card, borderRadius: 12, padding: 18, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
    timeRow: { flexDirection: 'column', gap: 15 },
    timeCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border },
    timeLabel: { marginBottom: 8 },
    pickerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 12, height: isIOS ? 180 : 120 },
    ampmPicker: { width: isIOS ? 100 : 70, height: isIOS ? 180 : 120 },
    hourPicker: { width: isIOS ? 100 : 50, height: isIOS ? 180 : 120 },
    minutePicker: { width: isIOS ? 100 : 50, height: isIOS ? 180 : 120 },
    pickerItemIOS: { fontSize: 22, height: 180, color: '#FFFFFF' },
    colonText: { fontSize: 24, fontWeight: 'bold', marginHorizontal: 5, color: '#FFF' },
    lockTypeRow: { flexDirection: 'row', gap: 15 },
    lockTypeButton: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, gap: 8 },
    lockTypeButtonActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    dayButtonActive: { backgroundColor: Colors.primary + '30', borderColor: Colors.primary },
    appSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: Colors.border },
    appSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    appSelectorText: { fontSize: 16 },
    actionButton: { flexDirection: 'row', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.border },
    deleteButton: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: '#FF3B3015', borderRadius: 12 },
    modalContainer: { flex: 1, backgroundColor: Colors.background },
    appItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: Colors.primary },
    appLabel: { fontSize: 16 },
    modalConfirmButton: { backgroundColor: Colors.primary, margin: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    qrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    qrModalContent: { backgroundColor: Colors.background, borderRadius: 24, width: '100%', maxWidth: 400, padding: 20 },
    qrModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    qrCardContainer: { alignItems: 'center', marginBottom: 20 },
    qrModalActions: { flexDirection: 'row', gap: 12 },
    qrModalButton: { flex: 1, flexDirection: 'row', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }
});
