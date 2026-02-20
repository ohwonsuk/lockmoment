import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { Icon } from './Icon';
import { StorageService } from '../services/StorageService';

export interface ContextItem {
    type: 'SELF' | 'CHILD' | 'STUDENT';
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

        const list: ContextItem[] = [{ type: 'SELF', name: '나' }];

        if (profile?.relations) {
            profile.relations.children?.forEach((c: any) => {
                list.push({ type: 'CHILD', id: c.id, name: c.nickname || c.display_name, subName: '자녀' });
            });
            profile.relations.organizations?.forEach((o: any) => {
                list.push({ type: 'STUDENT', id: o.id, name: o.name, subName: o.role === 'TEACHER' ? '학생 관리' : '기관' });
            });
        }

        setContexts(list);

        // 현재 선택된 컨텍스트 찾기
        if (active) {
            const found = list.find(l => l.type === active.type && l.id === active.id);
            if (found) setCurrentContext(found);
        }
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
                    <Icon name={currentContext.type === 'SELF' ? 'person-circle-outline' : 'people-outline'} size={20} color={Colors.primary} />
                    <Typography bold style={styles.currentName}>{currentContext.name}</Typography>
                    {currentContext.subName && (
                        <View style={styles.tag}>
                            <Typography variant="caption" color="white">{currentContext.subName}</Typography>
                        </View>
                    )}
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
    currentName: {
        marginLeft: 6,
        marginRight: 4,
    },
    tag: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
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
