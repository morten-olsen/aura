import type { DynamicStructuredTool } from '@langchain/core/tools';

import { createGitTools } from './tools.git.ts';
import { createValidationTools } from './tools.validation.ts';
import { createHumanTools } from './tools.human.ts';

import type { GitService } from '#root/git/git.ts';
import type { ValidationService } from '#root/validation/validation.ts';
import type { TicketService } from '#root/tickets/tickets.ts';

type ToolDependencies = {
  gitService: GitService;
  validationService: ValidationService;
  ticketService: TicketService;
  ticketId: string;
};

const createAllTools = (deps: ToolDependencies): DynamicStructuredTool[] => {
  return [
    ...createGitTools(deps.gitService, deps.ticketId),
    ...createValidationTools(deps.validationService, deps.gitService, deps.ticketId),
    ...createHumanTools(deps.ticketService, deps.ticketId),
  ];
};

export type { ToolDependencies };
export { createAllTools, createGitTools, createValidationTools, createHumanTools };
