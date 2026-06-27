import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientEntryToRow } from '@/lib/transcript';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { sessionId, entries } = await request.json();

    if (!sessionId || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'sessionId and entries array are required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // Verify session belongs to user and is active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status, mode')
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

    // Get next sequence number
    const { data: maxSeq } = await supabase
      .from('transcript_lines')
      .select('sequence')
      .eq('session_id', sessionId)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSequence = (maxSeq?.sequence ?? 0) + 1;

    // Build rows
    const rows = entries.map((entry, idx) => {
      const row = clientEntryToRow(entry, sessionId, nextSequence + idx);
      return row;
    });

    // Handle mode changes - update session mode
    const modeChanges = entries.filter(e => e.mode_change);
    if (modeChanges.length > 0) {
      const lastModeChange = modeChanges[modeChanges.length - 1];
      if (lastModeChange.mode_change) {
        await supabase
          .from('sessions')
          .update({ mode: lastModeChange.mode_change })
          .eq('id', sessionId);
      }
    }

    // Insert all rows
    const { error: insertError } = await supabase
      .from('transcript_lines')
      .insert(rows);

    if (insertError) {
      console.error('Transcript insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert transcript', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      inserted: rows.length,
      lastSequence: nextSequence + rows.length - 1,
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
