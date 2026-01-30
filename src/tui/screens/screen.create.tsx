import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

import { useClient, useAppDispatch, useAppState } from '../state/state.context.tsx';
import { addToast } from '../state/state.ts';
import { createToast } from '../hooks/hook.api.ts';
import { useNavigation } from '../hooks/hook.navigation.ts';
import { useShortcuts } from '../hooks/hook.shortcuts.ts';
import { Header } from '../components/component.header.tsx';
import { Footer } from '../components/component.footer.tsx';
import { Spinner } from '../components/component.spinner.tsx';
import { ToastContainer } from '../components/component.toast.tsx';
import { theme } from '../theme/theme.ts';

import type { TicketPriority } from '#root/database/database.schemas.ts';

type FormField = 'title' | 'description' | 'priority';

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const CreateScreen = (): React.ReactElement => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const client = useClient();
  const { navigateBack, navigateToTicket } = useNavigation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [activeField, setActiveField] = useState<FormField>('title');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<FormField, string>> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitForm = useCallback(async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await client.createTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
      });

      dispatch(addToast(createToast('success', 'Ticket created successfully')));
      navigateToTicket(ticket.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create ticket';
      dispatch(addToast(createToast('error', message)));
    } finally {
      setIsSubmitting(false);
    }
  }, [client, dispatch, title, description, priority, navigateToTicket]);

  const fields: FormField[] = ['title', 'description', 'priority'];

  const nextField = useCallback((): void => {
    const currentIndex = fields.indexOf(activeField);
    const nextIndex = (currentIndex + 1) % fields.length;
    const nextFieldValue = fields[nextIndex];
    if (nextFieldValue) {
      setActiveField(nextFieldValue);
    }
  }, [activeField, fields]);

  const cyclePriority = useCallback(
    (direction: 1 | -1): void => {
      const currentIndex = priorityOptions.findIndex((p) => p.value === priority);
      const nextIndex = (currentIndex + direction + priorityOptions.length) % priorityOptions.length;
      const nextOption = priorityOptions[nextIndex];
      if (nextOption) {
        setPriority(nextOption.value);
      }
    },
    [priority],
  );

  useShortcuts(
    {
      escape: navigateBack,
      tab: nextField,
      s: () => {
        submitForm();
      },
    },
    { isActive: !isSubmitting },
  );

  // Handle priority field navigation
  useShortcuts(
    {
      left: () => cyclePriority(-1),
      right: () => cyclePriority(1),
      h: () => cyclePriority(-1),
      l: () => cyclePriority(1),
    },
    { isActive: activeField === 'priority' && !isSubmitting },
  );

  const shortcuts = [
    { key: 'Tab', label: 'Next Field' },
    { key: 'Ctrl+S', label: 'Submit' },
    { key: 'Esc', label: 'Cancel' },
  ];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Header title="Aura" subtitle="Create Ticket" isLoading={isSubmitting} />

      <Box flexDirection="column" paddingX={1} marginTop={1} flexGrow={1}>
        {/* Title Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={activeField === 'title' ? theme.colors.highlight : theme.colors.muted}>
              {activeField === 'title' ? '> ' : '  '}
            </Text>
            <Text color={theme.colors.text} bold>
              Title
            </Text>
            {errors.title && <Text color={theme.colors.error}> ({errors.title})</Text>}
          </Box>
          <Box marginLeft={2}>
            {activeField === 'title' ? (
              <TextInput
                value={title}
                onChange={setTitle}
                placeholder="Enter ticket title..."
                focus={activeField === 'title'}
                onSubmit={nextField}
              />
            ) : (
              <Text color={title ? theme.colors.text : theme.colors.muted}>{title || 'Enter ticket title...'}</Text>
            )}
          </Box>
        </Box>

        {/* Description Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={activeField === 'description' ? theme.colors.highlight : theme.colors.muted}>
              {activeField === 'description' ? '> ' : '  '}
            </Text>
            <Text color={theme.colors.text} bold>
              Description
            </Text>
            {errors.description && <Text color={theme.colors.error}> ({errors.description})</Text>}
          </Box>
          <Box marginLeft={2}>
            {activeField === 'description' ? (
              <TextInput
                value={description}
                onChange={setDescription}
                placeholder="Describe what needs to be done..."
                focus={activeField === 'description'}
                onSubmit={nextField}
              />
            ) : (
              <Text color={description ? theme.colors.text : theme.colors.muted}>
                {description || 'Describe what needs to be done...'}
              </Text>
            )}
          </Box>
        </Box>

        {/* Priority Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={activeField === 'priority' ? theme.colors.highlight : theme.colors.muted}>
              {activeField === 'priority' ? '> ' : '  '}
            </Text>
            <Text color={theme.colors.text} bold>
              Priority
            </Text>
            {activeField === 'priority' && <Text color={theme.colors.muted}> (use ←/→ to change)</Text>}
          </Box>
          <Box marginLeft={2}>
            {priorityOptions.map((option) => {
              const isSelected = option.value === priority;
              return (
                <Box key={option.value} marginRight={2}>
                  <Text color={isSelected ? theme.colors.highlight : theme.colors.muted} bold={isSelected}>
                    {isSelected ? '●' : '○'} {option.label}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Submit Button */}
        <Box marginTop={1}>
          <Box borderStyle="single" borderColor={theme.colors.primary} paddingX={2}>
            {isSubmitting ? (
              <Spinner label="Creating ticket..." />
            ) : (
              <Text
                color={theme.colors.primary}
                bold
                // Note: Can't actually make this clickable in terminal
              >
                Press Ctrl+S to Submit
              </Text>
            )}
          </Box>
        </Box>

        {/* Help Text */}
        <Box marginTop={1}>
          <Text color={theme.colors.muted}>Press Tab to move between fields, Ctrl+S to submit, Esc to cancel</Text>
        </Box>
      </Box>

      {/* Toasts */}
      {state.toasts.length > 0 && <ToastContainer toasts={state.toasts} />}

      <Footer shortcuts={shortcuts} />
    </Box>
  );
};

export { CreateScreen };
