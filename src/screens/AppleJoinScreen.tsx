import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Platform, Linking } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';

const ConsentModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    title: string;
    content: string;
}> = ({ visible, onClose, title, content }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Typography bold style={{ fontSize: 18 }} color={Colors.text}>{title}</Typography>
                    <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                        <Icon name="close" size={24} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                    <Typography style={{ fontSize: 14, lineHeight: 22 }} color={Colors.textSecondary}>
                        {content}
                    </Typography>
                </ScrollView>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={onClose}>
                    <Typography bold color="#FFF">확인</Typography>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>
);

export const AppleJoinScreen: React.FC = () => {
    const { navigate, currentParams } = useAppNavigation();
    const { appleSub, email: initialEmail, name: initialName } = currentParams;

    const [name, setName] = useState(initialName || '');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState(initialEmail || '');
    const [userRole, setUserRole] = useState<'PARENT' | 'TEACHER'>('PARENT');
    const [isLoading, setIsLoading] = useState(false);

    // Terms
    const [serviceTerms, setServiceTerms] = useState(false);
    const [servicePrivacy, setServicePrivacy] = useState(false);
    const [serviceAge, setServiceAge] = useState(false);
    const [marketing, setMarketing] = useState(false);

    const isMandatoryMet = name.length > 1 && phone.length > 9 && serviceTerms && servicePrivacy && serviceAge;

    const handleJoin = async () => {
        if (!isMandatoryMet) return;
        setIsLoading(true);
        const user = await AuthService.registerUser({
            provider: 'APPLE',
            appleSub,
            name,
            phone,
            role: userRole,
            email: email || undefined
        });
        setIsLoading(false);
        if (user) {
            navigate('JoinComplete' as any, { role: userRole });
        } else {
            Alert.alert('오류', '회원가입 중 오류가 발생했습니다.');
        }
    };

    // Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState('');

    const openModal = (title: string, content: string) => {
        setModalTitle(title);
        setModalContent(content);
        setModalVisible(true);
    };

    const TERMS_URL = 'https://pic.momentae.app/6';
    const PRIVACY_URL = 'https://pic.momentae.app/5';

    const MANDATORY_ITEMS_TEXT = `[필수항목]
• 수집 항목: 이름, 휴대폰번호
• 이용 목적: 회원 식별 및 서비스 제공
• 보유 기간: 회원 탈퇴 시까지`;

    const OPTIONAL_ITEMS_TEXT = `[선택항목]
• 수입 항목 : 이메일
• 이용목적 : 이용자 식별, 회원관리 및 서비스 제공
• 보유기간 : 동의 철회 또는 서비스 탈퇴 시 지체없이 파기`;

    const SERVICE_TERMS_TEXT = `${MANDATORY_ITEMS_TEXT}\n\n이용약관 상세 내용은 아래 링크에서 확인하실 수 있습니다.\n${TERMS_URL}`;
    const PRIVACY_POLICY_TEXT = `${OPTIONAL_ITEMS_TEXT}\n\n개인정보 처리방침 상세 내용은 아래 링크에서 확인하실 수 있습니다.\n${PRIVACY_URL}`;

    const renderCheckbox = (label: string, checked: boolean, onPress: () => void, isMandatory = false, subLabel?: string, url?: string) => (
        <View style={styles.checkItemWrapper}>
            <TouchableOpacity style={styles.checkRow} onPress={onPress}>
                <View style={styles.checkTextRow}>
                    <Icon name="checkmark" size={18} color={checked ? Colors.primary : Colors.border} />
                    <Typography style={[styles.checkLabel, !checked && { color: Colors.textSecondary }]}>
                        {isMandatory ? '[필수]' : '[선택]'} {label}
                    </Typography>
                </View>
                {url && (
                    <TouchableOpacity onPress={() => Linking.openURL(url)}>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ textDecorationLine: 'underline' }}>보기</Typography>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
            {subLabel && (
                <View style={styles.subLabelContainer}>
                    <Typography variant="caption" color={Colors.textSecondary} style={styles.subLabelText}>
                        {subLabel}
                    </Typography>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.ohHeader}>
                <TouchableOpacity onPress={() => navigate('Login')}>
                    <Icon name="close" size={28} color={Colors.text} />
                </TouchableOpacity>
                <Typography variant="h2" bold style={styles.headerTitle}>Apple 계정으로 가입</Typography>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>필수 정보 입력</Typography>

                    <View style={styles.inputWrapper}>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.inputLabel}>이름</Typography>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="성함을 입력해주세요"
                            placeholderTextColor={Colors.statusInactive}
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.inputLabel}>휴대폰 번호</Typography>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="01012345678"
                            placeholderTextColor={Colors.statusInactive}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.inputLabel}>이메일 (선택)</Typography>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="example@email.com"
                            placeholderTextColor={Colors.statusInactive}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>가입 유형</Typography>
                    <View style={styles.roleContainer}>
                        <TouchableOpacity
                            style={[styles.roleButton, userRole === 'PARENT' && styles.roleButtonActive]}
                            onPress={() => setUserRole('PARENT')}
                        >
                            <Typography bold color={userRole === 'PARENT' ? Colors.primary : Colors.textSecondary}>부모</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.roleButton, userRole === 'TEACHER' && styles.roleButtonActive]}
                            onPress={() => setUserRole('TEACHER')}
                        >
                            <Typography bold color={userRole === 'TEACHER' ? Colors.primary : Colors.textSecondary}>교사</Typography>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Typography variant="h2" bold style={styles.sectionTitle}>약관 동의</Typography>
                    <View style={styles.consentCard}>
                        {renderCheckbox(
                            "이용약관 및 필수정보 수집 동의",
                            serviceTerms,
                            () => setServiceTerms(!serviceTerms),
                            true,
                            MANDATORY_ITEMS_TEXT,
                            TERMS_URL
                        )}
                        {renderCheckbox(
                            "개인정보 처리방침 및 선택정보 수집 동의",
                            servicePrivacy,
                            () => setServicePrivacy(!servicePrivacy),
                            true,
                            OPTIONAL_ITEMS_TEXT,
                            PRIVACY_URL
                        )}
                        {renderCheckbox("만 14세 이상입니다", serviceAge, () => setServiceAge(!serviceAge), true)}
                        {renderCheckbox("마케팅 정보 수신 동의", marketing, () => setMarketing(!marketing), false)}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.ohButton, !isMandatoryMet && styles.ohButtonDisabled]}
                    disabled={!isMandatoryMet || isLoading}
                    onPress={handleJoin}
                >
                    <Typography bold color="#FFF" style={{ fontSize: 16 }}>
                        {isLoading ? '가입 중...' : '동의하고 가입완료'}
                    </Typography>
                </TouchableOpacity>
            </View>

            <ConsentModal visible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} content={modalContent} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    ohHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
    headerTitle: { fontSize: 16, color: Colors.text },
    scrollContent: { padding: 24, paddingBottom: 40 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 16, color: Colors.text, marginBottom: 16 },
    inputWrapper: { marginBottom: 16 },
    inputLabel: { marginBottom: 8 },
    input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15 },
    roleContainer: { flexDirection: 'row', gap: 12 },
    roleButton: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.card },
    roleButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
    consentCard: { padding: 16, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
    checkItemWrapper: {
        marginBottom: 12,
    },
    checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    checkTextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    checkLabel: { fontSize: 14, color: Colors.text },
    subLabelContainer: {
        paddingLeft: 30,
        marginTop: -4,
    },
    subLabelText: {
        fontSize: 12,
        lineHeight: 18,
    },
    footer: { padding: 24, paddingBottom: 40 },
    ohButton: { backgroundColor: Colors.primary, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
    ohButtonDisabled: { backgroundColor: Colors.statusInactive },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { backgroundColor: Colors.card, width: '100%', maxHeight: '80%', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: Colors.border },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalCloseBtn: { padding: 4 },
    modalScroll: { marginBottom: 24 },
    modalConfirmBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
});
