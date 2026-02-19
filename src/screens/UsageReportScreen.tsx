import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { BarChart } from "react-native-gifted-charts";
import { Colors } from '../theme/Colors';
import { Typography } from '../components/Typography';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { useAppNavigation, useAppRoute } from '../navigation/NavigationContext';
import { ParentChildService } from '../services/ParentChildService';

export const UsageReportScreen: React.FC = () => {
    const { goBack } = useAppNavigation();
    const route = useAppRoute();
    const childId = (route.params as any)?.childId;

    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalUsage: 0, limit: 0 });

    useEffect(() => {
        if (childId) {
            loadData();
        }
    }, [childId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [report, currentStats] = await Promise.all([
                ParentChildService.getChildUsageReport(childId),
                ParentChildService.getChildUsageStats(childId)
            ]);
            setReportData(report);
            setStats(currentStats);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Format data for Gifted Charts
    const chartData = reportData.map((item, index) => {
        const date = new Date(item.date);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const label = dayNames[date.getDay()];

        return {
            value: item.minutes,
            label: label,
            frontColor: index === reportData.length - 1 ? Colors.primary : Colors.textSecondary + '40',
            topLabelComponent: () => (
                <Typography variant="caption" style={{ marginBottom: 4, fontSize: 10 }}>
                    {item.minutes >= 60 ? `${Math.floor(item.minutes / 60)}h` : `${item.minutes}m`}
                </Typography>
            ),
        };
    });

    const totalMinutes = reportData.reduce((acc, curr) => acc + curr.minutes, 0);
    const avgMinutes = reportData.length > 0 ? Math.round(totalMinutes / reportData.length) : 0;

    return (
        <View style={styles.container}>
            <Header title="사용 리포트" showBack onBack={goBack} />

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <>
                        {/* Summary Section */}
                        <View style={styles.summaryCard}>
                            <Typography variant="h2" bold style={{ marginBottom: 16 }}>집중 요약</Typography>
                            <View style={styles.statsGrid}>
                                <View style={styles.statItem}>
                                    <Typography variant="caption" color={Colors.textSecondary}>최근 7일 총 집중</Typography>
                                    <Typography variant="h1" bold color={Colors.primary} style={{ marginTop: 4 }}>
                                        {Math.floor(totalMinutes / 60)}시간 {totalMinutes % 60}분
                                    </Typography>
                                </View>
                                <View style={styles.statItem}>
                                    <Typography variant="caption" color={Colors.textSecondary}>일평균 집중 시간</Typography>
                                    <Typography variant="h1" bold color={Colors.primary} style={{ marginTop: 4 }}>
                                        {Math.floor(avgMinutes / 60)}시간 {avgMinutes % 60}분
                                    </Typography>
                                </View>
                            </View>
                        </View>

                        {/* Chart Section */}
                        <View style={styles.chartCard}>
                            <Typography variant="h2" bold style={{ marginBottom: 24 }}>주간 집중 추이</Typography>
                            <View style={styles.chartWrapper}>
                                <BarChart
                                    data={chartData}
                                    barWidth={28}
                                    spacing={20}
                                    noOfSections={3}
                                    barBorderRadius={6}
                                    frontColor={Colors.primary}
                                    yAxisThickness={0}
                                    xAxisThickness={0}
                                    hideRules
                                    yAxisTextStyle={{ color: Colors.textSecondary, fontSize: 10 }}
                                    xAxisLabelTextStyle={{ color: Colors.textSecondary, fontSize: 11 }}
                                    height={180}
                                    width={Dimensions.get('window').width - 100}
                                    isAnimated
                                />
                            </View>
                        </View>

                        {/* Insight Section */}
                        <View style={styles.insightCard}>
                            <View style={styles.insightHeader}>
                                <Icon name="bulb" size={20} color={Colors.primary} />
                                <Typography bold color={Colors.primary} style={{ marginLeft: 8 }}>AI 인사이트</Typography>
                            </View>
                            <Typography variant="body" style={{ color: Colors.text, opacity: 0.9, lineHeight: 22 }}>
                                {avgMinutes > 60
                                    ? "자녀가 규칙적으로 집중 시간을 잘 가지고 있습니다. 주말에는 충분한 휴식을 통해 보상을 해주시면 더욱 좋습니다!"
                                    : "최근 집중 시간이 다소 일정하지 않습니다. 집중이 가장 잘 되는 시간을 찾아 규칙적인 스케줄을 추가해 보세요."}
                            </Typography>
                        </View>

                        {/* Tip Section */}
                        <TouchableOpacity style={styles.tipCard}>
                            <View style={{ flex: 1 }}>
                                <Typography bold style={{ marginBottom: 4 }}>효율적인 습관 만들기</Typography>
                                <Typography variant="caption" color={Colors.textSecondary}>자녀와 함께 목표를 세우면 더 효과적입니다.</Typography>
                            </View>
                            <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
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
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    center: {
        marginTop: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        flex: 1,
    },
    chartCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    chartWrapper: {
        alignItems: 'center',
        marginLeft: -20, // Offset for Y-axis labels
    },
    insightCard: {
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        borderLeftWidth: 6,
        borderLeftColor: Colors.primary,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    tipCard: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    }
});
