import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { workspaceId, projectId } = await request.json();

    if (!workspaceId || !projectId) {
      return NextResponse.json(
        { error: 'workspaceId and projectId are required', code: 'MISSING_SCOPE' },
        { status: 400 }
      );
    }

    // Verify workspace belongs to user
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (wsError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify project belongs to workspace
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('workspace_id', workspaceId)
      .single();

    if (projError || !project) {
      return NextResponse.json(
        { error: 'Project not found in workspace', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check for existing active session
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSession) {
      return NextResponse.json(
        { error: 'Active session already exists', code: 'ACTIVE_SESSION_EXISTS' },
        { status: 409 }
      );
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        project_id: projectId,
        status: 'active',
        mode: 'capture',
      })
      .select('id, started_at, status')
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      startedAt: session.started_at,
      status: session.status,
    }, { status: 201 });

  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
