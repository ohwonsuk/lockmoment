import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { Header } from '../components/Header';
import { ParentChildService, ChildInfo, ParentInfo } from '../services/ParentChildService';
import { QRCard } from '../components/QRCard';

export const LinkSubUserScreen: React.FC<any> = ({ route }) => {
    const { navigate } = useAppNavigation();
    const { role, autoOpen, autoName } = route.params || { role: 'PARENT' };

    // List state
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [parents, setParents] = useState<ParentInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Registration state
    const [name, setName] = useState('');
    const [regType, setRegType] = useState<'CHILD' | 'PARENT'>('CHILD');
    const [qrValue, setQrValue] = useState<string | null>(null);
    const [isRegModalVisible, setIsRegModalVisible] = useState(false);
    const [isQRModalVisible, setIsQRModalVisible] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        loadData();
        if (autoOpen) {
            handleOpenAdd(autoOpen === 'PARENT' ? 'PARENT' : 'CHILD', autoName);
        }
    }, [autoOpen, autoName]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const childData = await ParentChildService.getLinkedChildren();
            setChildren(childData);
            if (role === 'PARENT') {
                const parentData = await ParentChildService.getLinkedParents();
                setParents(parentData);
            }
        } catch (error) {
            console.error("Failed to load management data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenAdd = (type: 'CHILD' | 'PARENT', initialName?: string) => {
        setRegType(type);
        setName(initialName || '');
        setIsRegModalVisible(true);
    };

    const handleGenerateQR = async () => {
        if (!name.trim()) return;
        setIsGenerating(true);
        try {
            const payload = await ParentChildService.generateRegistrationQr(regType, name);
            setQrValue(payload);
            setIsRegModalVisible(false);
            setIsQRModalVisible(true);
        } catch (error) {
            console.error("Failed to generate QR:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const renderList = () => {
        if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />;

        return (
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Children List */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Typography variant="h2" bold>{role === 'PARENT' ? '등록된 자녀' : '관리 중인 학생'}</Typography>
                        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenAdd('CHILD')}>
                            <Icon name="add" size={16} color={Colors.primary} />
                            <Typography color={Colors.primary} bold style={{ marginLeft: 4 }}>추가</Typography>
                        </TouchableOpacity>
                    </View>
                    {children.length === 0 ? (
                        <Typography color={Colors.textSecondary} style={styles.emptyText}>등록된 자녀가 없습니다.</Typography>
                    ) : (
                        <View style={styles.cardList}>
                            {children.map(child => (
                                <View key={child.id} style={styles.itemCard}>
                                    <View style={styles.iconContainer}>
                                        <Icon name="person-outline" size={24} color={Colors.primary} />
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Typography bold>{child.childName}</Typography>
                                            <View style={[styles.permissionBadge, {
                                                backgroundColor: child.hasPermission === true ? '#10B98120' : child.hasPermission === false ? '#EF444420' : '#6B728020'
                                            }]}>
                                                <Icon
                                                    name={child.hasPermission === true ? "checkmark-circle" : child.hasPermission === false ? "close-circle" : "help-circle"}
                                                    size={14}
                                                    color={child.hasPermission === true ? '#10B981' : child.hasPermission === false ? '#EF4444' : '#6B7280'}
                                                />
                                                <Typography
                                                    style={{ fontSize: 11 }}
                                                    color={child.hasPermission === true ? '#10B981' : child.hasPermission === false ? '#EF4444' : '#6B7280'}
                                                >
                                                    {child.hasPermission === true ? '권한 허용' : child.hasPermission === false ? '권한 필요' : '미확인'}
                                                </Typography>
                                            </View>
                                        </View>
                                        <Typography variant="caption" color={Colors.textSecondary}>{child.deviceName || '연결 대기 중'}</Typography>
                                    </View>
                                    <TouchableOpacity style={styles.moreBtn}>
                                        <Icon name="ellipsis-vertical" size={20} color={Colors.border} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Parents List (Only for PARENT role) */}
                {role === 'PARENT' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Typography variant="h2" bold>등록된 보호자</Typography>
                            {parents.length < 2 && (
                                <TouchableOpacity style={styles.addButton} onPress={() => handleOpenAdd('PARENT')}>
                                    <Icon name="add" size={16} color={Colors.primary} />
                                    <Typography color={Colors.primary} bold style={{ marginLeft: 4 }}>추가</Typography>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.cardList}>
                            {parents.map(parent => (
                                <View key={parent.id} style={styles.itemCard}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#F59E0B20' }]}>
                                        <Icon name="shield-checkmark-outline" size={24} color="#F59E0B" />
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <Typography bold>{parent.parentName} {parent.isPrimary && '(관리자)'}</Typography>
                                        <Typography variant="caption" color={Colors.textSecondary}>{parent.email || ''}</Typography>
                                    </View>
                                </View>
                            ))}
                        </View>
                        {parents.length >= 2 && (
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 8 }}>
                                * 보호자는 최대 2명까지 등록 가능합니다.
                            </Typography>
                        )}
                    </View>
                )}

                <View style={styles.guideContainer}>
                    <Typography variant="caption" color={Colors.textSecondary}>
                        자녀 기기를 연결하려면 자녀의 기기에서 '보호자 연결 QR'을 스캔하세요. 추가 보호자 등록 시 동일한 자녀 리스트를 공유할 수 있습니다.
                    </Typography>
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <Header title={role === 'PARENT' ? '자녀 및 보호자 관리' : '학생 관리'} showBack />

            {renderList()}

            {/* Registration Input Modal */}
            <Modal visible={isRegModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h2" bold>{regType === 'CHILD' ? '자녀 등록' : '보호자 초대'}</Typography>
                            <TouchableOpacity onPress={() => setIsRegModalVisible(false)}>
                                <Icon name="close" size={24} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Typography variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>
                                {regType === 'CHILD' ? '자녀의 이름을 입력하세요' : '공동 관리할 보호자의 이름을 입력하세요'}
                            </Typography>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder={regType === 'CHILD' ? '예: 김철수' : '예: 홍길동'}
                                placeholderTextColor={Colors.textSecondary}
                                autoFocus
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.linkButton, !name.trim() && styles.disabledButton]}
                            disabled={!name.trim() || isGenerating}
                            onPress={handleGenerateQR}
                        >
                            {isGenerating ? <ActivityIndicator color="#FFF" /> : <Typography bold color="#FFF">QR 코드 생성</Typography>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* QR Modal */}
            <Modal visible={isQRModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Typography variant="h2" bold>{name} {regType === 'CHILD' ? '연결용 QR' : '초대용 QR'}</Typography>
                            <TouchableOpacity onPress={() => setIsQRModalVisible(false)}>
                                <Icon name="close" size={24} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            {qrValue && (
                                <QRCard
                                    title={regType === 'CHILD' ? '자녀 기기 연결' : '보호자 초대'}
                                    subtitle={regType === 'CHILD' ? '자녀 기기에서 스캔하세요' : '다른 보호자의 기기에서 스캔하세요'}
                                    value={qrValue}
                                />
                            )}
                        </View>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center', marginBottom: 24 }}>
                            상대방 기기의 카메라나 락모먼트 앱 스캐너로{'\n'}위 코드를 스캔해주세요.
                        </Typography>
                        <TouchableOpacity
                            style={[styles.linkButton, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}
                            onPress={() => { setIsQRModalVisible(false); loadData(); }}
                        >
                            <Typography bold>확인</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { padding: 20 },
    section: { marginBottom: 30 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    cardList: { gap: 12 },
    itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
    iconContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
    itemInfo: { flex: 1, marginLeft: 12 },
    permissionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    moreBtn: { padding: 4 },
    emptyText: { textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    guideContainer: { marginTop: 20, padding: 16, backgroundColor: Colors.card, borderRadius: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: Colors.background, borderRadius: 24, width: '100%', maxWidth: 400, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalBody: { marginBottom: 24 },
    input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, fontSize: 16, color: Colors.text },
    linkButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    disabledButton: { backgroundColor: Colors.statusInactive },
});
