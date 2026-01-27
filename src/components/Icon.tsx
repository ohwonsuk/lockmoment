import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/Colors';

export type IconName = 'settings-outline' | 'shield-checkmark-outline' | 'lock-closed' | 'add' | 'close' | 'chevron-forward' | 'chevron-back' | 'time-outline' | 'calendar-outline' | 'alert-circle-outline';

interface Props {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
}

export const Icon: React.FC<Props> = ({
    name,
    size = 24,
    color = Colors.text,
    style
}) => {
    return <Ionicons name={name} size={size} color={color} style={style} />;
};
