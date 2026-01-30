import React from 'react';
import { Box, Text } from 'ink';

import { theme } from '../theme/theme.ts';

type Column<T> = {
  key: string;
  header: string;
  width?: number;
  render?: (item: T, index: number) => React.ReactNode;
};

type TableProps<T> = {
  data: T[];
  columns: Column<T>[];
  selectedIndex?: number;
  onSelect?: (item: T, index: number) => void;
  emptyMessage?: string;
  showHeader?: boolean;
};

const Table = <T extends Record<string, unknown>>({
  data,
  columns,
  selectedIndex = -1,
  emptyMessage = 'No data',
  showHeader = true,
}: TableProps<T>): React.ReactElement => {
  if (data.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.colors.muted}>{emptyMessage}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {showHeader && (
        <Box>
          {columns.map((col, colIndex) => (
            <Box key={col.key} width={col.width} marginRight={colIndex < columns.length - 1 ? 2 : 0}>
              <Text color={theme.colors.muted} bold>
                {col.header}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {data.map((item, rowIndex) => {
        const isSelected = rowIndex === selectedIndex;

        return (
          <Box key={rowIndex}>
            {columns.map((col, colIndex) => {
              const content = col.render ? col.render(item, rowIndex) : String(item[col.key as keyof T] ?? '');

              return (
                <Box key={col.key} width={col.width} marginRight={colIndex < columns.length - 1 ? 2 : 0}>
                  {isSelected ? (
                    <Text color={theme.colors.highlight} bold>
                      {typeof content === 'string' ? content : content}
                    </Text>
                  ) : typeof content === 'string' ? (
                    <Text color={theme.colors.text}>{content}</Text>
                  ) : (
                    content
                  )}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};

type ListItemProps = {
  children: React.ReactNode;
  isSelected?: boolean;
  prefix?: string;
};

const ListItem = ({ children, isSelected = false, prefix = '' }: ListItemProps): React.ReactElement => {
  const indicator = isSelected ? '>' : ' ';

  return (
    <Box>
      <Text color={isSelected ? theme.colors.highlight : theme.colors.muted}>
        {indicator} {prefix}
      </Text>
      {isSelected ? (
        <Text color={theme.colors.highlight} bold>
          {children}
        </Text>
      ) : (
        <Text color={theme.colors.text}>{children}</Text>
      )}
    </Box>
  );
};

export type { Column, TableProps, ListItemProps };
export { Table, ListItem };
