import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { PresetService, Preset } from '../services/PresetService';
import { StorageService } from '../services/StorageService';
import { MetaDataService, AppCategory } from '../services/MetaDataService';

export const PersonalPresetScreen: React.FC = () => {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Editor State
    const [isEditorVisible, setIsEditorVisible] = useState(false);
    const [editingPreset, setEditingPreset] = useState<Partial<Preset> | null>(null);
    const [allCategories, setAllCategories] = useState<AppCategory[]>([]);

    // Time/Day Picker State
    const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');

    // Helper functions for time parsing
    const parseTime = (timeStr: string): Date => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours || 9);
        date.setMinutes(minutes || 0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    };

    const formatTime = (date: Date): string => {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const handleHourChange = (hour: string, isStart: boolean) => {
        if (!editingPreset) return;
        const currentTime = isStart ? parseTime(editingPreset.start_time || '09:00') : parseTime(editingPreset.end_time || '10:00');
        const newHour = parseInt(hour) || 0;
        currentTime.setHours(newHour);
        const formatted = formatTime(currentTime);
        setEditingPreset({
            ...editingPreset,
            [isStart ? 'start_time' : 'end_time']: formatted
        });
    };

    const handleMinuteChange = (minute: string, isStart: boolean) => {
        if (!editingPreset) return;
        const currentTime = isStart ? parseTime(editingPreset.start_time || '09:00') : parseTime(editingPreset.end_time || '10:00');
        const newMinute = parseInt(minute) || 0;
        currentTime.setMinutes(newMinute);
        const formatted = formatTime(currentTime);
        setEditingPreset({
            ...editingPreset,
            [isStart ? 'start_time' : 'end_time']: formatted
        });
    };

    const handleAmPmChange = (ampm: '오전' | '오후', isStart: boolean) => {
        if (!editingPreset) return;
        const currentTime = isStart ? parseTime(editingPreset.start_time || '09:00') : parseTime(editingPreset.end_time || '10:00');
        const currentHour = currentTime.getHours();
        let newHour = currentHour;

        if (ampm === '오전' && currentHour >= 12) {
            newHour = currentHour - 12;
        } else if (ampm === '오후' && currentHour < 12) {
            newHour = currentHour + 12;
        }

        currentTime.setHours(newHour);
        const formatted = formatTime(currentTime);
        setEditingPreset({
            ...editingPreset,
            [isStart ? 'start_time' : 'end_time']: formatted
        });
    };

    const toggleDay = (day: string) => {
        if (!editingPreset) return;
        const current = editingPreset.days || [];
        const updated = current.includes(day)
            ? current.filter(d => d !== day)
            : [...current, day];
        setEditingPreset({ ...editingPreset, days: updated });
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [personalPresets, categories] = await Promise.all([
                PresetService.getPersonalPresets(),
                MetaDataService.getAppCategories()
            ]);
            setPresets(personalPresets);
            setAllCategories(categories);

            // Sync with local storage
            await StorageService.savePersonalPresets(personalPresets);
        } catch (error) {
            console.error('[PersonalPreset] Load failed:', error);
            // Fallback to local storage
            const localPresets = await StorageService.getPersonalPresets();
            setPresets(localPresets);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingPreset({
            name: '',
            description: '',
            lock_type: 'FULL',
            preset_type: 'INSTANT',
            blocked_categories: [],
            duration_minutes: 60,
            days: [],
            start_time: '09:00',
            end_time: '10:00'
        });
        setIsEditorVisible(true);
    };

    const handleEdit = (preset: Preset) => {
        setEditingPreset({ ...preset });
        setIsEditorVisible(true);
    };

    const handleSave = async () => {
        if (!editingPreset?.name?.trim()) {
            Alert.alert("오류", "프리셋 이름을 입력해주세요.");
            return;
        }

        try {
            const saved = await PresetService.savePersonalPreset(editingPreset);
            setIsEditorVisible(false);
            loadData();
            Alert.alert("저장 완료", "사전등록이 저장되었습니다.");
        } catch (error) {
            Alert.alert("오류", "저장에 실패했습니다.");
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "사전등록 삭제",
            "정말 이 사전등록을 삭제하시겠습니까?",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "삭제",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await PresetService.deletePersonalPreset(id);
                            loadData();
                        } catch (error) {
                            Alert.alert("오류", "삭제에 실패했습니다.");
                        }
                    }
                }
            ]
        );
    };

    const toggleCategory = (catId: string) => {
        if (!editingPreset) return;
        const current = editingPreset.blocked_categories || [];
        const updated = current.includes(catId)
            ? current.filter(id => id !== catId)
            : [...current, catId];
        setEditingPreset({ ...editingPreset, blocked_categories: updated, lock_type: updated.length > 0 ? 'APP_ONLY' : editingPreset.lock_type });
    };

    return (
        <View style={styles.container}>
            <Header title="사전등록 관리" showBack />

            <FlatList
                data={presets}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={() => (
                    <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 16 }}>
                        자주 사용하는 잠금 설정을 사전등록으로 만들어 관리할 수 있습니다.
                    </Typography>
                )}
                renderItem={({ item }) => (
                    <View style={styles.presetCard}>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h2" bold>{item.name}</Typography>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
                                {item.preset_type === 'SCHEDULED' ? `예약: ${item.days?.join(', ')} ${item.start_time}-${item.end_time}` :
                                    item.lock_type === 'FULL' ? '전체 잠금' : `${(item.blocked_categories?.length || 0)}개 카테고리 차단`}
                                {item.duration_minutes && item.preset_type !== 'SCHEDULED' ? ` / ${item.duration_minutes}분` : ''}
                            </Typography>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconBtn}>
                                <Icon name="create-outline" size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
                                <Icon name="trash-outline" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Icon name="options-outline" size={48} color={Colors.border} />
                        <Typography color={Colors.textSecondary} style={{ marginTop: 12 }}>등록된 사전등록이 없습니다.</Typography>
                    </View>
                )}
            />

            <TouchableOpacity style={styles.fab} onPress={handleAdd}>
                <Icon name="add" size={30} color="#FFF" />
            </TouchableOpacity>

            {/* Editor Modal */}
            <Modal visible={isEditorVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <Header title={editingPreset?.id ? "사전등록 수정" : "새 사전등록"} showBack onBack={() => setIsEditorVisible(false)} />
                    <ScrollView contentContainerStyle={styles.modalScroll}>
                        <View style={styles.inputGroup}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>프리셋 이름</Typography>
                            <TextInput
                                style={styles.textInput}
                                value={editingPreset?.name}
                                onChangeText={(text) => setEditingPreset({ ...editingPreset, name: text })}
                                placeholder="예: 집중 독서 시간"
                                placeholderTextColor={Colors.statusInactive}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>잠금 방식</Typography>
                            <View style={styles.typeRow}>
                                <TouchableOpacity
                                    style={[styles.typeBtn, editingPreset?.lock_type === 'FULL' && styles.typeBtnActive]}
                                    onPress={() => setEditingPreset({ ...editingPreset, lock_type: 'FULL', blocked_categories: [] })}
                                >
                                    <Typography bold={editingPreset?.lock_type === 'FULL'} color={editingPreset?.lock_type === 'FULL' ? Colors.primary : Colors.text}>전체 잠금</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.typeBtn, editingPreset?.lock_type === 'APP_ONLY' && styles.typeBtnActive]}
                                    onPress={() => setEditingPreset({ ...editingPreset, lock_type: 'APP_ONLY' })}
                                >
                                    <Typography bold={editingPreset?.lock_type === 'APP_ONLY'} color={editingPreset?.lock_type === 'APP_ONLY' ? Colors.primary : Colors.text}>선택 잠금</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>사전등록 유형</Typography>
                            <View style={styles.typeRow}>
                                <TouchableOpacity
                                    style={[styles.typeBtn, editingPreset?.preset_type === 'INSTANT' && styles.typeBtnActive]}
                                    onPress={() => setEditingPreset({ ...editingPreset, preset_type: 'INSTANT' })}
                                >
                                    <Typography bold={editingPreset?.preset_type === 'INSTANT'} color={editingPreset?.preset_type === 'INSTANT' ? Colors.primary : Colors.text}>바로잠금</Typography>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.typeBtn, editingPreset?.preset_type === 'SCHEDULED' && styles.typeBtnActive]}
                                    onPress={() => setEditingPreset({ ...editingPreset, preset_type: 'SCHEDULED' })}
                                >
                                    <Typography bold={editingPreset?.preset_type === 'SCHEDULED'} color={editingPreset?.preset_type === 'SCHEDULED' ? Colors.primary : Colors.text}>예약잠금</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {editingPreset?.lock_type === 'APP_ONLY' && (
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>차단할 카테고리</Typography>
                                <View style={styles.categoryGrid}>
                                    {allCategories.map(cat => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={[styles.catTag, editingPreset.blocked_categories?.includes(cat.id) && styles.catTagActive]}
                                            onPress={() => toggleCategory(cat.id)}
                                        >
                                            <Typography variant="caption" color={editingPreset.blocked_categories?.includes(cat.id) ? Colors.primary : Colors.text}>{cat.display_name}</Typography>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {editingPreset?.preset_type === 'INSTANT' && (
                            <View style={styles.inputGroup}>
                                <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>기본 잠금 시간 (분)</Typography>
                                <TextInput
                                    style={styles.textInput}
                                    value={editingPreset?.duration_minutes?.toString()}
                                    onChangeText={(text) => setEditingPreset({ ...editingPreset, duration_minutes: parseInt(text) || 0 })}
                                    keyboardType="numeric"
                                    placeholderTextColor={Colors.statusInactive}
                                />
                            </View>
                        )}

                        {editingPreset?.preset_type === 'SCHEDULED' && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>시간 설정</Typography>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border }}>
                                        <Typography variant="caption" color={Colors.textSecondary}>시작</Typography>
                                        <TouchableOpacity
                                            style={{ marginLeft: 8, backgroundColor: Colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                                            onPress={() => { setPickerTarget('start'); setIsTimePickerVisible(true); }}
                                        >
                                            <Typography bold>
                                                {(() => {
                                                    const time = parseTime(editingPreset?.start_time || '09:00');
                                                    return `${time.getHours() >= 12 ? '오후' : '오전'} ${((time.getHours() + 11) % 12 + 1)}:${time.getMinutes().toString().padStart(2, '0')}`;
                                                })()}
                                            </Typography>
                                        </TouchableOpacity>
                                        <Typography style={{ marginHorizontal: 8 }}>~</Typography>
                                        <Typography variant="caption" color={Colors.textSecondary}>종료</Typography>
                                        <TouchableOpacity
                                            style={{ marginLeft: 8, backgroundColor: Colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                                            onPress={() => { setPickerTarget('end'); setIsTimePickerVisible(true); }}
                                        >
                                            <Typography bold>
                                                {(() => {
                                                    const time = parseTime(editingPreset?.end_time || '10:00');
                                                    return `${time.getHours() >= 12 ? '오후' : '오전'} ${((time.getHours() + 11) % 12 + 1)}:${time.getMinutes().toString().padStart(2, '0')}`;
                                                })()}
                                            </Typography>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={styles.inputGroup}>
                                    <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>반복 요일</Typography>
                                    <View style={styles.daysRow}>
                                        {DAYS.map(day => (
                                            <TouchableOpacity
                                                key={day}
                                                style={[styles.dayCircle, editingPreset.days?.includes(day) && styles.dayCircleActive]}
                                                onPress={() => toggleDay(day)}
                                            >
                                                <Typography style={{ fontSize: 12 }} color={editingPreset.days?.includes(day) ? Colors.text : Colors.textSecondary}>{day}</Typography>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </>
                        )}
                    </ScrollView>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Typography bold color="#FFF">저장하기</Typography>
                    </TouchableOpacity>

                    {/* Time Picker Modal (Nested to ensure it stays on top on all platforms) */}
                    <Modal visible={isTimePickerVisible} animationType="slide" transparent>
                        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                            <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <Typography variant="h2" bold>{pickerTarget === 'start' ? '시작' : '종료'} 시간 설정</Typography>
                                    <TouchableOpacity onPress={() => setIsTimePickerVisible(false)}>
                                        <Icon name="close" size={24} />
                                    </TouchableOpacity>
                                </View>
                                <View style={{ gap: 20, marginBottom: 30 }}>
                                    {/* AM/PM Toggle */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                                        <TouchableOpacity
                                            style={{ minWidth: 80, backgroundColor: Colors.background, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' }}
                                            onPress={() => {
                                                if (!editingPreset) return;
                                                const currentTime = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
                                                handleAmPmChange(currentTime.getHours() < 12 ? '오후' : '오전', pickerTarget === 'start');
                                            }}
                                        >
                                            <Typography variant="h2" bold>
                                                {(() => {
                                                    if (!editingPreset) return '오전';
                                                    const time = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
                                                    return time.getHours() < 12 ? '오전' : '오후';
                                                })()}
                                            </Typography>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Hour : Minute */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                        {/* Hour */}
                                        <View style={{ alignItems: 'center' }}>
                                            <TouchableOpacity
                                                style={{ padding: 8 }}
                                                onPress={() => {
                                                    if (!editingPreset) return;
                                                    const current = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
                                                    let newHour = ((current.getHours() + 11) % 12 + 1) + 1;
                                                    if (newHour > 12) newHour = 1;
                                                    if (current.getHours() >= 12 && newHour < 12) newHour += 12;
                                                    handleHourChange(newHour.toString(), pickerTarget === 'start');
                                                }}
                                            >
                                                <Icon name="chevron-up" size={24} color={Colors.primary} />
                                            </TouchableOpacity>
                                            <View style={{ minWidth: 70, backgroundColor: Colors.background, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                                                <Typography variant="h1" bold>
                                                    {(() => {
                                                        if (!editingPreset) return '9시';
                                                        const time = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
                                                        return `${time.getHours() % 12 || 12}시`;
                                                    })()}
                                                </Typography>
                                            </View>
                                            <TouchableOpacity
                                                style={{ padding: 8 }}
                                                onPress={() => {
                                                    if (!editingPreset) return;
                                                    const current = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
                                                    let newHour = ((current.getHours() + 11) % 12 + 1) - 1;
                                                    if (newHour < 1) newHour = 12;
                                                    if (current.getHours() >= 12 && newHour < 12) newHour += 12;
                                                    handleHourChange(newHour.toString(), pickerTarget === 'start');
                                                }}
                                            >
                                                <Icon name="chevron-down" size={24} color={Colors.primary} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Minute */}
                                        <View style={{ alignItems: 'center' }}>
                                            <TouchableOpacity
                                                style={{ padding: 8 }}
                                                onPress={() => {
                                                    if (!editingPreset) return;
                                                    const current = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
                                                    const mins = current.getMinutes();
                                                    let newMin = (Math.floor(mins / 5) * 5) + 5;
                                                    if (newMin >= 60) newMin = 0;
                                                    handleMinuteChange(newMin.toString(), pickerTarget === 'start');
                                                }}
                                            >
                                                <Icon name="chevron-up" size={24} color={Colors.primary} />
                                            </TouchableOpacity>
                                            <View style={{ minWidth: 70, backgroundColor: Colors.background, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                                                <Typography variant="h1" bold>
                                                    {(() => {
                                                        if (!editingPreset) return '00분';
                                                        const time = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
                                                        return `${time.getMinutes().toString().padStart(2, '0')}분`;
                                                    })()}
                                                </Typography>
                                            </View>
                                            <TouchableOpacity
                                                style={{ padding: 8 }}
                                                onPress={() => {
                                                    if (!editingPreset) return;
                                                    const current = parseTime(pickerTarget === 'start' ? (editingPreset.start_time || '09:00') : (editingPreset.end_time || '10:00'));
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
                                </View>
                                <TouchableOpacity
                                    style={{ backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}
                                    onPress={() => setIsTimePickerVisible(false)}
                                >
                                    <Typography bold color="#FFF">완료</Typography>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    listContent: { padding: 20, paddingBottom: 100 },
    presetCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
    cardActions: { flexDirection: 'row', gap: 8 },
    iconBtn: { padding: 8 },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    modalContainer: { flex: 1, backgroundColor: Colors.background },
    modalScroll: { padding: 20 },
    inputGroup: { marginBottom: 24 },
    textInput: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
    typeRow: { flexDirection: 'row', gap: 12 },
    typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
    typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
    catTagActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
    daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    dayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    dayCircleActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
    saveBtn: { margin: 20, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
});
