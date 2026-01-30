import React from 'react';
import { Text } from 'ink';

import { statusColors, priorityColors, theme } from '../theme/theme.ts';

import type { TicketStatus, TicketPriority } from '#root/database/database.schemas.ts';

type StatusBadgeProps = {
  status: TicketStatus;
};

const formatStatus = (status: TicketStatus): string => {
  return status.replace(/_/g, ' ').toUpperCase();
};

const StatusBadge = ({ status }: StatusBadgeProps): React.ReactElement => {
  const color = statusColors[status];
  const label = formatStatus(status);

  return (
    <Text color={color} bold>
      [{label}]
    </Text>
  );
};

type PriorityBadgeProps = {
  priority: TicketPriority;
};

const formatPriority = (priority: TicketPriority): string => {
  return priority.toUpperCase();
};

const PriorityBadge = ({ priority }: PriorityBadgeProps): React.ReactElement => {
  const color = priorityColors[priority];
  const label = formatPriority(priority);

  return <Text color={color}>{label}</Text>;
};

type LabelBadgeProps = {
  label: string;
  color?: string;
  bold?: boolean;
};

const LabelBadge = ({ label, color = theme.colors.text, bold = false }: LabelBadgeProps): React.ReactElement => {
  return (
    <Text color={color} bold={bold}>
      [{label}]
    </Text>
  );
};

export type { StatusBadgeProps, PriorityBadgeProps, LabelBadgeProps };
export { StatusBadge, PriorityBadge, LabelBadge, formatStatus, formatPriority };
