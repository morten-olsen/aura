import React, { useCallback } from 'react';
import { Box, Text } from 'ink';

import { useAppState, useAppDispatch } from '../state/state.context.tsx';
import { setSelectedIndex } from '../state/state.ts';
import { useTickets } from '../hooks/hook.api.ts';
import { useNavigation } from '../hooks/hook.navigation.ts';
import { useListNavigation, useShortcuts } from '../hooks/hook.shortcuts.ts';
import { Header } from '../components/component.header.tsx';
import { Footer } from '../components/component.footer.tsx';
import { StatusBadge, PriorityBadge } from '../components/component.badge.tsx';
import { Spinner } from '../components/component.spinner.tsx';
import { theme } from '../theme/theme.ts';

import type { Ticket } from '#root/tickets/tickets.schemas.ts';

type TicketRowProps = {
  ticket: Ticket;
  isSelected: boolean;
};

const TicketRow = ({ ticket, isSelected }: TicketRowProps): React.ReactElement => {
  const indicator = isSelected ? '>' : ' ';
  const titleColor = isSelected ? theme.colors.highlight : theme.colors.text;

  return (
    <Box>
      <Box width={3}>
        <Text color={isSelected ? theme.colors.highlight : theme.colors.muted}>{indicator}</Text>
      </Box>
      <Box width={10}>
        <Text color={theme.colors.muted}>{ticket.id.substring(0, 8)}</Text>
      </Box>
      <Box width={18}>
        <StatusBadge status={ticket.status} />
      </Box>
      <Box width={10}>
        <PriorityBadge priority={ticket.priority} />
      </Box>
      <Box flexGrow={1}>
        <Text color={titleColor} bold={isSelected}>
          {ticket.title}
        </Text>
      </Box>
    </Box>
  );
};

const DashboardScreen = (): React.ReactElement => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { navigateToTicket, navigateToCreate, navigateToHelp } = useNavigation();
  const { tickets, isLoading, error, refetch } = useTickets({
    filters: state.filters,
  });

  const handleSelect = useCallback(
    (index: number): void => {
      dispatch(setSelectedIndex(index));
    },
    [dispatch],
  );

  const handleActivate = useCallback(
    (index: number): void => {
      const ticket = tickets[index];
      if (ticket) {
        navigateToTicket(ticket.id);
      }
    },
    [tickets, navigateToTicket],
  );

  useListNavigation({
    itemCount: tickets.length,
    selectedIndex: state.selectedTicketIndex,
    onSelect: handleSelect,
    onActivate: handleActivate,
    wrap: true,
  });

  useShortcuts({
    n: navigateToCreate,
    r: refetch,
    '?': navigateToHelp,
  });

  const shortcuts = [
    { key: '↑↓', label: 'Navigate' },
    { key: 'Enter', label: 'View' },
    { key: 'n', label: 'New' },
    { key: 'r', label: 'Refresh' },
    { key: '?', label: 'Help' },
    { key: 'q', label: 'Quit' },
  ];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Header title="Aura" subtitle="Dashboard" isConnected={state.isConnected} isLoading={isLoading} />

      <Box flexDirection="column" paddingX={1} marginTop={1} flexGrow={1}>
        {error && (
          <Box marginBottom={1}>
            <Text color={theme.colors.error}>Error: {error}</Text>
          </Box>
        )}

        {isLoading && tickets.length === 0 ? (
          <Box paddingY={2}>
            <Spinner label="Loading tickets..." />
          </Box>
        ) : tickets.length === 0 ? (
          <Box paddingY={2}>
            <Text color={theme.colors.muted}>No tickets found. Press 'n' to create a new ticket.</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Box width={3} />
              <Box width={10}>
                <Text color={theme.colors.muted} bold>
                  ID
                </Text>
              </Box>
              <Box width={18}>
                <Text color={theme.colors.muted} bold>
                  STATUS
                </Text>
              </Box>
              <Box width={10}>
                <Text color={theme.colors.muted} bold>
                  PRIORITY
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text color={theme.colors.muted} bold>
                  TITLE
                </Text>
              </Box>
            </Box>

            {tickets.map((ticket, index) => (
              <TicketRow key={ticket.id} ticket={ticket} isSelected={index === state.selectedTicketIndex} />
            ))}

            <Box marginTop={1}>
              <Text color={theme.colors.muted}>
                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                {state.selectedTicketIndex >= 0 && tickets.length > 0 && (
                  <Text>
                    {' '}
                    ({state.selectedTicketIndex + 1}/{tickets.length})
                  </Text>
                )}
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      <Footer shortcuts={shortcuts} />
    </Box>
  );
};

export { DashboardScreen };
