import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert, Modal } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { AuthService } from '../services/AuthService';
import { StorageService } from '../services/StorageService';

const ConsentModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    title: string;
    content: string;
}> = ({ visible, onClose, title, content }) => (
    <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
    >
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

export const JoinScreen: React.FC = () => {
    const { navigate } = useAppNavigation();

    // States for all checkboxes
    const [agreedAll, setAgreedAll] = useState(false);

    // Kakao Section
    const [kakaoPrivacy, setKakaoPrivacy] = useState(false); // [필수] 개인정보 처리방침 동의
    const [kakao3rdMandatory, setKakao3rdMandatory] = useState(false); // [필수] 제3자 제공
    const [kakao3rdOptional, setKakao3rdOptional] = useState(false); // [선택] 제3자 제공

    // Service Section
    const [serviceTerms, setServiceTerms] = useState(false);
    const [servicePrivacy, setServicePrivacy] = useState(false);
    const [serviceAge, setServiceAge] = useState(false);
    const [serviceMarketing, setServiceMarketing] = useState(false);

    // Sync "Agree All"
    const handleAgreeAll = (val: boolean) => {
        setAgreedAll(val);
        setKakaoPrivacy(val);
        setKakao3rdMandatory(val);
        setKakao3rdOptional(val);
        setServiceTerms(val);
        setServicePrivacy(val);
        setServiceAge(val);
        setServiceMarketing(val);
    };

    // Check if all mandatory items are checked
    const isMandatoryMet = kakaoPrivacy && kakao3rdMandatory && serviceTerms && servicePrivacy && serviceAge;

    const handleContinue = () => {
        if (!isMandatoryMet) return;
        navigate('JoinInfo' as any);
    };

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState('');

    const openModal = (title: string, content: string) => {
        setModalTitle(title);
        setModalContent(content);
        setModalVisible(true);
    };

    const MANDATORY_3RD_PARTY_TEXT = `락모먼트 서비스 내 이용자 식별, 회원관리 및 서비스 제공을 위해 회원번호와 함께 '(카카오에서 수신한 이름)' 님의 개인정보를 제공합니다. 해당 정보는 동의 철회 또는 서비스 탈퇴 시 지체없이 파기됩니다. 아래 동의를 거부할 권리가 있으며, 동의를 거부할 경우 서비스 이용이 제한됩니다.

[제공 하는 자]
카카오

[제공 받는 자]
락모먼트

[필수 제공 항목]
프로필 정보 : 이름(닉네임), 휴대폰번호, 카카오 ID

[제공 목적]
락모먼트 서비스 내 이용자 식별, 회원관리 및 서비스 제공

[보유 기간]
동의 철회 또는 서비스 탈퇴 시 지체없이 파기`;

    const OPTIONAL_3RD_PARTY_TEXT = `락모먼트 서비스 내 이용자 식별, 회원관리 및 서비스 제공을 위해 회원번호와 함께 '(카카오 이름)' 님의 개인정보를 제공합니다. 해당 정보는 동의 철회 또는 서비스 탈퇴 시 지체없이 파기됩니다. 아래 동의를 거부할 권리가 있으며, 동의를 거부할 경우 기재된 목적의 일부 서비스 이용이 제한될 수 있습니다.

[제공 하는 자]
카카오

[제공 받는 자]
락모먼트

[선택 제공 항목]
카카오계정 : 이메일, 프로필사진

[제공 목적]
락모먼트 서비스 내 이용자 식별, 회원관리 및 서비스 제공

[보유 기간]
동의 철회 또는 서비스 탈퇴 시 지체없이 파기`;

    const SERVICE_TERMS_TEXT = `락모먼트 이용약관에 대한 상세 내용입니다. 서비스 이용과 관련된 권리 및 의무 사항이 명시되어 있습니다.\n\n(상세 내용 생략... 실 서비스 시 전체 약관 삽입)`;
    const PRIVACY_POLICY_TEXT = `개인정보 처리방침에 대한 상세 내용입니다. 회원의 개인정보를 보호하고 관련 법규를 준수하기 위한 방침이 명시되어 있습니다.\n\n(상세 내용 생략... 실 서비스 시 전체 약관 삽입)`;

    const renderCheckbox = (label: string, checked: boolean, onPress: () => void, isMandatory = false, onView?: () => void, subLabel?: string) => (
        <View style={styles.checkItemContainer}>
            <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.7}>
                <View style={styles.checkTextContainer}>
                    <Icon
                        name="checkmark"
                        size={18}
                        color={checked ? Colors.primary : Colors.border}
                        style={styles.checkIcon}
                    />
                    <Typography style={[styles.checkLabel, !checked && { color: Colors.textSecondary }]}>
                        {isMandatory ? '[필수]' : '[선택]'} {label}
                    </Typography>
                </View>
                {onView && (
                    <TouchableOpacity onPress={onView}>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.linkText}>보기</Typography>
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
                <Typography variant="h2" bold style={styles.headerTitle}>카카오계정으로 간편가입</Typography>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.brandContainer}>
                    <Typography variant="h1" bold style={styles.brandName}>kakao</Typography>
                </View>

                <View style={styles.consentCard}>
                    <View style={styles.brandInfoRow}>
                        <View style={styles.brandLogo}>
                            <Icon name="lock-closed" size={20} color="#FFF" />
                        </View>
                        <View>
                            <Typography bold style={{ fontSize: 18 }}>락모먼트</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>lockmoment</Typography>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <TouchableOpacity
                        style={styles.allAgreeRow}
                        onPress={() => handleAgreeAll(!agreedAll)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.allCheckCircle, agreedAll && styles.allCheckCircleActive]}>
                            <Icon name="checkmark" size={20} color={agreedAll ? "#FFF" : Colors.border} />
                        </View>
                        <Typography bold style={{ fontSize: 18 }}>전체 동의하기</Typography>
                    </TouchableOpacity>

                    {/* Kakao Section */}
                    <View style={styles.section}>
                        <Typography bold style={styles.sectionTitle}>카카오 로그인 동의</Typography>
                        <Typography variant="caption" color={Colors.textSecondary} style={styles.sectionDesc}>
                            락모먼트 서비스 제공을 위해 회원번호와 함께 개인정보가 제공됩니다. 보다 자세한 내용은 동의 내용에서 확인하실 수 있습니다.
                        </Typography>

                        {renderCheckbox("개인정보 처리방침 동의", kakaoPrivacy, () => setKakaoPrivacy(!kakaoPrivacy), true, undefined
                        )}

                        {renderCheckbox("카카오 개인정보 제3자 제공 동의", kakao3rdMandatory, () => setKakao3rdMandatory(!kakao3rdMandatory), true, () => openModal('[필수] 제3자 제공 동의', MANDATORY_3RD_PARTY_TEXT),
                            "• 수집 항목: 이름(닉네임), 휴대폰번호, 카카오 ID\n• 이용 목적: 회원 식별 및 서비스 제공\n• 보유 기간: 회원 탈퇴 시까지"
                        )}

                        {renderCheckbox("카카오 개인정보 제3자 제공 동의", kakao3rdOptional, () => setKakao3rdOptional(!kakao3rdOptional), false, () => openModal('[선택] 제3자 제공 동의', OPTIONAL_3RD_PARTY_TEXT), "• 이메일, 프로필사진")}

                        {renderCheckbox("마케팅 정보 수신 동의", serviceMarketing, () => setServiceMarketing(!serviceMarketing), false, undefined)}
                    </View>

                    <View style={styles.divider} />

                    {/* Service Section */}
                    <View style={styles.section}>
                        <Typography bold style={styles.sectionTitle}>락모먼트 서비스 동의</Typography>
                        {renderCheckbox("이용약관", serviceTerms, () => setServiceTerms(!serviceTerms), true, () => openModal('이용약관', SERVICE_TERMS_TEXT))}
                        {renderCheckbox("개인정보 처리방침", servicePrivacy, () => setServicePrivacy(!servicePrivacy), true, () => openModal('개인정보 처리방침', PRIVACY_POLICY_TEXT))}
                        {renderCheckbox("만 14세 이상입니다.", serviceAge, () => setServiceAge(!serviceAge), true)}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footerButtonContainer}>
                <TouchableOpacity
                    style={[styles.ohButton, !isMandatoryMet && styles.ohButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!isMandatoryMet}
                >
                    <Typography bold color={isMandatoryMet ? "#FFF" : Colors.textSecondary} style={{ fontSize: 16 }}>동의하고 계속하기</Typography>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ohCancelButton} onPress={() => navigate('Login')}>
                    <Typography color={Colors.textSecondary}>취소</Typography>
                </TouchableOpacity>
            </View>

            <ConsentModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={modalTitle}
                content={modalContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    ohHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        backgroundColor: Colors.background,
    },
    headerTitle: {
        fontSize: 16,
        color: Colors.text,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    brandContainer: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    brandName: {
        fontSize: 32,
        color: Colors.text,
        opacity: 0.8,
    },
    consentCard: {
        backgroundColor: Colors.card,
        borderRadius: 24,
        marginHorizontal: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    brandInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    brandLogo: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 20,
    },
    allAgreeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 24,
    },
    allCheckCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    allCheckCircleActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    section: {
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 16,
        marginBottom: 12,
        color: Colors.text,
    },
    sectionDesc: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 16,
        color: Colors.textSecondary,
    },
    checkItemContainer: {
        marginBottom: 8,
    },
    checkRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    checkTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkIcon: {
        marginRight: 12,
    },
    checkLabel: {
        fontSize: 14,
        color: Colors.text,
    },
    subLabelContainer: {
        paddingLeft: 30,
        marginTop: -4,
        marginBottom: 4,
    },
    subLabelText: {
        lineHeight: 18,
    },
    linkText: {
        textDecorationLine: 'underline',
    },
    footerButtonContainer: {
        padding: 24,
        paddingBottom: 40,
        backgroundColor: Colors.background,
    },
    ohButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    ohButtonDisabled: {
        backgroundColor: Colors.statusInactive,
    },
    ohCancelButton: {
        alignItems: 'center',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: Colors.card,
        width: '100%',
        maxHeight: '80%',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalScroll: {
        marginBottom: 24,
    },
    modalText: {
        lineHeight: 22,
    },
    modalConfirmBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
});
