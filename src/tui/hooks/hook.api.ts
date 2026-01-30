import { useState, useEffect, useCallback } from 'react';

import type { ListFilters, Toast } from '../tui.types.ts';
import { useClient, useAppDispatch } from '../state/state.context.tsx';
import { setTickets, setCurrentTicket, setLoading, setError, addToast, updateTicket } from '../state/state.ts';

import type { Ticket } from '#root/tickets/tickets.schemas.ts';

const generateId = (): string => Math.random().toString(36).substring(2, 9);

const createToast = (type: Toast['type'], message: string): Toast => ({
  id: generateId(),
  type,
  message,
  duration: 3000,
});

type UseTicketsOptions = {
  filters?: ListFilters;
  autoFetch?: boolean;
};

type UseTicketsResult = {
  tickets: Ticket[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const useTickets = (options: UseTicketsOptions = {}): UseTicketsResult => {
  const { filters, autoFetch = true } = options;
  const client = useClient();
  const dispatch = useAppDispatch();
  const [tickets, setLocalTickets] = useState<Ticket[]>([]);
  const [isLoading, setLocalLoading] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);

  const fetchTickets = useCallback(async (): Promise<void> => {
    setLocalLoading(true);
    setLocalError(null);
    dispatch(setLoading(true));

    try {
      const data = await client.listTickets(filters);
      setLocalTickets(data);
      dispatch(setTickets(data));
      dispatch(setLoading(false));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tickets';
      setLocalError(message);
      dispatch(setError(message));
    } finally {
      setLocalLoading(false);
    }
  }, [client, dispatch, filters]);

  useEffect(() => {
    if (autoFetch) {
      fetchTickets();
    }
  }, [autoFetch, fetchTickets]);

  return {
    tickets,
    isLoading,
    error,
    refetch: fetchTickets,
  };
};

type UseTicketOptions = {
  ticketId: string;
  autoFetch?: boolean;
};

type UseTicketResult = {
  ticket: Ticket | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const useTicket = (options: UseTicketOptions): UseTicketResult => {
  const { ticketId, autoFetch = true } = options;
  const client = useClient();
  const dispatch = useAppDispatch();
  const [ticket, setLocalTicket] = useState<Ticket | null>(null);
  const [isLoading, setLocalLoading] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);

  const fetchTicket = useCallback(async (): Promise<void> => {
    setLocalLoading(true);
    setLocalError(null);
    dispatch(setLoading(true));

    try {
      const data = await client.getTicket(ticketId);
      setLocalTicket(data);
      dispatch(setCurrentTicket(data));
      dispatch(setLoading(false));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch ticket';
      setLocalError(message);
      dispatch(setError(message));
    } finally {
      setLocalLoading(false);
    }
  }, [client, dispatch, ticketId]);

  useEffect(() => {
    if (autoFetch && ticketId) {
      fetchTicket();
    }
  }, [autoFetch, ticketId, fetchTicket]);

  return {
    ticket,
    isLoading,
    error,
    refetch: fetchTicket,
  };
};

type UseTicketActionsResult = {
  approvePlan: (approvedBy: string) => Promise<void>;
  grantApproval: () => Promise<void>;
  denyApproval: () => Promise<void>;
  answerQuestion: (answer: string) => Promise<void>;
  startAgent: () => Promise<void>;
  cancelAgent: () => Promise<void>;
  isLoading: boolean;
};

const useTicketActions = (ticketId: string): UseTicketActionsResult => {
  const client = useClient();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    setIsLoading(true);
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      dispatch(addToast(createToast('error', message)));
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };

  const approvePlan = async (approvedBy: string): Promise<void> => {
    const ticket = await withLoading(() => client.approvePlan(ticketId, { approvedBy }));
    if (ticket) {
      dispatch(updateTicket(ticket));
      dispatch(addToast(createToast('success', 'Plan approved')));
    }
  };

  const grantApproval = async (): Promise<void> => {
    const result = await withLoading(() => client.grantApproval(ticketId));
    if (result) {
      dispatch(addToast(createToast('success', 'Approval granted')));
    }
  };

  const denyApproval = async (): Promise<void> => {
    const result = await withLoading(() => client.denyApproval(ticketId));
    if (result) {
      dispatch(addToast(createToast('info', 'Approval denied')));
    }
  };

  const answerQuestion = async (answer: string): Promise<void> => {
    const result = await withLoading(() => client.answerQuestion(ticketId, { answer }));
    if (result) {
      dispatch(addToast(createToast('success', 'Question answered')));
    }
  };

  const startAgent = async (): Promise<void> => {
    const result = await withLoading(() => client.startAgent(ticketId));
    if (result) {
      dispatch(addToast(createToast('info', 'Agent started')));
    }
  };

  const cancelAgent = async (): Promise<void> => {
    await withLoading(() => client.cancelAgent(ticketId));
    dispatch(addToast(createToast('info', 'Agent cancelled')));
  };

  return {
    approvePlan,
    grantApproval,
    denyApproval,
    answerQuestion,
    startAgent,
    cancelAgent,
    isLoading,
  };
};

export type { UseTicketsOptions, UseTicketsResult, UseTicketOptions, UseTicketResult, UseTicketActionsResult };
export { useTickets, useTicket, useTicketActions, createToast, generateId };
