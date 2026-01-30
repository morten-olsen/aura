import React from 'react';
import { Box, Text } from 'ink';

import { theme } from '../theme/theme.ts';

type BorderStyle = 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';

type PanelProps = {
  title?: string;
  children: React.ReactNode;
  borderColor?: string;
  borderStyle?: BorderStyle;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  width?: number | string;
  height?: number | string;
};

const Panel = ({
  title,
  children,
  borderColor = theme.colors.border,
  borderStyle = 'single',
  padding,
  paddingX = 1,
  paddingY = 0,
  width,
  height,
}: PanelProps): React.ReactElement => {
  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={borderColor}
      paddingX={padding ?? paddingX}
      paddingY={padding ?? paddingY}
      width={width}
      height={height}
    >
      {title && (
        <Box marginBottom={1}>
          <Text color={theme.colors.primary} bold>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
};

type SectionProps = {
  title?: string;
  children: React.ReactNode;
  marginTop?: number;
  marginBottom?: number;
};

const Section = ({ title, children, marginTop = 0, marginBottom = 0 }: SectionProps): React.ReactElement => {
  return (
    <Box flexDirection="column" marginTop={marginTop} marginBottom={marginBottom}>
      {title && (
        <Box marginBottom={1}>
          <Text color={theme.colors.secondary} bold>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
};

export type { PanelProps, SectionProps, BorderStyle };
export { Panel, Section };
