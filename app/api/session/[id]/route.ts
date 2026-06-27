import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get session with workspace and project info
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select(`
      id,
      status,
      started_at,
      ended_at,
      workspace:workspace_id (name),
      project:project_id (name)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Get transcript lines
  const { data: transcript, error: transcriptError } = await supabase
    .from('transcript_lines')
    .select('*')
    .eq('session_id', id)
    .order('sequence', { ascending: true });

  if (transcriptError) {
    console.error('Transcript fetch error:', transcriptError);
  }

  return NextResponse.json({
    session: {
      ...session,
      workspace: session.workspace?.[0] || null,
      project: session.project?.[0] || null,
    },
    transcript: transcript || [],
  });
}
