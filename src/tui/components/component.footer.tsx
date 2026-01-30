import React from 'react';
import { Box, Text } from 'ink';

import { theme } from '../theme/theme.ts';

type Shortcut = {
  key: string;
  label: string;
};

type FooterProps = {
  shortcuts?: Shortcut[];
};

const defaultShortcuts: Shortcut[] = [
  { key: 'q', label: 'Quit' },
  { key: '?', label: 'Help' },
];

const Footer = ({ shortcuts = defaultShortcuts }: FooterProps): React.ReactElement => {
  return (
    <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1}>
      {shortcuts.map((shortcut, index) => (
        <Box key={shortcut.key} marginRight={index < shortcuts.length - 1 ? 2 : 0}>
          <Text color={theme.colors.highlight} bold>
            {shortcut.key}
          </Text>
          <Text color={theme.colors.muted}>:</Text>
          <Text color={theme.colors.text}>{shortcut.label}</Text>
        </Box>
      ))}
    </Box>
  );
};

export type { FooterProps, Shortcut };
export { Footer, defaultShortcuts };
