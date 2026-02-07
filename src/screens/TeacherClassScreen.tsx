import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Header } from '../components/Header';
import { Typography } from '../components/Typography';
import { Colors } from '../theme/Colors';
import { Icon } from '../components/Icon';
import { useAppNavigation } from '../navigation/NavigationContext';
import { apiService } from '../services/ApiService';

interface ClassItem {
    id: string;
    name: string;
    schedule: string;
    studentCount: number;
}

export const TeacherClassScreen: React.FC = () => {
    const { navigate } = useAppNavigation();
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [newClassSchedule, setNewClassSchedule] = useState('');

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            // Mock API call if backend not ready, or actual call
            // const response = await apiService.get<ClassItem[]>('/classes');
            // setClasses(response);

            // Mock Data for MVP verification
            setClasses([
                { id: '1', name: '중2 수학 A반', schedule: '월/수 18:00', studentCount: 15 },
                { id: '2', name: '고1 영어 심화', schedule: '화/목 19:30', studentCount: 8 },
            ]);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateClass = async () => {
        if (!newClassName.trim()) {
            Alert.alert("알림", "수업명을 입력해주세요.");
            return;
        }

        try {
            // await apiService.post('/classes', { name: newClassName, schedule: newClassSchedule });
            Alert.alert("성공", "수업이 생성되었습니다.");
            setIsCreating(false);
            fetchClasses();
        } catch (error) {
            Alert.alert("오류", "수업 생성 실패");
        }
    };

    return (
        <View style={styles.container}>
            <Header title="수업 관리" showBack />

            <ScrollView style={styles.flex1} contentContainerStyle={styles.content}>
                {isCreating ? (
                    <View style={styles.createForm}>
                        <Typography variant="h2" bold style={styles.formTitle}>새 수업 만들기</Typography>

                        <View style={styles.inputGroup}>
                            <Typography variant="caption" color={Colors.textSecondary}>수업명</Typography>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 중2 수학 A반"
                                placeholderTextColor={Colors.textSecondary}
                                value={newClassName}
                                onChangeText={setNewClassName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Typography variant="caption" color={Colors.textSecondary}>시간표 (선택)</Typography>
                            <TextInput
                                style={styles.input}
                                placeholder="예: 월/수 18:00"
                                placeholderTextColor={Colors.textSecondary}
                                value={newClassSchedule}
                                onChangeText={setNewClassSchedule}
                            />
                        </View>

                        <View style={styles.formActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setIsCreating(false)}>
                                <Typography color={Colors.textSecondary}>취소</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.submitButton} onPress={handleCreateClass}>
                                <Typography bold color="#FFF">생성하기</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={styles.listHeader}>
                            <Typography variant="h2" bold>내 수업 목록</Typography>
                            <TouchableOpacity style={styles.createButton} onPress={() => setIsCreating(true)}>
                                <Icon name="add" size={20} color={Colors.primary} />
                                <Typography color={Colors.primary} bold>수업 추가</Typography>
                            </TouchableOpacity>
                        </View>

                        {classes.map(cls => (
                            <TouchableOpacity key={cls.id} style={styles.classCard}>
                                <View>
                                    <Typography variant="body" bold>{cls.name}</Typography>
                                    <Typography variant="caption" color={Colors.textSecondary}>{cls.schedule}</Typography>
                                </View>
                                <View style={styles.badge}>
                                    <Icon name="people" size={14} color={Colors.textSecondary} />
                                    <Typography variant="caption" color={Colors.textSecondary}>{cls.studentCount}명</Typography>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    flex1: { flex: 1 },
    content: {
        padding: 20,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 8,
    },
    classCard: {
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    createForm: {
        backgroundColor: Colors.card,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    formTitle: {
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
        gap: 8,
    },
    input: {
        backgroundColor: Colors.background,
        padding: 12,
        borderRadius: 12,
        color: Colors.text,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
    cancelButton: {
        padding: 12,
    },
    submitButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    }
});
