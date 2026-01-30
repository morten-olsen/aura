import type { UnsubscribeFn, StreamEvent } from '../tui.types.ts';

import type {
  Ticket,
  CreateTicketInput,
  ApproveTicketInput,
  AnswerQuestionInput,
} from '#root/tickets/tickets.schemas.ts';
import type { AgentRunResult } from '#root/agent/agent.schemas.ts';
import type { TicketStatus } from '#root/database/database.schemas.ts';

type ListTicketsFilters = {
  status?: TicketStatus;
};

type StreamEventHandler = (event: StreamEvent) => void;

type AuraClient = {
  listTickets: (filters?: ListTicketsFilters) => Promise<Ticket[]>;
  getTicket: (id: string) => Promise<Ticket>;
  createTicket: (data: CreateTicketInput) => Promise<Ticket>;
  updateTicket: (id: string, data: Partial<CreateTicketInput>) => Promise<Ticket>;
  deleteTicket: (id: string) => Promise<void>;
  approvePlan: (id: string, input: ApproveTicketInput) => Promise<Ticket>;
  grantApproval: (id: string) => Promise<AgentRunResult>;
  denyApproval: (id: string) => Promise<AgentRunResult>;
  answerQuestion: (id: string, input: AnswerQuestionInput) => Promise<AgentRunResult>;
  startAgent: (ticketId: string) => Promise<AgentRunResult>;
  cancelAgent: (ticketId: string) => Promise<void>;
  subscribeToTicket: (id: string, handler: StreamEventHandler) => UnsubscribeFn;
};

type AuraClientConfig = {
  baseUrl: string;
  timeout?: number;
};

export type { AuraClient, AuraClientConfig, ListTicketsFilters, StreamEventHandler };
