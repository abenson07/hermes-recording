import { createClient } from '@/lib/supabase/server';
import { TranscriptLineRow, ContextFile, UserPreferences } from '@/types/database';

export async function loadAgentContext(sessionId: string) {
  const supabase = await createClient();

  // 1. Load session with workspace and project
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(`
      id,
      mode,
      user_id,
      workspace_id,
      project_id,
      started_at,
      workspace:workspace_id (name),
      project:project_id (name)
    `)
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error('Session not found');
  }

  // 2. Load all transcript lines ordered by sequence
  const { data: transcript, error: transcriptError } = await supabase
    .from('transcript_lines')
    .select('*')
    .eq('session_id', sessionId)
    .order('sequence', { ascending: true });

  if (transcriptError) {
    console.error('Transcript fetch error:', transcriptError);
  }

  // 3. Load all context files for the project
  const { data: contextFiles, error: cfError } = await supabase
    .from('context_files')
    .select('*')
    .eq('project_id', session.project_id);

  if (cfError) {
    console.error('Context files fetch error:', cfError);
  }

  // 4. Load user preferences
  const { data: preferences, error: prefError } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', session.user_id)
    .maybeSingle();

  if (prefError) {
    console.error('Preferences fetch error:', prefError);
  }

  return {
    session: {
      id: session.id,
      mode: session.mode,
      started_at: session.started_at,
      workspaceName: session.workspace?.[0]?.name || 'Unknown',
      projectName: session.project?.[0]?.name || 'Unknown',
    },
    transcript: transcript || [],
    contextFiles: contextFiles || [],
    preferences: preferences?.preferences || { tone: 'concise', name: 'User' },
  };
}

export function formatTranscriptForAgent(transcript: TranscriptLineRow[]): string {
  return transcript
    .filter(line => line.entry_type === 'utterance')
    .map(line => {
      const speaker = line.speaker || 'UNKNOWN';
      return `[${line.timestamp}] ${speaker}: ${line.text}`;
    })
    .join('\n');
}

export function formatContextFiles(contextFiles: ContextFile[]): string {
  if (contextFiles.length === 0) {
    return 'No existing context files for this project.';
  }

  return contextFiles
    .map(file => {
      return `## ${file.title} (${file.slug})\n\n${file.content}`;
    })
    .join('\n\n---\n\n');
}
