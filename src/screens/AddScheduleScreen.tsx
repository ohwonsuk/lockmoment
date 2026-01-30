import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Switch, Alert, Platform } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePicker, Picker } from 'react-native-wheel-pick';
import { StorageService, Schedule } from '../services/StorageService';
import { NativeLockControl } from '../services/NativeLockControl';

export const AddScheduleScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('예약 잠금');
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 3600000));
    const [selectedDays, setSelectedDays] = useState<string[]>(['월', '화', '수', '목', '금']);
    const [strictMode, setStrictMode] = useState(true);
    const [lockType, setLockType] = useState('app');
    const [allowedApp, setAllowedApp] = useState<{ label: string, packageName: string } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        const id = (globalThis as any).editingScheduleId;
        if (id) {
            setEditingId(id);
            loadSchedule(id);
        }

        const selected = (globalThis as any).selectedApp;
        if (selected) {
            setAllowedApp(selected);
            (globalThis as any).selectedApp = null;
        }

        if (Platform.OS === 'ios') {
            NativeLockControl.getSelectedAppCount().then(count => {
                if (count > 0) {
                    setAllowedApp({ label: `${count}개 앱 선택됨`, packageName: 'ios.family.selection' });
                }
            });
        }
    }, []);

    const loadSchedule = async (id: string) => {
        const schedules = await StorageService.getSchedules();
        const schedule = schedules.find(s => s.id === id);
        if (schedule) {
            setName(schedule.name);
            setSelectedDays(schedule.days);
            setLockType(schedule.lockType || 'app');
            setAllowedApp(schedule.allowedApp || null);

            const [sH, sM] = schedule.startTime.split(':');
            const [eH, eM] = schedule.endTime.split(':');

            const sDate = new Date();
            sDate.setHours(parseInt(sH), parseInt(sM));
            setStartTime(sDate);

            const eDate = new Date();
            eDate.setHours(parseInt(eH), parseInt(eM));
            setEndTime(eDate);
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

        // Reverting to threshold-based rollover which was reportedly working better
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
        if (Platform.OS === 'ios') {
            try {
                const result = await NativeLockControl.presentFamilyActivityPicker();
                if (typeof result === 'number') {
                    if (result > 0) {
                        setAllowedApp({ label: `${result}개 앱 선택됨`, packageName: 'ios.family.selection' });
                    } else {
                        setAllowedApp(null);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            navigate('AppSelect');
        }
    };

    const handleSave = async () => {
        const newSchedule: Schedule = {
            id: editingId || Date.now().toString(),
            name,
            startTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
            days: selectedDays,
            lockType,
            allowedApp: allowedApp || undefined,
            isActive: true,
        };

        await StorageService.saveSchedule(newSchedule);

        try {
            const preventRemoval = await StorageService.getPreventAppRemoval();
            await NativeLockControl.scheduleAlarm(
                newSchedule.id,
                newSchedule.startTime,
                newSchedule.endTime,
                newSchedule.days,
                newSchedule.lockType,
                newSchedule.name,
                newSchedule.allowedApp?.packageName,
                preventRemoval
            );
        } catch (error) {
            console.error('Failed to schedule alarm:', error);
        }

        Alert.alert("저장 완료", editingId ? "예약이 수정되었습니다." : "예약 잠금이 저장되었습니다.");
        navigate('Dashboard');
    };

    const handleDelete = async () => {
        if (!editingId) return;

        Alert.alert(
            "삭제 확인",
            "이 예약을 삭제하시겠습니까?",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "삭제",
                    style: "destructive",
                    onPress: async () => {
                        await NativeLockControl.cancelAlarm(editingId);
                        await StorageService.deleteSchedule(editingId);
                        navigate('Dashboard');
                    }
                }
            ]
        );
    };

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
                        {/* Start Time */}
                        <View style={styles.timeCard}>
                            <Typography variant="caption" color={Colors.textSecondary} style={styles.timeLabel}>시작 시간</Typography>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    style={[styles.ampmPicker, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A' }]}
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    textSize={Platform.OS === 'ios' ? 24 : 15}
                                    itemStyle={{ height: 50, backgroundColor: 'transparent', color: '#FFFFFF' }}
                                    backgroundColor={Platform.OS === 'ios' ? 'transparent' : '#0F172A'}
                                    selectedValue={startTime.getHours() >= 12 ? '오후' : '오전'}
                                    pickerData={['오전', '오후']}
                                    onValueChange={(val: any) => handleAmPmChange(val, true)}
                                />
                                <Picker
                                    style={[styles.hourPicker, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A' }]}
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    textSize={Platform.OS === 'ios' ? 24 : 18}
                                    itemStyle={{ height: 50, backgroundColor: 'transparent', color: '#FFFFFF' }}
                                    backgroundColor={Platform.OS === 'ios' ? 'transparent' : '#0F172A'}
                                    isCyclic={true}
                                    selectedValue={((startTime.getHours() + 11) % 12 + 1).toString()}
                                    pickerData={Array.from({ length: 12 }, (_, i) => (i + 1).toString())}
                                    onValueChange={(val: any) => handleHourChange(val, true)}
                                />
                                <Typography style={styles.colonText}>:</Typography>
                                <Picker
                                    style={[styles.minutePicker, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A' }]}
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    textSize={Platform.OS === 'ios' ? 24 : 18}
                                    itemStyle={{ height: 50, backgroundColor: 'transparent', color: '#FFFFFF' }}
                                    backgroundColor={Platform.OS === 'ios' ? 'transparent' : '#0F172A'}
                                    isCyclic={true}
                                    selectedValue={startTime.getMinutes().toString().padStart(2, '0')}
                                    pickerData={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
                                    onValueChange={(val: any) => handleMinuteChange(val, true)}
                                />
                            </View>
                        </View>

                        {/* End Time */}
                        <View style={styles.timeCard}>
                            <Typography variant="caption" color={Colors.textSecondary} style={styles.timeLabel}>종료 시간</Typography>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    style={[styles.ampmPicker, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A' }]}
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    textSize={Platform.OS === 'ios' ? 20 : 15}
                                    itemStyle={{ height: 40, backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A', color: '#FFFFFF' }}
                                    backgroundColor={Platform.OS === 'ios' ? 'transparent' : '#0F172A'}
                                    selectedValue={endTime.getHours() >= 12 ? '오후' : '오전'}
                                    pickerData={['오전', '오후']}
                                    onValueChange={(val: any) => handleAmPmChange(val, false)}
                                />
                                <Picker
                                    style={[styles.hourPicker, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A' }]}
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    textSize={Platform.OS === 'ios' ? 20 : 18}
                                    itemStyle={{ height: 40, backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A', color: '#FFFFFF' }}
                                    backgroundColor={Platform.OS === 'ios' ? 'transparent' : '#0F172A'}
                                    isCyclic={true}
                                    selectedValue={((endTime.getHours() + 11) % 12 + 1).toString()}
                                    pickerData={Array.from({ length: 12 }, (_, i) => (i + 1).toString())}
                                    onValueChange={(val: any) => handleHourChange(val, false)}
                                />
                                <Typography style={styles.colonText}>:</Typography>
                                <Picker
                                    style={[styles.minutePicker, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A' }]}
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    textSize={Platform.OS === 'ios' ? 20 : 18}
                                    itemStyle={{ height: 40, backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A', color: '#FFFFFF' }}
                                    backgroundColor={Platform.OS === 'ios' ? 'transparent' : '#0F172A'}
                                    isCyclic={true}
                                    selectedValue={endTime.getMinutes().toString().padStart(2, '0')}
                                    pickerData={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
                                    onValueChange={(val: any) => handleMinuteChange(val, false)}
                                />
                            </View>
                        </View>
                    </View>
                </View>

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
                    <Typography variant="h2" bold style={styles.sectionTitle}>허용할 앱</Typography>
                    <TouchableOpacity style={styles.appSelector} onPress={handleAppSelect}>
                        <View style={styles.appSelectorLeft}>
                            <Icon name="apps-outline" size={24} color={Colors.primary} />
                            <Typography style={styles.appSelectorText}>{allowedApp ? allowedApp.label : "선택된 앱 없음"}</Typography>
                        </View>
                        <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {editingId && (
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                        <Typography color="#FF3B30" bold>일정 삭제하기</Typography>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 56,
    },
    headerButton: {
        padding: 5,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    section: {
        marginTop: 30,
    },
    sectionTitle: {
        marginBottom: 15,
        fontSize: 18,
    },
    input: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 18,
        color: Colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    timeRow: {
        flexDirection: 'column',
        gap: 15,
    },
    timeCard: {
        flex: 1,
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    timeLabel: {
        marginBottom: 8,
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 12,
        paddingHorizontal: 20,
        height: Platform.OS === 'ios' ? 180 : 120, // Increased height for iOS
        // overflow: 'hidden', // Removed to allow wheel visibility
    },
    ampmPicker: {
        width: Platform.OS === 'ios' ? 80 : 42,
        height: Platform.OS === 'ios' ? 180 : 120,
    },
    hourPicker: {
        width: Platform.OS === 'ios' ? 90 : 35,
        height: Platform.OS === 'ios' ? 180 : 120,
    },
    minutePicker: {
        width: Platform.OS === 'ios' ? 90 : 45,
        height: Platform.OS === 'ios' ? 180 : 120,
    },
    colonText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginHorizontal: 10,
        textAlignVertical: 'center',
        paddingBottom: Platform.OS === 'ios' ? 5 : 0,
        marginTop: Platform.OS === 'ios' ? 15 : 0, // Push down on iOS to align with wheels
        opacity: 0.9,
    },
    lockTypeRow: {
        flexDirection: 'row',
        gap: 15,
    },
    lockTypeButton: {
        flex: 1,
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 8,
    },
    lockTypeButtonActive: {
        backgroundColor: Colors.primary + '15',
        borderColor: Colors.primary,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    dayButtonActive: {
        backgroundColor: Colors.primary + '30',
        borderColor: Colors.primary,
    },
    appSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 18,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    appSelectorLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    appSelectorText: {
        fontSize: 16,
    },
    deleteButton: {
        marginTop: 50,
        padding: 15,
        alignItems: 'center',
        backgroundColor: '#FF3B3015',
        borderRadius: 12,
    }
});
