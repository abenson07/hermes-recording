import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params {
  params: Promise<{ projectId: string; slug: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { projectId, slug } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('workspace:workspace_id (user_id)')
    .eq('id', projectId)
    .single();

  if (!project || project.workspace?.[0]?.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get context file
  const { data: file, error } = await supabase
    .from('context_files')
    .select('*')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  return NextResponse.json({ file });
}

export async function PATCH(request: Request, { params }: Params) {
  const { projectId, slug } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('workspace:workspace_id (user_id)')
    .eq('id', projectId)
    .single();

  if (!project || project.workspace?.[0]?.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const { data: file, error } = await supabase
      .from('context_files')
      .update({ content })
      .eq('project_id', projectId)
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
    }

    return NextResponse.json({ file });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
