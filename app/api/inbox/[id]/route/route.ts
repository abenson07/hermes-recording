import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Get inbox item
    const { data: item, error: itemError } = await supabase
      .from('inbox_items')
      .select('*, workspace:workspace_id (user_id)')
      .eq('id', id)
      .single();

    if (itemError || !item || item.workspace?.user_id !== user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify project belongs to same workspace
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('workspace_id', item.workspace_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Mark as routed
    const { error: updateError } = await supabase
      .from('inbox_items')
      .update({
        routed_to_project_id: projectId,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Route error:', updateError);
      return NextResponse.json({ error: 'Failed to route item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
