import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { Colors } from '../../constants';

type TextVariant = 'body' | 'caption' | 'label' | 'title' | 'headline' | 'subheadline';
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
  children: React.ReactNode;
}

/** Central text component with theme support and a predefined typography scale. */
export default function ThemedText({
  variant = 'body',
  weight = 'regular',
  color,
  style,
  ...props
}: ThemedTextProps) {
  return (
    <Text
      style={[
        styles.base,
        styles[variant],
        styles[`weight_${weight}` as keyof typeof styles],
        color ? { color } : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: Colors.text },
  body: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 20, lineHeight: 28 },
  headline: { fontSize: 24, lineHeight: 32 },
  subheadline: { fontSize: 17, lineHeight: 22 },
  weight_regular: { fontWeight: '400' },
  weight_medium: { fontWeight: '500' },
  weight_semibold: { fontWeight: '600' },
  weight_bold: { fontWeight: '700' },
});
