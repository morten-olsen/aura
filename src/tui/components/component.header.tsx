import React from 'react';
import { Box, Text } from 'ink';

import { theme } from '../theme/theme.ts';

import { Spinner } from './component.spinner.tsx';

type HeaderProps = {
  title?: string;
  subtitle?: string;
  isConnected?: boolean;
  isLoading?: boolean;
};

const Header = ({
  title = 'Aura',
  subtitle,
  isConnected = false,
  isLoading = false,
}: HeaderProps): React.ReactElement => {
  return (
    <Box borderStyle="single" borderColor={theme.colors.border} paddingX={1} justifyContent="space-between">
      <Box>
        <Text color={theme.colors.primary} bold>
          {title}
        </Text>
        {subtitle && (
          <>
            <Text color={theme.colors.muted}> - </Text>
            <Text color={theme.colors.text}>{subtitle}</Text>
          </>
        )}
      </Box>

      <Box>
        {isLoading && (
          <Box marginRight={2}>
            <Spinner label="Loading" />
          </Box>
        )}
        <Text color={isConnected ? theme.colors.success : theme.colors.muted}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </Text>
      </Box>
    </Box>
  );
};

export type { HeaderProps };
export { Header };
