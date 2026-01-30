import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';

import { useAppState } from '../state/state.context.tsx';
import { useTicket, useTicketActions } from '../hooks/hook.api.ts';
import { useNavigation } from '../hooks/hook.navigation.ts';
import { useShortcuts } from '../hooks/hook.shortcuts.ts';
import { useTicketStream } from '../hooks/hook.stream.ts';
import { Header } from '../components/component.header.tsx';
import { Footer } from '../components/component.footer.tsx';
import { StatusBadge, PriorityBadge } from '../components/component.badge.tsx';
import { Panel, Section } from '../components/component.panel.tsx';
import { Spinner } from '../components/component.spinner.tsx';
import { ConfirmModal } from '../components/component.modal.tsx';
import { ToastContainer } from '../components/component.toast.tsx';
import { theme } from '../theme/theme.ts';

import { isTicketScreen } from './screens.ts';

import type { StructuredPlan, PlanStep } from '#root/database/database.schemas.ts';
import type { Ticket } from '#root/tickets/tickets.schemas.ts';

type PlanStepRowProps = {
  step: PlanStep;
};

const stepStatusIcons: Record<PlanStep['status'], string> = {
  pending: '○',
  in_progress: '◐',
  completed: '●',
  failed: '✗',
  skipped: '⊘',
};

const stepStatusColors: Record<PlanStep['status'], string> = {
  pending: theme.colors.muted,
  in_progress: theme.colors.primary,
  completed: theme.colors.success,
  failed: theme.colors.error,
  skipped: theme.colors.muted,
};

const PlanStepRow = ({ step }: PlanStepRowProps): React.ReactElement => {
  const icon = stepStatusIcons[step.status];
  const color = stepStatusColors[step.status];

  return (
    <Box>
      <Text color={color}>{icon} </Text>
      <Text color={step.status === 'in_progress' ? theme.colors.text : theme.colors.muted}>
        {step.index + 1}. {step.title}
      </Text>
      {step.status === 'in_progress' && <Text color={theme.colors.primary}> (in progress)</Text>}
    </Box>
  );
};

type StructuredPlanViewProps = {
  plan: StructuredPlan;
};

const StructuredPlanView = ({ plan }: StructuredPlanViewProps): React.ReactElement => {
  const completedCount = plan.steps.filter((s) => s.status === 'completed').length;
  const totalCount = plan.steps.length;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.colors.muted}>
          Progress: {completedCount}/{totalCount} steps
        </Text>
        {plan.approvedAt && <Text color={theme.colors.success}> (Approved)</Text>}
      </Box>

      <Box marginBottom={1}>
        <Text color={theme.colors.text}>{plan.summary}</Text>
      </Box>

      <Box flexDirection="column">
        {plan.steps.map((step) => (
          <PlanStepRow key={step.id} step={step} />
        ))}
      </Box>
    </Box>
  );
};

type PendingApprovalViewProps = {
  ticket: Ticket;
  onGrant: () => void;
  onDeny: () => void;
};

const PendingApprovalView = ({ ticket }: PendingApprovalViewProps): React.ReactElement | null => {
  if (!ticket.pendingApproval) {
    return null;
  }

  return (
    <Panel title="Pending Approval" borderColor={theme.colors.warning}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color={theme.colors.warning} bold>
            [{ticket.pendingApproval.type.toUpperCase()}]
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color={theme.colors.text}>{ticket.pendingApproval.description}</Text>
        </Box>
        <Box>
          <Text color={theme.colors.muted}>Press 'y' to approve, 'n' to deny</Text>
        </Box>
      </Box>
    </Panel>
  );
};

type PendingQuestionViewProps = {
  ticket: Ticket;
};

const PendingQuestionView = ({ ticket }: PendingQuestionViewProps): React.ReactElement | null => {
  if (!ticket.pendingQuestion) {
    return null;
  }

  return (
    <Panel title="Question from Agent" borderColor={theme.colors.primary}>
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color={theme.colors.text}>{ticket.pendingQuestion.question}</Text>
        </Box>
        {ticket.pendingQuestion.options && ticket.pendingQuestion.options.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color={theme.colors.muted}>Options:</Text>
            {ticket.pendingQuestion.options.map((option, idx) => (
              <Text key={idx} color={theme.colors.text}>
                {idx + 1}. {option}
              </Text>
            ))}
          </Box>
        )}
        <Box>
          <Text color={theme.colors.muted}>Press 'a' to answer</Text>
        </Box>
      </Box>
    </Panel>
  );
};

type TicketScreenProps = {
  ticketId: string;
};

const TicketScreenContent = ({ ticketId }: TicketScreenProps): React.ReactElement => {
  const state = useAppState();
  const { navigateBack, navigateToHelp } = useNavigation();
  const { ticket, isLoading, error, refetch } = useTicket({ ticketId });
  const actions = useTicketActions(ticketId);

  // Enable real-time updates via SSE
  useTicketStream({
    ticketId,
    enabled: true,
  });

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  const handleApprovePlan = useCallback(async (): Promise<void> => {
    setShowApproveModal(false);
    await actions.approvePlan('tui-user');
    refetch();
  }, [actions, refetch]);

  const handleGrantApproval = useCallback(async (): Promise<void> => {
    await actions.grantApproval();
    refetch();
  }, [actions, refetch]);

  const handleDenyApproval = useCallback(async (): Promise<void> => {
    setShowDenyModal(false);
    await actions.denyApproval();
    refetch();
  }, [actions, refetch]);

  const handleStartAgent = useCallback(async (): Promise<void> => {
    setShowStartModal(false);
    await actions.startAgent();
    refetch();
  }, [actions, refetch]);

  useShortcuts({
    escape: navigateBack,
    b: navigateBack,
    r: refetch,
    '?': navigateToHelp,
    p: () => {
      if (ticket?.status === 'pending_approval' && ticket.structuredPlan && !ticket.structuredPlan.approvedAt) {
        setShowApproveModal(true);
      }
    },
    s: () => {
      if (ticket?.status === 'draft' || ticket?.status === 'approved') {
        setShowStartModal(true);
      }
    },
    y: () => {
      if (ticket?.pendingApproval) {
        handleGrantApproval();
      }
    },
    n: () => {
      if (ticket?.pendingApproval) {
        setShowDenyModal(true);
      }
    },
  });

  const getShortcuts = (): { key: string; label: string }[] => {
    const baseShortcuts = [
      { key: 'Esc/b', label: 'Back' },
      { key: 'r', label: 'Refresh' },
    ];

    if (ticket) {
      if (ticket.status === 'pending_approval' && ticket.structuredPlan && !ticket.structuredPlan.approvedAt) {
        baseShortcuts.push({ key: 'p', label: 'Approve Plan' });
      }
      if (ticket.status === 'draft' || ticket.status === 'approved') {
        baseShortcuts.push({ key: 's', label: 'Start Agent' });
      }
      if (ticket.pendingApproval) {
        baseShortcuts.push({ key: 'y/n', label: 'Grant/Deny' });
      }
    }

    baseShortcuts.push({ key: '?', label: 'Help' });
    return baseShortcuts;
  };

  if (isLoading && !ticket) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header title="Aura" subtitle="Loading..." isLoading />
        <Box padding={2}>
          <Spinner label="Loading ticket..." />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header title="Aura" subtitle="Error" />
        <Box padding={2}>
          <Text color={theme.colors.error}>Error: {error}</Text>
        </Box>
        <Footer shortcuts={[{ key: 'Esc', label: 'Back' }]} />
      </Box>
    );
  }

  if (!ticket) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header title="Aura" subtitle="Not Found" />
        <Box padding={2}>
          <Text color={theme.colors.error}>Ticket not found</Text>
        </Box>
        <Footer shortcuts={[{ key: 'Esc', label: 'Back' }]} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Header
        title="Aura"
        subtitle={`Ticket: ${ticket.id.substring(0, 8)}`}
        isConnected={state.isConnected}
        isLoading={isLoading || actions.isLoading}
      />

      <Box flexDirection="column" paddingX={1} marginTop={1} flexGrow={1}>
        {/* Ticket Header */}
        <Box marginBottom={1}>
          <StatusBadge status={ticket.status} />
          <Text> </Text>
          <PriorityBadge priority={ticket.priority} />
          <Text color={theme.colors.text}> </Text>
          <Text color={theme.colors.text} bold>
            {ticket.title}
          </Text>
        </Box>

        {/* Description */}
        <Section title="Description" marginBottom={1}>
          <Text color={theme.colors.text}>{ticket.description}</Text>
        </Section>

        {/* Metadata */}
        <Box marginBottom={1}>
          <Text color={theme.colors.muted}>Created: {new Date(ticket.createdAt).toLocaleString()}</Text>
          <Text color={theme.colors.muted}> | </Text>
          <Text color={theme.colors.muted}>
            Turn: {ticket.currentTurn}/{ticket.maxTurns}
          </Text>
          {ticket.workingBranch && (
            <>
              <Text color={theme.colors.muted}> | </Text>
              <Text color={theme.colors.muted}>Branch: {ticket.workingBranch}</Text>
            </>
          )}
        </Box>

        {/* Pending Approval */}
        {ticket.pendingApproval && (
          <Box marginBottom={1}>
            <PendingApprovalView ticket={ticket} onGrant={handleGrantApproval} onDeny={() => setShowDenyModal(true)} />
          </Box>
        )}

        {/* Pending Question */}
        {ticket.pendingQuestion && (
          <Box marginBottom={1}>
            <PendingQuestionView ticket={ticket} />
          </Box>
        )}

        {/* Structured Plan */}
        {ticket.structuredPlan && (
          <Section title="Execution Plan" marginBottom={1}>
            <StructuredPlanView plan={ticket.structuredPlan} />
          </Section>
        )}

        {/* Commits */}
        {ticket.commits.length > 0 && (
          <Section title="Commits">
            {ticket.commits.map((commit) => (
              <Box key={commit.sha}>
                <Text color={theme.colors.primary}>{commit.sha.substring(0, 7)}</Text>
                <Text color={theme.colors.text}> {commit.message}</Text>
              </Box>
            ))}
          </Section>
        )}
      </Box>

      {/* Toasts */}
      {state.toasts.length > 0 && <ToastContainer toasts={state.toasts} />}

      {/* Modals */}
      <ConfirmModal
        title="Approve Plan"
        message="Are you sure you want to approve this plan?"
        onConfirm={handleApprovePlan}
        onCancel={() => setShowApproveModal(false)}
        isVisible={showApproveModal}
      />

      <ConfirmModal
        title="Deny Approval"
        message="Are you sure you want to deny this approval request?"
        onConfirm={handleDenyApproval}
        onCancel={() => setShowDenyModal(false)}
        isVisible={showDenyModal}
      />

      <ConfirmModal
        title="Start Agent"
        message="Start the AI agent to work on this ticket?"
        onConfirm={handleStartAgent}
        onCancel={() => setShowStartModal(false)}
        isVisible={showStartModal}
      />

      <Footer shortcuts={getShortcuts()} />
    </Box>
  );
};

const TicketScreen = (): React.ReactElement => {
  const state = useAppState();

  if (!isTicketScreen(state.screen)) {
    return (
      <Box padding={1}>
        <Text color={theme.colors.error}>Invalid screen state</Text>
      </Box>
    );
  }

  return <TicketScreenContent ticketId={state.screen.params.ticketId} />;
};

export type { TicketScreenProps };
export { TicketScreen };
