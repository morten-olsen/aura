import React, { useEffect } from 'react';
import { Box, Text } from 'ink';

import type { Toast, ToastType } from '../tui.types.ts';
import { useAppDispatch } from '../state/state.context.tsx';
import { removeToast } from '../state/state.ts';
import { theme } from '../theme/theme.ts';

const toastColors: Record<ToastType, string> = {
  info: theme.colors.primary,
  success: theme.colors.success,
  error: theme.colors.error,
  warning: theme.colors.warning,
};

const toastIcons: Record<ToastType, string> = {
  info: 'i',
  success: '✓',
  error: '✗',
  warning: '!',
};

type ToastItemProps = {
  toast: Toast;
};

const ToastItem = ({ toast }: ToastItemProps): React.ReactElement => {
  const dispatch = useAppDispatch();
  const color = toastColors[toast.type];
  const icon = toastIcons[toast.type];

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        dispatch(removeToast(toast.id));
      }, toast.duration);

      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [dispatch, toast.id, toast.duration]);

  return (
    <Box>
      <Text color={color} bold>
        [{icon}]
      </Text>
      <Text color={theme.colors.text}> {toast.message}</Text>
    </Box>
  );
};

type ToastContainerProps = {
  toasts: Toast[];
  maxVisible?: number;
};

const ToastContainer = ({ toasts, maxVisible = 3 }: ToastContainerProps): React.ReactElement | null => {
  if (toasts.length === 0) {
    return null;
  }

  const visibleToasts = toasts.slice(-maxVisible);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.colors.border} paddingX={1} marginX={1}>
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </Box>
  );
};

export type { ToastItemProps, ToastContainerProps };
export { ToastItem, ToastContainer, toastColors, toastIcons };
