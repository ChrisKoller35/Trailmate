import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
}

export default function Input({
  label,
  error,
  secureTextEntry,
  multiline,
  ...props
}: InputProps) {
  const [isSecureHidden, setIsSecureHidden] = useState(true);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          error ? styles.inputError : undefined,
        ]}
      >
        <TextInput
          style={[styles.input, multiline && { textAlignVertical: 'top', minHeight: 80 }]}
          placeholderTextColor={Colors.textLight}
          secureTextEntry={secureTextEntry && isSecureHidden}
          multiline={multiline}
          {...props}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setIsSecureHidden((v) => !v)}
            hitSlop={8}
          >
            <Ionicons
              name={isSecureHidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textLight}
            />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: Colors.error,
  },
  error: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
});
