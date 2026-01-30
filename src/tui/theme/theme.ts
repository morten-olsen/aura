import type { TicketStatus, TicketPriority } from '#root/database/database.schemas.ts';

type StatusColorMap = Record<TicketStatus, string>;
type PriorityColorMap = Record<TicketPriority, string>;

const statusColors: StatusColorMap = {
  draft: 'gray',
  pending_approval: 'yellow',
  approved: 'cyan',
  in_progress: 'blue',
  awaiting_input: 'magenta',
  paused: 'gray',
  completed: 'green',
  failed: 'red',
  cancelled: 'gray',
};

const priorityColors: PriorityColorMap = {
  low: 'gray',
  medium: 'white',
  high: 'yellow',
  critical: 'red',
};

const colors = {
  primary: 'cyan',
  secondary: 'gray',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  muted: 'gray',
  border: 'gray',
  highlight: 'cyan',
  text: 'white',
  textMuted: 'gray',
} as const;

type ThemeColors = typeof colors;

const theme = {
  colors,
  statusColors,
  priorityColors,
} as const;

type Theme = typeof theme;

export type { StatusColorMap, PriorityColorMap, ThemeColors, Theme };
export { statusColors, priorityColors, colors, theme };
