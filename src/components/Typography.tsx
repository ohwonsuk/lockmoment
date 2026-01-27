import React from 'react';
import { Text, StyleSheet, TextProps } from 'react-native';
import { Colors } from '../theme/Colors';

interface Props extends TextProps {
    variant?: 'h1' | 'h2' | 'body' | 'caption';
    color?: string;
    bold?: boolean;
}

export const Typography: React.FC<Props> = ({
    variant = 'body',
    color = Colors.text,
    bold = false,
    style,
    children,
    ...props
}) => {
    return (
        <Text
            style={[
                styles[variant],
                { color },
                bold && styles.bold,
                style
            ]}
            {...props}
        >
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    h1: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    h2: {
        fontSize: 18,
        fontWeight: '600',
    },
    body: {
        fontSize: 16,
    },
    caption: {
        fontSize: 14,
    },
    bold: {
        fontWeight: 'bold',
    },
});
