import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { Icon } from './Icon';
import { StorageService } from '../services/StorageService';

export interface ContextItem {
    type: 'SELF' | 'CHILD' | 'STUDENT' | 'PARENT' | 'TEACHER' | 'ORG_ADMIN' | 'ORG_STAFF';
    id?: string;
    name: string;
    subName?: string; // 예: "OO수학학원", "자녀"
}

interface ContextSwitcherProps {
    onContextChange?: (context: ContextItem) => void;
}

export const ContextSwitcher: React.FC<ContextSwitcherProps> = ({ onContextChange }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentContext, setCurrentContext] = useState<ContextItem>({ type: 'SELF', name: '나' });
    const [contexts, setContexts] = useState<ContextItem[]>([]);

    useEffect(() => {
        loadContexts();
    }, []);

    const loadContexts = async () => {
        const active = await StorageService.getActiveContext();
        const profile = await StorageService.getUserProfile();
        const userRole = await StorageService.getUserRole();

        const list: ContextItem[] = [{
            type: 'SELF',
            name: '나',
            subName: '사용자'
        }];

        // 부모/자녀 관계가 있거나 PARENT 역할인 경우 '부모' 컨텍스트 추가
        if (userRole === 'PARENT' || (profile?.relations?.children && profile.relations.children.length > 0)) {
            list.push({ type: 'PARENT', name: '부모', subName: '가정 관리' });
        }

        // 교사 역할인 경우 '교사' 컨텍스트 추가
        if (userRole === 'TEACHER' || profile?.relations?.organizations?.some((o: any) => o.role === 'TEACHER')) {
            list.push({ type: 'TEACHER', name: '교사', subName: '수업 관리' });
        }

        // 기관 관리자/운영자
        if (userRole === 'ORG_ADMIN') {
            list.push({ type: 'ORG_ADMIN', name: '기관 총관리자', subName: '운영/정책' });
        }
        if (userRole === 'ORG_STAFF') {
            list.push({ type: 'ORG_STAFF', name: '기관 운영자', subName: '운영' });
        }

        // 자녀/학생 본인인 경우
        if (userRole === 'CHILD') {
            list.push({ type: 'CHILD', name: '자녀', subName: '관리 대상' });
        }
        if (userRole === 'STUDENT') {
            list.push({ type: 'STUDENT', name: '학생', subName: '관리 대상' });
        }

        setContexts(list);

        // 현재 선택된 컨텍스트 찾기
        if (active) {
            const found = list.find(l => l.type === active.type);
            if (found) {
                setCurrentContext(found);
                return;
            }
        }

        // 기본값: '나'
        setCurrentContext(list[0]);
        await StorageService.setActiveContext({ type: 'SELF' });
    };

    const handleSelect = async (item: ContextItem) => {
        setCurrentContext(item);
        await StorageService.setActiveContext({ type: item.type, id: item.id });
        setIsVisible(false);
        if (onContextChange) onContextChange(item);
    };

    return (
        <View>
            <TouchableOpacity style={styles.selector} onPress={() => setIsVisible(true)}>
                <View style={styles.selectorLeft}>
                    <Icon name={currentContext.type === 'SELF' ? 'person-circle' : 'people'} size={22} color={Colors.primary} />
                    <View style={styles.nameContainer}>
                        <Typography bold style={styles.currentName}>{currentContext.name}</Typography>
                        <Typography variant="caption" color={Colors.primary} style={styles.roleLabel}>{currentContext.subName}</Typography>
                    </View>
                </View>
                <Icon name="chevron-down" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>

            <Modal visible={isVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setIsVisible(false)}>
                    <View style={styles.modalContent}>
                        <Typography variant="h2" bold style={styles.modalTitle}>관리 대상 선택</Typography>
                        <ScrollView style={styles.contextList}>
                            {contexts.map((item, idx) => (
                                <TouchableOpacity
                                    key={`${item.type}-${item.id || idx}`}
                                    style={[styles.contextItem, currentContext.id === item.id && currentContext.type === item.type && styles.selectedItem]}
                                    onPress={() => handleSelect(item)}
                                >
                                    <View style={styles.itemInfo}>
                                        <Typography bold color={currentContext.id === item.id && currentContext.type === item.type ? Colors.primary : Colors.text}>
                                            {item.name}
                                        </Typography>
                                        <Typography variant="caption" color={Colors.textSecondary}>{item.subName || '본인'}</Typography>
                                    </View>
                                    {currentContext.id === item.id && currentContext.type === item.type && (
                                        <Icon name="checkmark" size={20} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: Colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
        minWidth: 120,
    },
    selectorLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameContainer: {
        marginLeft: 8,
        marginRight: 4,
    },
    currentName: {
        fontSize: 14,
    },
    roleLabel: {
        fontSize: 10,
        marginTop: -2,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: Colors.background,
        borderRadius: 16,
        padding: 20,
        maxHeight: '60%',
    },
    modalTitle: {
        marginBottom: 16,
    },
    contextList: {
        width: '100%',
    },
    contextItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    selectedItem: {
        backgroundColor: Colors.card,
    },
    itemInfo: {
        flex: 1,
    },
});
