import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { interrupt } from '@langchain/langgraph';

import type { TicketService } from '#root/tickets/tickets.ts';

const createHumanTools = (ticketService: TicketService, ticketId: string): DynamicStructuredTool[] => {
  const askQuestionTool = new DynamicStructuredTool({
    name: 'ask_question',
    description:
      'Ask the user a question and wait for their response. Use this when you need clarification or input from the user.',
    schema: z.object({
      question: z.string().describe('The question to ask the user'),
      options: z.array(z.string()).optional().describe('Optional list of suggested answers'),
    }),
    func: async ({ question, options }) => {
      await ticketService.askQuestion(ticketId, {
        question,
        options,
        askedAt: new Date().toISOString(),
      });

      // Interrupt the graph to wait for user input
      const response = interrupt({ type: 'question', question, options });

      return `User response: ${response}`;
    },
  });

  const requestApprovalTool = new DynamicStructuredTool({
    name: 'request_approval',
    description:
      'Request approval from the user before proceeding with an action. Use this for destructive operations or significant changes.',
    schema: z.object({
      description: z.string().describe('Description of what needs approval'),
      actionType: z.enum(['plan', 'action', 'resource']).describe('Type of approval being requested'),
      details: z.record(z.string(), z.unknown()).optional().describe('Additional details about the action'),
    }),
    func: async ({ description, actionType, details }) => {
      await ticketService.requestApproval(ticketId, {
        type: actionType,
        description,
        details,
        requestedAt: new Date().toISOString(),
      });

      // Interrupt the graph to wait for approval
      const response = interrupt({ type: 'approval', description, actionType, details });

      if (response === true || response === 'approved') {
        return 'Approval granted. Proceeding with action.';
      } else {
        return 'Approval denied. Action cancelled.';
      }
    },
  });

  return [askQuestionTool, requestApprovalTool];
};

export { createHumanTools };
