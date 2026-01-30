import type { UnsubscribeFn } from '../tui.types.ts';

import type { AuraClient, AuraClientConfig, ListTicketsFilters, StreamEventHandler } from './client.ts';

import type {
  Ticket,
  CreateTicketInput,
  ApproveTicketInput,
  AnswerQuestionInput,
} from '#root/tickets/tickets.schemas.ts';
import type { AgentRunResult } from '#root/agent/agent.schemas.ts';

class HttpClientError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'HttpClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const createHttpClient = (config: AuraClientConfig): AuraClient => {
  const { baseUrl, timeout = 30000 } = config;

  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const url = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
        throw new HttpClientError(
          errorData.error?.message ?? `HTTP ${response.status}`,
          errorData.error?.code ?? 'HTTP_ERROR',
          response.status,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const listTickets = async (filters?: ListTicketsFilters): Promise<Ticket[]> => {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.set('status', filters.status);
    }
    const query = params.toString();
    const path = query ? `/api/tickets?${query}` : '/api/tickets';
    return request<Ticket[]>('GET', path);
  };

  const getTicket = async (id: string): Promise<Ticket> => {
    return request<Ticket>('GET', `/api/tickets/${id}`);
  };

  const createTicket = async (data: CreateTicketInput): Promise<Ticket> => {
    return request<Ticket>('POST', '/api/tickets', data);
  };

  const updateTicket = async (id: string, data: Partial<CreateTicketInput>): Promise<Ticket> => {
    return request<Ticket>('PATCH', `/api/tickets/${id}`, data);
  };

  const deleteTicket = async (id: string): Promise<void> => {
    await request<undefined>('DELETE', `/api/tickets/${id}`);
  };

  const approvePlan = async (id: string, input: ApproveTicketInput): Promise<Ticket> => {
    return request<Ticket>('POST', `/api/tickets/${id}/approve`, input);
  };

  const grantApproval = async (id: string): Promise<AgentRunResult> => {
    return request<AgentRunResult>('POST', `/api/tickets/${id}/approval/grant`);
  };

  const denyApproval = async (id: string): Promise<AgentRunResult> => {
    return request<AgentRunResult>('POST', `/api/tickets/${id}/approval/deny`);
  };

  const answerQuestion = async (id: string, input: AnswerQuestionInput): Promise<AgentRunResult> => {
    return request<AgentRunResult>('POST', `/api/tickets/${id}/answer`, input);
  };

  const startAgent = async (ticketId: string): Promise<AgentRunResult> => {
    return request<AgentRunResult>('POST', `/api/tickets/${ticketId}/agent/start`);
  };

  const cancelAgent = async (ticketId: string): Promise<void> => {
    await request<undefined>('POST', `/api/tickets/${ticketId}/agent/cancel`);
  };

  const subscribeToTicket = (id: string, handler: StreamEventHandler): UnsubscribeFn => {
    const url = `${baseUrl}/api/tickets/${id}/stream`;
    const eventSource = new EventSource(url);
    let isConnected = false;

    eventSource.addEventListener('connected', (event) => {
      isConnected = true;
      const data = JSON.parse(event.data) as { ticketId: string };
      handler({ type: 'connected', ticketId: data.ticketId });
    });

    eventSource.addEventListener('ticket', (event) => {
      const ticket = JSON.parse(event.data) as Ticket;
      handler({ type: 'ticket', ticket });
    });

    eventSource.addEventListener('step_progress', (event) => {
      const data = JSON.parse(event.data) as {
        currentStepIndex: number;
        totalSteps: number;
        completedSteps: number;
        currentStepTitle: string | null;
      };
      handler({ type: 'step_progress', data });
    });

    eventSource.onerror = () => {
      if (isConnected) {
        handler({ type: 'error', error: 'Connection lost' });
      }
    };

    return (): void => {
      eventSource.close();
    };
  };

  return {
    listTickets,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    approvePlan,
    grantApproval,
    denyApproval,
    answerQuestion,
    startAgent,
    cancelAgent,
    subscribeToTicket,
  };
};

export { createHttpClient, HttpClientError };
