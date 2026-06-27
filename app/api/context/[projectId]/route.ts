import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify project ownership through workspace
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, name, workspace:workspace_id (user_id)')
    .eq('id', projectId)
    .single();

  if (projError || !project || project.workspace?.[0]?.user_id !== user.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get context files
  const { data: files, error: filesError } = await supabase
    .from('context_files')
    .select('*')
    .eq('project_id', projectId)
    .order('slug', { ascending: true });

  if (filesError) {
    console.error('Context files fetch error:', filesError);
    return NextResponse.json({ error: 'Failed to fetch context files' }, { status: 500 });
  }

  return NextResponse.json({
    projectName: project.name,
    files: files || [],
  });
}
