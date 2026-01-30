import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

import { theme } from '../theme/theme.ts';

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
  multiline?: boolean;
};

const Input = ({ label, value, onChange, placeholder = '', focus = true }: InputProps): React.ReactElement => {
  return (
    <Box flexDirection="column">
      <Box marginBottom={0}>
        <Text color={theme.colors.muted}>{label}:</Text>
      </Box>
      <Box>
        <Text color={theme.colors.highlight}>&gt; </Text>
        <TextInput value={value} onChange={onChange} placeholder={placeholder} focus={focus} />
      </Box>
    </Box>
  );
};

type TextAreaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
  rows?: number;
};

const TextArea = ({ label, value, onChange, placeholder = '', focus = true }: TextAreaProps): React.ReactElement => {
  // ink-text-input doesn't support true multiline, but we can display it
  // For now, use single-line input with hint about newlines
  return (
    <Box flexDirection="column">
      <Box marginBottom={0}>
        <Text color={theme.colors.muted}>{label}:</Text>
      </Box>
      <Box>
        <Text color={theme.colors.highlight}>&gt; </Text>
        <TextInput value={value} onChange={onChange} placeholder={placeholder} focus={focus} />
      </Box>
    </Box>
  );
};

type FormFieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

const FormField = ({ label, error, children }: FormFieldProps): React.ReactElement => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={0}>
        <Text color={theme.colors.text} bold>
          {label}
        </Text>
      </Box>
      {children}
      {error && (
        <Box marginTop={0}>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}
    </Box>
  );
};

export type { InputProps, TextAreaProps, FormFieldProps };
export { Input, TextArea, FormField };
