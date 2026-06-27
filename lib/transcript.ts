export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

import { TranscriptLineClient, SessionMode, TranscriptSpeaker } from '@/types/transcript';
import { TranscriptLineRow } from '@/types/database';

export function clientEntryToRow(
  entry: TranscriptLineClient,
  sessionId: string,
  sequence: number
): Omit<TranscriptLineRow, 'id' | 'created_at'> {
  if (entry.mode_change) {
    return {
      session_id: sessionId,
      sequence,
      entry_type: 'mode_change',
      speaker: null,
      mode: null,
      timestamp: entry.timestamp,
      text: null,
      mode_change_to: entry.mode_change,
    };
  }
  return {
    session_id: sessionId,
    sequence,
    entry_type: 'utterance',
    speaker: entry.speaker || null,
    mode: entry.mode || null,
    timestamp: entry.timestamp,
    text: entry.text || null,
    mode_change_to: null,
  };
}

export function rowsToMarkdown(lines: TranscriptLineRow[]): string {
  return lines
    .map((line) => {
      if (line.entry_type === 'mode_change') {
        return `\n--- ${line.mode_change_to?.toUpperCase()} MODE ---\n`;
      }
      const speaker = line.speaker || 'UNKNOWN';
      return `[${line.timestamp}] **${speaker}**: ${line.text}`;
    })
    .join('\n\n');
}
