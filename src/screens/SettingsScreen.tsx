import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Header } from '../components/Header';
import { useAppNavigation } from '../navigation/NavigationContext';

import { Icon } from '../components/Icon';

const MenuItem: React.FC<{ title: string; onPress: () => void }> = ({ title, onPress }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <Typography variant="body">{title}</Typography>
        <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
);

export const SettingsScreen: React.FC = () => {
    const { navigate } = useAppNavigation();

    return (
        <View style={styles.container}>
            <Header showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <Typography variant="h1" bold style={styles.title}>환경설정</Typography>

                <View style={styles.section}>
                    <MenuItem title="앱 권한설정" onPress={() => navigate('Permissions')} />
                    <MenuItem title="잠금 기능 사용 이력" onPress={() => navigate('History')} />
                </View>

                <View style={styles.section}>
                    <MenuItem title="알림 설정" onPress={() => { }} />
                    <MenuItem title="도움말" onPress={() => { }} />
                    <MenuItem title="버전 정보" onPress={() => { }} />
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
        paddingBottom: 40,
    },
    title: {
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 20,
    },
    section: {
        backgroundColor: Colors.card,
        marginTop: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.border,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
});
