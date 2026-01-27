import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { NativeLockControl } from '../services/NativeLockControl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export const AppSelectScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const insets = useSafeAreaInsets();
    const [apps, setApps] = useState<{ label: string, packageName: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadApps();
    }, []);

    const loadApps = async () => {
        try {
            const appList = await NativeLockControl.getInstalledApps();
            // Sort alphabetically
            appList.sort((a, b) => a.label.localeCompare(b.label));
            setApps(appList);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredApps = apps.filter(app =>
        app.label.toLowerCase().includes(search.toLowerCase()) ||
        app.packageName.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (app: { label: string, packageName: string }) => {
        (globalThis as any).selectedApp = app;
        navigate('AddSchedule');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigate('AddSchedule')} style={styles.headerButton}>
                    <Icon name="chevron-back" size={28} />
                </TouchableOpacity>
                <Typography variant="h2" bold>허용할 앱 선택</Typography>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchContainer}>
                <Icon name="search-outline" size={20} color={Colors.textSecondary} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="앱 이름 검색"
                    placeholderTextColor={Colors.textSecondary}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {filteredApps.map(app => (
                        <TouchableOpacity
                            key={app.packageName}
                            style={styles.appItem}
                            onPress={() => handleSelect(app)}
                        >
                            <View style={styles.appIconPlaceholder} />
                            <View style={styles.appInfo}>
                                <Typography bold>{app.label}</Typography>
                                <Typography variant="caption" color={Colors.textSecondary}>{app.packageName}</Typography>
                            </View>
                            <Icon name="chevron-forward" size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
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
        paddingHorizontal: 20,
        height: 56,
    },
    headerButton: {
        padding: 5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        marginHorizontal: 20,
        marginTop: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        height: 50,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchInput: {
        flex: 1,
        color: Colors.text,
        marginLeft: 10,
        fontSize: 16,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    appIconPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: Colors.card,
        marginRight: 15,
    },
    appInfo: {
        flex: 1,
    },
});
