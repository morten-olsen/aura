import React from 'react';
import { Box, Text } from 'ink';

import { useListNavigation } from '../hooks/hook.shortcuts.ts';
import { theme } from '../theme/theme.ts';

type SelectOption<T> = {
  value: T;
  label: string;
};

type SelectProps<T> = {
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  isActive?: boolean;
};

const Select = <T extends string>({
  label,
  options,
  value,
  onChange,
  isActive = true,
}: SelectProps<T>): React.ReactElement => {
  const selectedIndex = options.findIndex((o) => o.value === value);

  useListNavigation({
    itemCount: options.length,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
    onSelect: (index) => {
      const option = options[index];
      if (option) {
        onChange(option.value);
      }
    },
    isActive,
    wrap: true,
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={0}>
        <Text color={theme.colors.muted}>{label}:</Text>
      </Box>
      <Box>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Box key={option.value} marginRight={2}>
              <Text color={isSelected ? theme.colors.highlight : theme.colors.text} bold={isSelected}>
                {isSelected ? '● ' : '○ '}
                {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

type InlineSelectProps<T> = {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

const InlineSelect = <T extends string>({ options, value }: InlineSelectProps<T>): React.ReactElement => {
  const currentIndex = options.findIndex((o) => o.value === value);
  const currentOption = options[currentIndex];

  return (
    <Box>
      <Text color={theme.colors.highlight} bold>
        [{currentOption?.label ?? 'Unknown'}]
      </Text>
      <Text color={theme.colors.muted}> (←/→ to change)</Text>
    </Box>
  );
};

export type { SelectOption, SelectProps, InlineSelectProps };
export { Select, InlineSelect };
