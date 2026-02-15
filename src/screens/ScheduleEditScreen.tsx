import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, FlatList, ActivityIndicator, Image } from 'react-native';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation, useAppRoute } from '../navigation/NavigationContext';
import { ParentChildService } from '../services/ParentChildService';
import { MetaDataService } from '../services/MetaDataService';
import { NativeLockControl } from '../services/NativeLockControl';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_LABELS: Record<string, string> = { '월': '월', '화': '화', '수': '수', '목': '목', '금': '금', '토': '토', '일': '일' };
const EN_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const EN_TO_KO: Record<string, string> = { 'MON': '월', 'TUE': '화', 'WED': '수', 'THU': '목', 'FRI': '금', 'SAT': '토', 'SUN': '일' };

export const ScheduleEditScreen: React.FC = () => {
    const { navigate, goBack } = useAppNavigation();
    const route = useAppRoute();
    const { childId, scheduleId, mode, scheduleData } = route.params as any;

    const [name, setName] = useState(scheduleData?.name || '');

    // Normalize incoming time data (HH:mm:ss or HH:mm)
    const initStartTime = scheduleData?.startTime || '22:00';
    const initEndTime = scheduleData?.endTime || '07:00';

    // Create Date objects for the picker
    const getInitDate = (timeStr: string) => {
        const [h, m] = timeStr.split(':');
        const d = new Date();
        d.setHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
        return d;
    };

    const [startDate, setStartDate] = useState(getInitDate(initStartTime));
    const [endDate, setEndDate] = useState(getInitDate(initEndTime));

    // Support both English and Korean day labels from server
    const initDays = (scheduleData?.days || []).map((d: string) => EN_TO_KO[d] || d);
    const [selectedDays, setSelectedDays] = useState<string[]>(initDays);

    // Normalize APP_ONLY to APP for UI
    const initLockType = (scheduleData?.lockType === 'APP_ONLY' || scheduleData?.lockType === 'APP') ? 'APP' : 'FULL';
    const [lockType, setLockType] = useState<'FULL' | 'APP'>(initLockType as any);
    const [isActive, setIsActive] = useState(scheduleData?.isActive ?? true);

    // Categories & Apps
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(scheduleData?.blockedCategories || []);
    const [selectedApps, setSelectedApps] = useState<string[]>(scheduleData?.blockedApps || []);

    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');

    // App Selection Modal
    const [showAppModal, setShowAppModal] = useState(false);
    const [installedApps, setInstalledApps] = useState<any[]>([]);
    const [loadingApps, setLoadingApps] = useState(false);
    const [appSearch, setAppSearch] = useState('');

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const cats = await MetaDataService.getAppCategories();
            setCategories(cats.map((c: any) => ({ id: c.id, name: c.display_name || c.name })));
        } catch (e) {
            console.error(e);
        }
    };

    const loadInstalledApps = async () => {
        if (installedApps.length > 0) return;
        setLoadingApps(true);
        try {
            const apps = await NativeLockControl.getInstalledApps();
            apps.sort((a, b) => a.label.localeCompare(b.label));
            setInstalledApps(apps);
        } catch (e) {
            console.error(e);
            Alert.alert("오류", "앱 목록을 불러오는데 실패했습니다.");
        } finally {
            setLoadingApps(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("알림", "스케줄 이름을 입력해주세요.");
            return;
        }
        if (selectedDays.length === 0) {
            Alert.alert("알림", "요일을 하나 이상 선택해주세요.");
            return;
        }

        setSaving(true);
        try {
            const sTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}:00`;
            const eTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}:00`;

            const payload = {
                name,
                startTime: sTime,
                endTime: eTime,
                days: selectedDays,
                lockType,
                blockedCategories: lockType === 'APP' ? selectedCategories : [],
                blockedApps: lockType === 'APP' ? selectedApps : [],
                isActive
            };

            let result;
            if (mode === 'CREATE') {
                result = await ParentChildService.createChildSchedule(childId, payload);
            } else {
                result = await ParentChildService.updateChildSchedule(childId, scheduleId, payload);
            }

            if (result.success) {
                Alert.alert("성공", mode === 'CREATE' ? "스케줄이 생성되었습니다." : "스케줄이 수정되었습니다.", [
                    { text: "확인", onPress: () => goBack() }
                ]);
            } else {
                Alert.alert("오류", result.message || "저장에 실패했습니다.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("오류", "네트워크 오류가 발생했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (day: string) => {
        if (selectedDays.includes(day)) {
            setSelectedDays(selectedDays.filter(d => d !== day));
        } else {
            setSelectedDays([...selectedDays, day]);
        }
    };

    const toggleCategory = (catId: string) => {
        if (selectedCategories.includes(catId)) {
            setSelectedCategories(selectedCategories.filter(c => c !== catId));
        } else {
            setSelectedCategories([...selectedCategories, catId]);
        }
    };

    const toggleApp = (pkg: string) => {
        if (selectedApps.includes(pkg)) {
            setSelectedApps(selectedApps.filter(p => p !== pkg));
        } else {
            setSelectedApps([...selectedApps, pkg]);
        }
    };

    // Filter apps for modal
    const filteredApps = installedApps.filter(app =>
        app.label.toLowerCase().includes(appSearch.toLowerCase())
    );

    const handleAmPmChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartDate : setEndDate;
        const current = isStart ? startDate : endDate;
        const newIsPM = val === '오후';
        const currentIsPM = current.getHours() >= 12;
        if (newIsPM !== currentIsPM) {
            const newDate = new Date(current);
            const h = newDate.getHours();
            newDate.setHours(newIsPM ? h + 12 : h - 12);
            setTime(newDate);
        }
    };

    const handleHourChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartDate : setEndDate;
        const current = isStart ? startDate : endDate;
        const isPM = current.getHours() >= 12;
        let h = parseInt(val);
        if (h === 12) h = 0;
        const newDate = new Date(current);
        newDate.setHours(isPM ? h + 12 : h);
        setTime(newDate);
    };

    const handleMinuteChange = (val: string, isStart: boolean) => {
        const setTime = isStart ? setStartDate : setEndDate;
        const current = isStart ? startDate : endDate;
        const newMin = parseInt(val);
        const newDate = new Date(current);
        newDate.setMinutes(newMin);
        setTime(newDate);
    };

    return (
        <View style={styles.container}>
            <Header title={mode === 'CREATE' ? "스케줄 추가" : "스케줄 수정"} />

            <ScrollView contentContainerStyle={styles.content}>

                {/* Name */}
                <View style={styles.section}>
                    <Typography variant="h2" bold style={{ marginBottom: 12 }}>스케줄 이름</Typography>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="예: 취침 시간, 학원 시간"
                        placeholderTextColor={Colors.textSecondary}
                    />
                </View>

                {/* Time */}
                <View style={styles.section}>
                    <Typography variant="h2" bold style={{ marginBottom: 12 }}>시간 설정</Typography>
                    <View style={styles.timeRow}>
                        <View style={styles.timeInputContainer}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 4 }}>시작 시간</Typography>
                            <TouchableOpacity style={styles.timePickerButton} onPress={() => { setPickerTarget('start'); setIsTimePickerVisible(true); }}>
                                <Typography variant="h2" bold>{startDate.getHours() >= 12 ? '오후' : '오전'} {(startDate.getHours() % 12 || 12)}:{startDate.getMinutes().toString().padStart(2, '0')}</Typography>
                            </TouchableOpacity>
                        </View>
                        <Typography bold style={{ marginHorizontal: 10, marginTop: 40 }}>~</Typography>
                        <View style={styles.timeInputContainer}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 4 }}>종료 시간</Typography>
                            <TouchableOpacity style={styles.timePickerButton} onPress={() => { setPickerTarget('end'); setIsTimePickerVisible(true); }}>
                                <Typography variant="h2" bold>{endDate.getHours() >= 12 ? '오후' : '오전'} {(endDate.getHours() % 12 || 12)}:{endDate.getMinutes().toString().padStart(2, '0')}</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Days */}
                <View style={styles.section}>
                    <Typography variant="h2" bold style={{ marginBottom: 12 }}>반복 요일</Typography>
                    <View style={styles.daysContainer}>
                        {DAYS.map(day => (
                            <TouchableOpacity
                                key={day}
                                style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonActive]}
                                onPress={() => toggleDay(day)}
                            >
                                <Typography
                                    style={[styles.dayText, selectedDays.includes(day) && styles.dayTextActive]}
                                >
                                    {DAY_LABELS[day]}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Lock Type */}
                <View style={styles.section}>
                    <Typography variant="h2" bold style={{ marginBottom: 12 }}>잠금 방식</Typography>
                    <View style={styles.typeContainer}>
                        <TouchableOpacity
                            style={[styles.typeButton, lockType === 'FULL' && styles.typeButtonActive]}
                            onPress={() => setLockType('FULL')}
                        >
                            <Icon name="phone-portrait" size={24} color={lockType === 'FULL' ? Colors.primary : Colors.textSecondary} />
                            <Typography bold color={lockType === 'FULL' ? Colors.primary : Colors.textSecondary} style={{ marginTop: 8 }}>전체 잠금</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeButton, lockType === 'APP' && styles.typeButtonActive]}
                            onPress={() => setLockType('APP')}
                        >
                            <Icon name="apps" size={24} color={lockType === 'APP' ? Colors.primary : Colors.textSecondary} />
                            <Typography bold color={lockType === 'APP' ? Colors.primary : Colors.textSecondary} style={{ marginTop: 8 }}>앱/카테고리 잠금</Typography>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* App/Category Selection */}
                {lockType === 'APP' && (
                    <View style={styles.section}>
                        <Typography variant="h2" bold style={{ marginBottom: 12 }}>카테고리 선택</Typography>
                        <View style={styles.categoriesContainer}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.categoryChip, selectedCategories.includes(cat.id) && styles.categoryChipActive]}
                                    onPress={() => toggleCategory(cat.id)}
                                >
                                    <Typography
                                        color={selectedCategories.includes(cat.id) ? 'white' : Colors.textSecondary}
                                        style={{ fontSize: 13 }}
                                    >
                                        {cat.name}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 12 }}>
                            <Typography variant="h2" bold>선택된 앱 ({selectedApps.length})</Typography>
                            <TouchableOpacity onPress={() => { loadInstalledApps(); setShowAppModal(true); }}>
                                <Typography color={Colors.primary} bold>앱 추가</Typography>
                            </TouchableOpacity>
                        </View>

                        {selectedApps.length > 0 ? (
                            <View style={styles.selectedAppsList}>
                                {selectedApps.map(pkg => (
                                    <View key={pkg} style={styles.appChip}>
                                        <Typography variant="caption" style={{ flex: 1 }} numberOfLines={1}>{pkg}</Typography>
                                        <TouchableOpacity onPress={() => toggleApp(pkg)}>
                                            <Icon name="close-circle" size={16} color={Colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Typography color={Colors.textSecondary} variant="caption">선택된 앱이 없습니다.</Typography>
                        )}
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="white" /> : <Typography bold color="white">저장하기</Typography>}
                </TouchableOpacity>

            </ScrollView>

            {/* Time Picker Modal */}
            <Modal visible={isTimePickerVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBottomContent}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h2" bold>{pickerTarget === 'start' ? '시작' : '종료'} 시간 설정</Typography>
                            <TouchableOpacity onPress={() => setIsTimePickerVisible(false)}>
                                <Icon name="close" size={24} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.timePickerControls}>
                            {/* AM/PM */}
                            <TouchableOpacity
                                style={styles.timeValueBtn}
                                onPress={() => handleAmPmChange((pickerTarget === 'start' ? startDate : endDate).getHours() < 12 ? '오후' : '오전', pickerTarget === 'start')}
                            >
                                <Typography variant="h2" bold>{(pickerTarget === 'start' ? startDate : endDate).getHours() < 12 ? '오전' : '오후'}</Typography>
                            </TouchableOpacity>

                            <View style={styles.timePickerRow}>
                                <View style={styles.timeCol}>
                                    <TouchableOpacity onPress={() => {
                                        const cur = pickerTarget === 'start' ? startDate : endDate;
                                        let h = ((cur.getHours() + 11) % 12 + 1) + 1;
                                        if (h > 12) h = 1;
                                        handleHourChange(h.toString(), pickerTarget === 'start');
                                    }}>
                                        <Icon name="chevron-up" size={30} color={Colors.primary} />
                                    </TouchableOpacity>
                                    <View style={styles.timeDisplayBox}>
                                        <Typography variant="h1" bold>{(pickerTarget === 'start' ? startDate : endDate).getHours() % 12 || 12}시</Typography>
                                    </View>
                                    <TouchableOpacity onPress={() => {
                                        const cur = pickerTarget === 'start' ? startDate : endDate;
                                        let h = ((cur.getHours() + 11) % 12 + 1) - 1;
                                        if (h < 1) h = 12;
                                        handleHourChange(h.toString(), pickerTarget === 'start');
                                    }}>
                                        <Icon name="chevron-down" size={30} color={Colors.primary} />
                                    </TouchableOpacity>
                                </View>

                                <Typography variant="h1" bold style={{ marginTop: 20 }}>:</Typography>

                                <View style={styles.timeCol}>
                                    <TouchableOpacity onPress={() => {
                                        const cur = pickerTarget === 'start' ? startDate : endDate;
                                        let m = (Math.floor(cur.getMinutes() / 5) * 5) + 5;
                                        if (m >= 60) m = 0;
                                        handleMinuteChange(m.toString(), pickerTarget === 'start');
                                    }}>
                                        <Icon name="chevron-up" size={30} color={Colors.primary} />
                                    </TouchableOpacity>
                                    <View style={styles.timeDisplayBox}>
                                        <Typography variant="h1" bold>{(pickerTarget === 'start' ? startDate : endDate).getMinutes().toString().padStart(2, '0')}분</Typography>
                                    </View>
                                    <TouchableOpacity onPress={() => {
                                        const cur = pickerTarget === 'start' ? startDate : endDate;
                                        let m = (Math.ceil(cur.getMinutes() / 5) * 5) - 5;
                                        if (m < 0) m = 55;
                                        handleMinuteChange(m.toString(), pickerTarget === 'start');
                                    }}>
                                        <Icon name="chevron-down" size={30} color={Colors.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.modalConfirmButton} onPress={() => setIsTimePickerVisible(false)}>
                            <Typography bold color="white">완료</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* App Selection Modal */}
            <Modal visible={showAppModal} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Typography variant="h2" bold>앱 선택</Typography>
                        <TouchableOpacity onPress={() => setShowAppModal(false)}>
                            <Typography color={Colors.primary} bold>완료</Typography>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchBar}>
                        <Icon name="search" size={20} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.modalSearchInput}
                            placeholder="앱 검색"
                            value={appSearch}
                            onChangeText={setAppSearch}
                            placeholderTextColor={Colors.textSecondary}
                        />
                    </View>

                    {loadingApps ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredApps}
                            keyExtractor={item => item.packageName}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.modalAppItem} onPress={() => toggleApp(item.packageName)}>
                                    {item.icon ? (
                                        <Image source={{ uri: `data:image/png;base64,${item.icon}` }} style={styles.modalAppIcon} />
                                    ) : (
                                        <View style={[styles.modalAppIcon, { backgroundColor: Colors.border }]} />
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Typography bold>{item.label}</Typography>
                                        <Typography variant="caption" color={Colors.textSecondary}>{item.packageName}</Typography>
                                    </View>
                                    <View style={[styles.checkbox, selectedApps.includes(item.packageName) && styles.checkboxActive]}>
                                        {selectedApps.includes(item.packageName) && <Icon name="checkmark" size={14} color="white" />}
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    )}
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
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    input: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 16,
        color: Colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeInputContainer: {
        flex: 1,
    },
    timePickerButton: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        height: 60,
    },
    daysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    dayButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    dayText: {
        color: Colors.textSecondary,
        fontSize: 12,
    },
    dayTextActive: {
        color: 'white',
        fontWeight: 'bold',
    },
    typeContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    typeButton: {
        flex: 1,
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    typeButtonActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '10',
    },
    categoriesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    categoryChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    selectedAppsList: {
        gap: 8,
    },
    appChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 40,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalBottomContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingBottom: 40,
    },
    timePickerControls: {
        padding: 30,
        alignItems: 'center',
        gap: 20,
    },
    timePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    timeCol: {
        alignItems: 'center',
        gap: 5,
    },
    timeDisplayBox: {
        backgroundColor: Colors.card,
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: Colors.border,
        minWidth: 100,
        alignItems: 'center',
    },
    modalConfirmButton: {
        marginHorizontal: 20,
        backgroundColor: Colors.primary,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    timeValueBtn: {
        backgroundColor: Colors.card,
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        margin: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        height: 48,
    },
    modalSearchInput: {
        flex: 1,
        marginLeft: 8,
        color: Colors.text,
    },
    modalAppItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    modalAppIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
});
