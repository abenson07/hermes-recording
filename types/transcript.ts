export interface UtteranceEntry {
  entry_type: 'utterance';
  speaker: TranscriptSpeaker;
  mode: SessionMode;
  timestamp: string; // MM:SS
  text: string;
}

export interface ModeChangeEntry {
  entry_type: 'mode_change';
  timestamp: string;
  mode_change_to: SessionMode;
}

export type TranscriptEntry = UtteranceEntry | ModeChangeEntry;

// Client/API shorthand (matches PRD JSON examples)
export interface TranscriptLineClient {
  speaker?: TranscriptSpeaker;
  mode?: SessionMode;
  timestamp: string;
  text?: string;
  mode_change?: SessionMode;
}

export type SessionMode = 'capture' | 'conversation';
export type TranscriptSpeaker = 'USER' | 'AGENT';
