import type { TicketStatus } from '#root/database/database.schemas.ts';

class TicketError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TicketError';
    this.code = code;
  }
}

class TicketNotFoundError extends TicketError {
  constructor(id: string) {
    super(`Ticket not found: ${id}`, 'TICKET_NOT_FOUND');
    this.name = 'TicketNotFoundError';
  }
}

class InvalidStatusTransitionError extends TicketError {
  from: TicketStatus;
  to: TicketStatus;

  constructor(from: TicketStatus, to: TicketStatus) {
    super(`Invalid status transition from "${from}" to "${to}"`, 'INVALID_STATUS_TRANSITION');
    this.name = 'InvalidStatusTransitionError';
    this.from = from;
    this.to = to;
  }
}

class NoPendingApprovalError extends TicketError {
  constructor(id: string) {
    super(`No pending approval for ticket: ${id}`, 'NO_PENDING_APPROVAL');
    this.name = 'NoPendingApprovalError';
  }
}

class NoPendingQuestionError extends TicketError {
  constructor(id: string) {
    super(`No pending question for ticket: ${id}`, 'NO_PENDING_QUESTION');
    this.name = 'NoPendingQuestionError';
  }
}

class NoPlanError extends TicketError {
  constructor(id: string) {
    super(`No plan exists for ticket: ${id}`, 'NO_PLAN');
    this.name = 'NoPlanError';
  }
}

export {
  TicketError,
  TicketNotFoundError,
  InvalidStatusTransitionError,
  NoPendingApprovalError,
  NoPendingQuestionError,
  NoPlanError,
};
