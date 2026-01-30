import { useEffect, useRef, useCallback } from 'react';

import type { StreamEvent, UnsubscribeFn } from '../tui.types.ts';
import { useClient, useAppDispatch } from '../state/state.context.tsx';
import { setConnected, updateTicket, setStepProgress, addToast } from '../state/state.ts';

import { createToast } from './hook.api.ts';

import type { Ticket } from '#root/tickets/tickets.schemas.ts';

type UseTicketStreamOptions = {
  ticketId: string;
  enabled?: boolean;
  onTicketUpdate?: (ticket: Ticket) => void;
  onError?: (error: string) => void;
};

type UseTicketStreamResult = {
  isConnected: boolean;
};

const useTicketStream = (options: UseTicketStreamOptions): UseTicketStreamResult => {
  const { ticketId, enabled = true, onTicketUpdate, onError } = options;
  const client = useClient();
  const dispatch = useAppDispatch();
  const unsubscribeRef = useRef<UnsubscribeFn | null>(null);
  const isConnectedRef = useRef(false);

  const handleEvent = useCallback(
    (event: StreamEvent): void => {
      switch (event.type) {
        case 'connected':
          isConnectedRef.current = true;
          dispatch(setConnected(true));
          break;

        case 'ticket':
          dispatch(updateTicket(event.ticket));
          if (onTicketUpdate) {
            onTicketUpdate(event.ticket);
          }
          break;

        case 'step_progress':
          dispatch(setStepProgress(event.data));
          break;

        case 'error':
          isConnectedRef.current = false;
          dispatch(setConnected(false));
          dispatch(addToast(createToast('error', event.error)));
          if (onError) {
            onError(event.error);
          }
          break;
      }
    },
    [dispatch, onTicketUpdate, onError],
  );

  useEffect(() => {
    if (!enabled || !ticketId) {
      return undefined;
    }

    // Subscribe to ticket stream
    unsubscribeRef.current = client.subscribeToTicket(ticketId, handleEvent);

    return (): void => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      isConnectedRef.current = false;
      dispatch(setConnected(false));
    };
  }, [client, ticketId, enabled, handleEvent, dispatch]);

  return {
    isConnected: isConnectedRef.current,
  };
};

type UseAutoRefreshOptions = {
  enabled?: boolean;
  interval?: number;
  onRefresh: () => Promise<void>;
};

const useAutoRefresh = (options: UseAutoRefreshOptions): void => {
  const { enabled = true, interval = 5000, onRefresh } = options;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const timer = setInterval(() => {
      onRefresh();
    }, interval);

    return (): void => {
      clearInterval(timer);
    };
  }, [enabled, interval, onRefresh]);
};

export type { UseTicketStreamOptions, UseTicketStreamResult, UseAutoRefreshOptions };
export { useTicketStream, useAutoRefresh };
