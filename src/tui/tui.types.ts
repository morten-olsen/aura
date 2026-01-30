import type { Ticket } from '#root/tickets/tickets.schemas.ts';
import type { TicketStatus } from '#root/database/database.schemas.ts';

type ScreenName = 'dashboard' | 'ticket' | 'create' | 'help';

type ScreenParams = {
  dashboard: Record<string, never>;
  ticket: { ticketId: string };
  create: Record<string, never>;
  help: Record<string, never>;
};

type Screen<T extends ScreenName = ScreenName> = {
  name: T;
  params: ScreenParams[T];
};

type NavigationHistoryEntry = Screen;

type ToastType = 'info' | 'success' | 'error' | 'warning';

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type ModalConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

type ListFilters = {
  status?: TicketStatus;
};

type StreamEvent =
  | { type: 'connected'; ticketId: string }
  | { type: 'ticket'; ticket: Ticket }
  | { type: 'step_progress'; data: StepProgress }
  | { type: 'error'; error: string };

type StepProgress = {
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: number;
  currentStepTitle: string | null;
};

type UnsubscribeFn = () => void;

export type {
  ScreenName,
  ScreenParams,
  Screen,
  NavigationHistoryEntry,
  ToastType,
  Toast,
  ModalConfig,
  ListFilters,
  StreamEvent,
  StepProgress,
  UnsubscribeFn,
};
