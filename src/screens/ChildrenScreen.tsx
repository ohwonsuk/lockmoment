import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { ParentChildService, ChildInfo } from '../services/ParentChildService';
import { StorageService } from '../services/StorageService';

export const ChildrenScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [children, setChildren] = useState<ChildInfo[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [userRole, setUserRole] = useState<string>('PARENT');

    useEffect(() => {
        loadData();
        const roleCheck = async () => {
            const role = await StorageService.getUserRole();
            if (role) setUserRole(role);
        }
        roleCheck();
    }, []);

    const loadData = async () => {
        setRefreshing(true);
        try {
            // For now, only Parent logic is fully implemented
            const data = await ParentChildService.getLinkedChildren();
            setChildren(data);
        } catch (error) {
            console.error(error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleChildPress = (childId: string) => {
        navigate('ChildDetail' as any, { childId });
    };

    const handleAddChild = () => {
        navigate('LinkSubUser' as any, { role: userRole });
    };

    const renderChildItem = (child: ChildInfo) => (
        <TouchableOpacity
            key={child.id}
            style={styles.childCard}
            onPress={() => handleChildPress(child.id)}
            activeOpacity={0.7}
        >
            <View style={styles.childAvatar}>
                <Icon name="person" size={24} color={Colors.primary} />
            </View>
            <View style={styles.childInfo}>
                <View style={styles.nameRow}>
                    <Typography bold style={styles.childName}>{child.childName || '연결된 자녀'}</Typography>
                    {child.birthYear && (
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginRight: 8 }}>({child.birthYear}년생)</Typography>
                    )}
                    {child.status === 'LOCKED' && (
                        <View style={styles.lockedBadge}>
                            <Icon name="lock-closed" size={10} color="white" />
                            <Typography variant="caption" color="white" bold style={{ fontSize: 10, marginLeft: 2 }}>잠금 중</Typography>
                        </View>
                    )}
                </View>
                <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                    {child.deviceName || '등록된 기기 없음'} {child.deviceModel ? `(${child.deviceModel})` : ''}
                </Typography>
            </View>
            <Icon name="chevron-forward" size={20} color={Colors.border} />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Header title={userRole === 'TEACHER' ? '학생 관리' : '자녀 관리'} />

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={Colors.primary} />}
            >
                <Typography variant="h2" bold style={styles.heading}>
                    {userRole === 'TEACHER' ? '관리 중인 학생' : '관리 중인 자녀'}
                </Typography>

                {children.length > 0 ? (
                    <View style={styles.list}>
                        {children.map(renderChildItem)}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Icon name="people" size={48} color={Colors.textSecondary} />
                        </View>
                        <Typography variant="h2" color={Colors.textSecondary} style={{ marginTop: 16 }}>
                            {userRole === 'TEACHER' ? '등록된 학생이 없습니다.' : '등록된 자녀가 없습니다.'}
                        </Typography>
                        <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 8, textAlign: 'center' }}>
                            {userRole === 'TEACHER' ? '학생을 초대하여 출석과 기기 사용을 관리해보세요.' : '자녀의 기기를 연결하여 올바른 스마트폰 습관을 길러주세요.'}
                        </Typography>
                    </View>
                )}

                <TouchableOpacity style={styles.addButton} onPress={handleAddChild}>
                    <Icon name="add" size={24} color="white" />
                    <Typography bold color="white" style={{ marginLeft: 8 }}>
                        {userRole === 'TEACHER' ? '학생 추가하기' : '자녀 추가하기'}
                    </Typography>
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
    content: {
        padding: 20,
        paddingBottom: 40,
        flexGrow: 1,
    },
    list: {
        gap: 12,
        marginBottom: 24,
    },
    heading: {
        marginBottom: 16,
        color: Colors.text,
    },
    childCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    childAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    childInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    childName: {
        fontSize: 16,
        marginRight: 8,
    },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        padding: 18,
        borderRadius: 16,
        marginTop: 'auto',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
});
