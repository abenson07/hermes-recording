import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params {
  params: Promise<{ workspaceId: string }>;
}

// GET /api/workspaces/[workspaceId]/projects - List projects
export async function GET(_request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify workspace ownership
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Projects fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }

  return NextResponse.json({ projects });
}

// POST /api/workspaces/[workspaceId]/projects - Create project
export async function POST(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify workspace ownership
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Project create error:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Create default context file
    await supabase.from('context_files').insert({
      project_id: project.id,
      slug: 'general',
      title: 'General',
      content: '# General Context\n\nNo content yet.',
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
