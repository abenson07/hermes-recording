import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runDistillationPipeline } from '@/lib/distillation/pipeline';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Check authorization (service role or session owner)
  const authHeader = request.headers.get('Authorization');
  const distillSecret = process.env.DISTILLATION_SECRET;
  
  if (distillSecret && authHeader !== `Bearer ${distillSecret}`) {
    // Allow if user owns the session (fallback)
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, project:project_id(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Run distillation pipeline
    const result = await runDistillationPipeline(supabase, sessionId, session.project_id, session.workspace_id);

    // Mark session as complete
    await supabase
      .from('sessions')
      .update({ status: 'complete' })
      .eq('id', sessionId);

    return NextResponse.json({
      sessionId,
      status: 'complete',
      projectsUpdated: result.projectsUpdated,
      proposalsCreated: result.proposalsCreated,
      inboxItemsCreated: result.inboxItemsCreated,
    });

  } catch (err) {
    console.error('Distillation error:', err);
    return NextResponse.json({ error: 'Distillation failed' }, { status: 500 });
  }
}
