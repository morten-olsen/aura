class AgentError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
  }
}

class MaxTurnsExceededError extends AgentError {
  constructor(turns: number) {
    super(`Maximum turns exceeded: ${turns}`, 'MAX_TURNS_EXCEEDED');
    this.name = 'MaxTurnsExceededError';
  }
}

class PlanNotApprovedError extends AgentError {
  constructor(ticketId: string) {
    super(`Plan not approved for ticket: ${ticketId}`, 'PLAN_NOT_APPROVED');
    this.name = 'PlanNotApprovedError';
  }
}

class ToolExecutionError extends AgentError {
  constructor(tool: string, message: string) {
    super(`Tool "${tool}" failed: ${message}`, 'TOOL_EXECUTION_FAILED');
    this.name = 'ToolExecutionError';
  }
}

class LLMError extends AgentError {
  constructor(message: string) {
    super(`LLM error: ${message}`, 'LLM_ERROR');
    this.name = 'LLMError';
  }
}

class AgentNotRunningError extends AgentError {
  constructor(ticketId: string) {
    super(`Agent is not running for ticket: ${ticketId}`, 'AGENT_NOT_RUNNING');
    this.name = 'AgentNotRunningError';
  }
}

export { AgentError, MaxTurnsExceededError, PlanNotApprovedError, ToolExecutionError, LLMError, AgentNotRunningError };
