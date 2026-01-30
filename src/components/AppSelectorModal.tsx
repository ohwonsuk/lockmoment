import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, FlatList, Image, ActivityIndicator, TextInput, Platform } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../theme/Colors';
import { NativeLockControl } from '../services/NativeLockControl';

interface AppItem {
    label: string;
    packageName: string;
    icon?: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onConfirm: (selectedPackages: string[]) => void;
    initialSelection?: string[];
}

export const AppSelectorModal: React.FC<Props> = ({ visible, onClose, onConfirm, initialSelection = [] }) => {
    const [apps, setApps] = useState<AppItem[]>([]);
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set(initialSelection));
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (visible && apps.length === 0) {
            loadApps();
        }
        if (visible) {
            setSelectedApps(new Set(initialSelection));
        }
    }, [visible]);

    const loadApps = async () => {
        setLoading(true);
        try {
            const installedApps = await NativeLockControl.getInstalledApps();
            // Sort by label
            installedApps.sort((a: AppItem, b: AppItem) => a.label.localeCompare(b.label));
            setApps(installedApps);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleApp = (packageName: string) => {
        const newSet = new Set(selectedApps);
        if (newSet.has(packageName)) {
            newSet.delete(packageName);
        } else {
            newSet.add(packageName);
        }
        setSelectedApps(newSet);
    };

    const handleConfirm = () => {
        onConfirm(Array.from(selectedApps));
        onClose();
    };

    const filteredApps = apps.filter(app =>
        app.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }: { item: AppItem }) => {
        const isSelected = selectedApps.has(item.packageName);
        return (
            <TouchableOpacity style={styles.appItem} onPress={() => toggleApp(item.packageName)}>
                <View style={styles.appIconContainer}>
                    {item.icon ? (
                        <Image source={{ uri: `data:image/png;base64,${item.icon}` }} style={styles.appIcon} />
                    ) : (
                        <View style={[styles.appIcon, { backgroundColor: Colors.border }]} />
                    )}
                </View>
                <View style={styles.appInfo}>
                    <Typography variant="body">{item.label}</Typography>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Typography color="white" bold>✓</Typography>}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                <View style={styles.header}>
                    <Typography variant="h2" bold>잠글 앱 선택 ({selectedApps.size}개)</Typography>
                    <TouchableOpacity onPress={onClose}>
                        <Typography color={Colors.textSecondary}>닫기</Typography>
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="앱 검색..."
                        placeholderTextColor={Colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredApps}
                        renderItem={renderItem}
                        keyExtractor={item => item.packageName}
                        contentContainerStyle={styles.listContent}
                    />
                )}

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                        <Typography bold color="white">선택 완료</Typography>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    searchContainer: {
        padding: 10,
        backgroundColor: Colors.background,
    },
    searchInput: {
        backgroundColor: Colors.card,
        padding: 12,
        borderRadius: 10,
        color: Colors.text,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 20,
    },
    appItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border,
    },
    appIconContainer: {
        marginRight: 15,
    },
    appIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
    },
    appInfo: {
        flex: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    confirmButton: {
        backgroundColor: Colors.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    }
});
