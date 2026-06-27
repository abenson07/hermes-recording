import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    // Verify session belongs to user and is active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active', code: 'SESSION_NOT_ACTIVE' },
        { status: 400 }
      );
    }

    // Update session status
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        status: 'processing',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Session end error:', updateError);
      return NextResponse.json(
        { error: 'Failed to end session', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    // Trigger distillation asynchronously
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const distillSecret = process.env.DISTILLATION_SECRET;
    
    // Fire-and-forget the distillation job
    fetch(`${appUrl}/api/distill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(distillSecret && { 'Authorization': `Bearer ${distillSecret}` }),
      },
      body: JSON.stringify({ sessionId }),
    }).catch((err) => {
      console.error('Distillation trigger error:', err);
    });

    return NextResponse.json({
      sessionId,
      status: 'processing',
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
