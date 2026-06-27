export type ProjectStatus = 'active' | 'draft';
export type SessionStatus = 'active' | 'processing' | 'complete';
export type ProposalStatus = 'pending' | 'confirmed' | 'rejected';

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  status: ProjectStatus;
  created_at: string;
}

export interface ContextFile {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  content: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id: string;
  status: SessionStatus;
  mode: SessionMode;
  started_at: string;
  ended_at: string | null;
}

export interface TranscriptLineRow {
  id: string;
  session_id: string;
  sequence: number;
  entry_type: 'utterance' | 'mode_change';
  speaker: TranscriptSpeaker | null;
  mode: SessionMode | null;
  timestamp: string;
  text: string | null;
  mode_change_to: SessionMode | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  session_id: string;
  workspace_id: string;
  draft_project_id: string | null;
  suggested_name: string;
  content_draft: string;
  status: ProposalStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface InboxItem {
  id: string;
  workspace_id: string;
  session_id: string | null;
  text: string;
  routed_to_project_id: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  preferences: {
    tone?: string;
    name?: string;
    [key: string]: unknown;
  };
  updated_at: string;
}

export type SessionMode = 'capture' | 'conversation';
export type TranscriptSpeaker = 'USER' | 'AGENT';
