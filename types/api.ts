// Session
export interface StartSessionRequest {
  workspaceId: string;
  projectId: string;
}
export interface StartSessionResponse {
  sessionId: string;
  startedAt: string;
  status: 'active';
}

export interface EndSessionRequest {
  sessionId: string;
}
export interface EndSessionResponse {
  sessionId: string;
  status: 'processing';
}

// Transcript
export interface AppendTranscriptRequest {
  sessionId: string;
  entries: TranscriptLineClient[];
}
export interface AppendTranscriptResponse {
  inserted: number;
  lastSequence: number;
}

// Agent
export interface AgentMessageRequest {
  sessionId: string;
  userText: string;
}
// Response: SSE stream

// Distill
export interface DistillRequest {
  sessionId: string;
}
export interface DistillResponse {
  sessionId: string;
  status: 'complete' | 'processing';
  projectsUpdated: string[];
  proposalsCreated: number;
  inboxItemsCreated: number;
}

// Proposals
export interface ConfirmProposalRequest {
  proposalId: string;
}
export interface RejectProposalRequest {
  proposalId: string;
}

// Context
export interface UpdateContextFileRequest {
  content: string;
}

export interface ApiError {
  error: string;
  code?: string;
}

// Re-export from transcript.ts for convenience
import type { TranscriptLineClient } from './transcript';
export type { TranscriptLineClient };
