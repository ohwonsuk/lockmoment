import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Platform, useWindowDimensions } from 'react-native';
import { Picker as IOSPicker } from '@react-native-picker/picker';
import { Picker as AndroidPicker } from 'react-native-wheel-pick';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { NativeLockControl } from '../services/NativeLockControl';
import { AppSelectorModal } from './AppSelectorModal';

interface Props {
    isVisible: boolean;
    onClose: () => void;
    onConfirm: (hours: number, minutes: number, type: 'app' | 'phone', packagesJson?: string) => void;
}

const isIOS = Platform.OS === 'ios';

export const QuickLockPicker: React.FC<Props> = ({ isVisible, onClose, onConfirm }) => {
    const [hours, setHours] = useState('1');
    const [minutes, setMinutes] = useState('00');
    // const [ampm, setAmpm] = useState('오후'); // Not used for duration
    const [lockType, setLockType] = useState<'app' | 'phone'>('app');

    const [appAllowedCount, setAppAllowedCount] = useState(0);
    const [phoneAllowedCount, setPhoneAllowedCount] = useState(0);
    const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
    const [isAppSelectorVisible, setIsAppSelectorVisible] = useState(false);
    const [endTimeStr, setEndTimeStr] = useState('');

    const { width, height } = useWindowDimensions();
    const isPad = Platform.OS === 'ios' && (
        Platform.isPad ||
        (Platform.constants as any)?.interfaceIdiom === 'pad' ||
        (Math.min(width, height) / Math.max(width, height) > 0.7) // iPad ratio is usually 3:4
    );
    const phoneLabel = isPad ? '패드 잠금' : '핸드폰 잠금';

    React.useEffect(() => {
        const h = parseInt(hours) || 0;
        const m = parseInt(minutes) || 0;
        const totalMinutes = h * 60 + m;

        if (totalMinutes === 0) {
            setEndTimeStr('');
            return;
        }

        const now = new Date();
        const end = new Date(now.getTime() + totalMinutes * 60000);

        const month = end.getMonth() + 1;
        const date = end.getDate();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const day = days[end.getDay()];
        const endH = end.getHours();
        const endM = end.getMinutes().toString().padStart(2, '0');

        setEndTimeStr(`종료예정 ${month}/${date}(${day}) ${endH}:${endM}`);
    }, [hours, minutes]);

    const handleAppSelect = async () => {
        if (Platform.OS === 'ios') {
            try {
                const result = await NativeLockControl.presentFamilyActivityPicker(lockType);
                if (typeof result === 'number') {
                    if (lockType === 'phone') setPhoneAllowedCount(result);
                    else setAppAllowedCount(result);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            if (lockType === 'app') {
                setIsAppSelectorVisible(true);
            }
        }
    };

    const handleAndroidAppSelect = (pkgs: string[]) => {
        setSelectedPackages(pkgs);
        if (lockType === 'phone') setPhoneAllowedCount(pkgs.length);
        else setAppAllowedCount(pkgs.length);
    };

    const handleConfirm = () => {
        const h = parseInt(hours) || 0;
        const m = parseInt(minutes) || 0;

        if (h === 0 && m === 0) {
            // Alert or just return? For now let's assume user knows
            return;
        }

        const needsSelection = Platform.OS === 'ios' || lockType === 'app';
        if (needsSelection) {
            const currentCount = lockType === 'phone' ? phoneAllowedCount : appAllowedCount;
            if (currentCount === 0) {
                handleAppSelect();
                return;
            }
        }

        const packagesJson = Platform.OS === 'android' && lockType === 'app'
            ? JSON.stringify(selectedPackages)
            : undefined;

        onConfirm(h, m, lockType, packagesJson);
    };

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[styles.typeButton, lockType === 'app' && styles.typeButtonActive]}
                            onPress={() => setLockType('app')}
                        >
                            <Typography variant="body" bold={lockType === 'app'} color={lockType === 'app' ? Colors.text : Colors.textSecondary}>앱 잠금</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeButton, lockType === 'phone' && styles.typeButtonActive]}
                            onPress={() => setLockType('phone')}
                        >
                            <Typography variant="body" bold={lockType === 'phone'} color={lockType === 'phone' ? Colors.text : Colors.textSecondary}>{phoneLabel}</Typography>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.appSelector}
                        onPress={handleAppSelect}
                        disabled={Platform.OS === 'android' && lockType === 'phone'}
                    >
                        <View style={{ flex: 1 }}>
                            <Typography style={styles.appSelectorText}>
                                {lockType === 'phone'
                                    ? (Platform.OS === 'android'
                                        ? "핸드폰 전체 사용불가"
                                        : (phoneAllowedCount > 0 ? `${phoneAllowedCount}개 카테고리/앱 선택됨` : `모든 앱 잠금 설정 (${isPad ? '패드' : '폰'} 전체)`))
                                    : (appAllowedCount > 0 ? `${appAllowedCount}개 항목 선택됨` : "잠글 앱 선택하기")}
                            </Typography>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ fontSize: 10, marginTop: 2 }}>
                                {lockType === 'phone'
                                    ? (Platform.OS === 'android' ? "* 전화/메시지/락모먼트 앱은 제외" : "* 전체 앱을 잠그려면 설정에서 모든 카테고리를 선택해주세요.")
                                    : "* 전화/메시지 앱은 잠금 목록에서 제외 권장"}
                            </Typography>
                        </View>
                        {!(Platform.OS === 'android' && lockType === 'phone') && (
                            <Typography variant="caption" color={Colors.primary} bold>설정</Typography>
                        )}
                    </TouchableOpacity>

                    <Typography variant="h2" bold style={styles.title}>잠금 시간 설정</Typography>

                    <View style={styles.pickerRow}>
                        <View style={styles.pickerGroup}>
                            {isIOS ? (
                                <IOSPicker
                                    style={styles.picker}
                                    selectedValue={hours}
                                    onValueChange={(val) => setHours(val)}
                                    itemStyle={styles.pickerItemIOS}
                                >
                                    {Array.from({ length: 25 }, (_, i) => (
                                        <IOSPicker.Item key={i} label={i.toString()} value={i.toString()} />
                                    ))}
                                </IOSPicker>
                            ) : (
                                <AndroidPicker
                                    style={[styles.picker, { backgroundColor: '#1E293B' }]}
                                    themeVariant="dark"
                                    backgroundColor="#1E293B"
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    isShowSelectLine={true}
                                    selectLineColor={Colors.primary}
                                    itemStyle={{ height: 50, color: '#FFFFFF', backgroundColor: 'transparent' }}
                                    textSize={24}
                                    selectedValue={hours}
                                    pickerData={Array.from({ length: 25 }, (_, i) => i.toString())}
                                    onValueChange={(val: any) => setHours(val)}
                                />
                            )}
                        </View>

                        <Typography variant="h2" bold style={styles.colon}>:</Typography>

                        <View style={styles.pickerGroup}>
                            {isIOS ? (
                                <IOSPicker
                                    style={styles.picker}
                                    selectedValue={minutes}
                                    onValueChange={(val) => setMinutes(val)}
                                    itemStyle={styles.pickerItemIOS}
                                >
                                    {['00', '10', '20', '30', '40', '50'].map((val) => (
                                        <IOSPicker.Item key={val} label={val} value={val} />
                                    ))}
                                </IOSPicker>
                            ) : (
                                <AndroidPicker
                                    style={[styles.picker, { backgroundColor: '#1E293B' }]}
                                    themeVariant="dark"
                                    backgroundColor="#1E293B"
                                    textColor="#FFFFFF"
                                    selectTextColor="#FFFFFF"
                                    isShowSelectLine={true}
                                    selectLineColor={Colors.primary}
                                    itemStyle={{ height: 50, color: '#FFFFFF', backgroundColor: 'transparent' }}
                                    textSize={24}
                                    selectedValue={minutes}
                                    pickerData={['00', '10', '20', '30', '40', '50']}
                                    onValueChange={(val: any) => setMinutes(val)}
                                />
                            )}
                        </View>
                    </View>

                    {endTimeStr ? (
                        <Typography style={styles.endTimeText} color={Colors.primary}>{endTimeStr}</Typography>
                    ) : null}

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Typography color={Colors.textSecondary}>취소</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                            <Typography bold>잠금 시작</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {Platform.OS === 'android' && (
                <AppSelectorModal
                    visible={isAppSelectorVisible}
                    onClose={() => setIsAppSelectorVisible(false)}
                    onConfirm={handleAndroidAppSelect}
                    initialSelection={selectedPackages}
                />
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '90%',
        backgroundColor: Colors.card,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    title: {
        textAlign: 'center',
        marginBottom: 20,
        marginTop: 10,
    },
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    typeButtonActive: {
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 10,
    },
    pickerGroup: {
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 0,
    },
    picker: {
        width: Platform.OS === 'ios' ? 100 : 80,
        height: Platform.OS === 'ios' ? 150 : 150,
        backgroundColor: 'transparent',
    },
    pickerItemIOS: {
        fontSize: 30,
        height: 150,
        color: '#FFFFFF',
    },
    ampmPicker: {
        width: Platform.OS === 'ios' ? 80 : 60,
        height: Platform.OS === 'ios' ? 180 : 150,
        backgroundColor: 'transparent',
    },
    colon: {
        fontSize: 26,
        fontWeight: 'bold',
        marginHorizontal: Platform.OS === 'ios' ? 5 : 10,
        textAlignVertical: 'center',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    cancelButton: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: Colors.border,
    },
    confirmButton: {
        flex: 2,
        padding: 16,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: Colors.primary,
    },
    appSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.background,
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    appSelectorText: {
        fontSize: 16,
        color: Colors.text,
    },
    endTimeText: {
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 10,
        fontSize: 14,
        fontWeight: 'bold',
    }
});
