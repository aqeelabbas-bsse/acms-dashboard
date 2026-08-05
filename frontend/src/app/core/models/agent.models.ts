/** POST /agent/query response, exactly as the backend returns it. */
export interface AgentAnswer {
  answer: string;
  generatedSql: string | null;
  rowCount: number;
  chartSuggested: boolean;
  elapsedMs: number;
  /** NOT currently returned by the API. Declared optional so the panel's
   *  chart slot activates automatically if the backend starts sending rows.
   *  See Feature Specification section 4 - inline mini-charts. */
  rows?: Record<string, unknown>[];
}

export type MessageRole = 'user' | 'agent';

export type MessageStatus = 'pending' | 'done' | 'refused' | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  status: MessageStatus;
  at: number;
  /** Agent messages only */
  sql?: string | null;
  rowCount?: number;
  elapsedMs?: number;
  rows?: Record<string, unknown>[];
}

export interface SuggestionChip {
  label: string;
  question: string;
}