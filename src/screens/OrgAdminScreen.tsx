import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from '../components/Header';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';

export const OrgAdminScreen: React.FC = () => {
    return (
        <View style={styles.container}>
            <Header title="기관 관리" showContextSwitcher={true} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.welcomeSection}>
                    <Typography variant="h2" bold>반갑습니다, 관리자님</Typography>
                    <Typography color={Colors.textSecondary} style={{ marginTop: 4 }}>OO 국어전문학원 종합 현황입니다.</Typography>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Icon name="people" size={24} color={Colors.primary} />
                        <Typography variant="h2" bold style={styles.statValue}>128</Typography>
                        <Typography variant="caption" color={Colors.textSecondary}>전체 원생</Typography>
                    </View>
                    <View style={styles.statCard}>
                        <Icon name="person-circle" size={24} color={Colors.statusGreen} />
                        <Typography variant="h2" bold style={styles.statValue}>8</Typography>
                        <Typography variant="caption" color={Colors.textSecondary}>소속 강사</Typography>
                    </View>
                </View>

                <Typography bold style={styles.sectionTitle}>관리 메뉴</Typography>

                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuLeft}>
                        <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
                            <Icon name="school-outline" size={22} color="#4F46E5" />
                        </View>
                        <View style={styles.menuText}>
                            <Typography bold>강사 권한 관리</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>강사 초대 및 담당 클래스 설정</Typography>
                        </View>
                    </View>
                    <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuLeft}>
                        <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                            <Icon name="book-outline" size={22} color="#10B981" />
                        </View>
                        <View style={styles.menuText}>
                            <Typography bold>기관 표준 정책</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>모든 교실에 공통 적용할 프리셋 설정</Typography>
                        </View>
                    </View>
                    <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem}>
                    <View style={styles.menuLeft}>
                        <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                            <Icon name="analytics-outline" size={22} color="#EF4444" />
                        </View>
                        <View style={styles.menuText}>
                            <Typography bold>출석 및 통계 레포트</Typography>
                            <Typography variant="caption" color={Colors.textSecondary}>학내 전체 출석률 및 스마트폰 사용량 통계</Typography>
                        </View>
                    </View>
                    <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <View style={styles.noticeBox}>
                    <Typography bold color={Colors.primary}>관리자 팁</Typography>
                    <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 5 }}>
                        표준 정책을 설정하면 개별 강사가 프리셋을 직접 만들지 않아도 바로 학생들에게 적용할 수 있습니다.
                    </Typography>
                </View>
            </ScrollView>
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
    welcomeSection: {
        marginBottom: 25,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 30,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
    },
    statValue: {
        marginTop: 10,
    },
    sectionTitle: {
        marginBottom: 15,
        fontSize: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    menuText: {
        flex: 1,
    },
    noticeBox: {
        marginTop: 20,
        padding: 15,
        backgroundColor: Colors.card,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
    }
});
