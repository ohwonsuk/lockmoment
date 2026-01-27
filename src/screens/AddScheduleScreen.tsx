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

    const [name, setName] = useState('공부 집중 시간');
    const [startTime, setStartTime] = useState(new Date(new Date().setHours(9, 0, 0, 0)));
    const [endTime, setEndTime] = useState(new Date(new Date().setHours(12, 0, 0, 0)));
    const [strictMode, setStrictMode] = useState(true);
    const [selectedDays, setSelectedDays] = useState<string[]>(['월', '화', '수', '목', '금']);
    const [allowedApp, setAllowedApp] = useState<{ label: string, packageName: string } | null>(null);

    useEffect(() => {
        // Check for selected app from AppSelectScreen (Android)
        const checkSelectedApp = setInterval(() => {
            if ((globalThis as any).selectedApp) {
                setAllowedApp((globalThis as any).selectedApp);
                (globalThis as any).selectedApp = undefined;
            }
        }, 500);
        return () => clearInterval(checkSelectedApp);
    }, []);

    const days = ['월', '화', '수', '목', '금', '토', '일'];

    const toggleDay = (day: string) => {
        if (selectedDays.includes(day)) {
            setSelectedDays(selectedDays.filter(d => d !== day));
        } else {
            setSelectedDays([...selectedDays, day]);
        }
    };

    const handleAppSelect = async () => {
        if (Platform.OS === 'ios') {
            try {
                const success = await NativeLockControl.presentFamilyActivityPicker();
                if (success) {
                    setAllowedApp({ label: '선택된 앱', packageName: 'ios.family.selection' });
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
            id: Date.now().toString(),
            name,
            startTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`,
            days: selectedDays,
            strictMode,
            allowedApp: allowedApp || undefined,
            isActive: true,
        };

        await StorageService.saveSchedule(newSchedule);
        Alert.alert("저장 완료", "예약 잠금이 저장되었습니다.");
        navigate('Dashboard');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigate('Dashboard')} style={styles.headerButton}>
                    <Icon name="close" size={28} />
                </TouchableOpacity>
                <Typography variant="h2" bold>예약 추가</Typography>
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
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    style={styles.individualPicker}
                                    textColor={Colors.text}
                                    textSize={18}
                                    itemStyle={{ height: 40 }}
                                    selectedValue={startTime.getHours().toString().padStart(2, '0')}
                                    pickerData={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                    onValueChange={(val: any) => {
                                        const newDate = new Date(startTime);
                                        newDate.setHours(parseInt(val));
                                        setStartTime(newDate);
                                    }}
                                />
                                <Typography variant="h2" bold style={styles.colonText}>:</Typography>
                                <Picker
                                    style={styles.individualPicker}
                                    textColor={Colors.text}
                                    textSize={18}
                                    itemStyle={{ height: 40 }}
                                    selectedValue={startTime.getMinutes().toString().padStart(2, '0')}
                                    pickerData={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
                                    onValueChange={(val: any) => {
                                        const newDate = new Date(startTime);
                                        newDate.setMinutes(parseInt(val));
                                        setStartTime(newDate);
                                    }}
                                />
                            </View>
                        </View>
                        <View style={styles.timeCard}>
                            <Typography variant="caption" color={Colors.textSecondary} style={styles.timeLabel}>종료 시간</Typography>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    style={styles.individualPicker}
                                    textColor={Colors.text}
                                    textSize={18}
                                    itemStyle={{ height: 40 }}
                                    selectedValue={endTime.getHours().toString().padStart(2, '0')}
                                    pickerData={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                    onValueChange={(val: any) => {
                                        const newDate = new Date(endTime);
                                        newDate.setHours(parseInt(val));
                                        setEndTime(newDate);
                                    }}
                                />
                                <Typography variant="h2" bold style={styles.colonText}>:</Typography>
                                <Picker
                                    style={styles.individualPicker}
                                    textColor={Colors.text}
                                    textSize={18}
                                    itemStyle={{ height: 40 }}
                                    selectedValue={endTime.getMinutes().toString().padStart(2, '0')}
                                    pickerData={Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))}
                                    onValueChange={(val: any) => {
                                        const newDate = new Date(endTime);
                                        newDate.setMinutes(parseInt(val));
                                        setEndTime(newDate);
                                    }}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>요일 선택</Typography>
                    <View style={styles.dayRow}>
                        {days.map(day => (
                            <TouchableOpacity
                                key={day}
                                style={[styles.dayButton, selectedDays.includes(day) && styles.dayButtonActive]}
                                onPress={() => toggleDay(day)}
                            >
                                <Typography
                                    variant="caption"
                                    bold
                                    color={selectedDays.includes(day) ? Colors.text : Colors.textSecondary}
                                >
                                    {day}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>상세 옵션</Typography>
                    <View style={styles.optionCard}>
                        <View style={styles.optionInfo}>
                            <Typography bold>엄격 모드</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>
                                일정 진행 중에는 설정을 변경할 수 없습니다.
                            </Typography>
                        </View>
                        <Switch
                            value={strictMode}
                            onValueChange={setStrictMode}
                            trackColor={{ false: Colors.statusInactive, true: Colors.primary }}
                            thumbColor={Colors.text}
                        />
                    </View>

                    <TouchableOpacity style={styles.optionCard} onPress={handleAppSelect}>
                        <View style={styles.optionInfo}>
                            <Typography bold>허용할 앱 선택 (최대 1개)</Typography>
                            <Typography variant="caption" color={Platform.OS === 'ios' ? Colors.primary : Colors.textSecondary}>
                                {allowedApp ? allowedApp.label : (Platform.OS === 'ios' ? 'iOS 앱 선택기 열기' : '사용 가능한 앱 1개를 선택하세요')}
                            </Typography>
                        </View>
                        <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Typography variant="h2" bold>저장하기</Typography>
                </TouchableOpacity>
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
        flexDirection: 'row',
        gap: 15,
    },
    timeCard: {
        flex: 1,
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeLabel: {
        marginBottom: 5,
        textAlign: 'center',
    },
    pickerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    individualPicker: {
        height: 120,
        width: 60,
        backgroundColor: 'transparent',
    },
    colonText: {
        fontSize: 20,
        fontWeight: 'bold',
        marginHorizontal: 2,
        marginTop: -2,
    },
    dayRow: {
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
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    optionCard: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    optionInfo: {
        flex: 1,
        gap: 4,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginTop: 20,
    },
});
