import React, { useState } from 'react';
import { Box, Text } from 'ink';

import { useShortcuts } from '../hooks/hook.shortcuts.ts';
import { theme } from '../theme/theme.ts';

type ModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isVisible: boolean;
};

const Modal = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isVisible,
}: ModalProps): React.ReactElement | null => {
  const [selectedOption, setSelectedOption] = useState<'confirm' | 'cancel'>('confirm');

  useShortcuts(
    {
      left: () => setSelectedOption('confirm'),
      right: () => setSelectedOption('cancel'),
      h: () => setSelectedOption('confirm'),
      l: () => setSelectedOption('cancel'),
      return: () => {
        if (selectedOption === 'confirm') {
          onConfirm();
        } else if (onCancel) {
          onCancel();
        }
      },
      escape: () => {
        if (onCancel) {
          onCancel();
        }
      },
      y: onConfirm,
      n: () => {
        if (onCancel) {
          onCancel();
        }
      },
    },
    { isActive: isVisible },
  );

  if (!isVisible) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.colors.primary}
      paddingX={2}
      paddingY={1}
      marginX={2}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text color={theme.colors.primary} bold>
          {title}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={theme.colors.text}>{message}</Text>
      </Box>

      <Box>
        <Box marginRight={2}>
          <Text
            color={selectedOption === 'confirm' ? theme.colors.highlight : theme.colors.muted}
            bold={selectedOption === 'confirm'}
          >
            {selectedOption === 'confirm' ? '> ' : '  '}[{confirmLabel}]
          </Text>
        </Box>
        {onCancel && (
          <Box>
            <Text
              color={selectedOption === 'cancel' ? theme.colors.highlight : theme.colors.muted}
              bold={selectedOption === 'cancel'}
            >
              {selectedOption === 'cancel' ? '> ' : '  '}[{cancelLabel}]
            </Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.muted}>Press y/n or Enter to {selectedOption}, Esc to cancel</Text>
      </Box>
    </Box>
  );
};

type ConfirmModalProps = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isVisible: boolean;
};

const ConfirmModal = ({
  title,
  message,
  onConfirm,
  onCancel,
  isVisible,
}: ConfirmModalProps): React.ReactElement | null => {
  return (
    <Modal
      title={title}
      message={message}
      confirmLabel="Yes"
      cancelLabel="No"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isVisible={isVisible}
    />
  );
};

export type { ModalProps, ConfirmModalProps };
export { Modal, ConfirmModal };
