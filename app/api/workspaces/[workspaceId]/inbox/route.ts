import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(request: Request, { params }: Params) {
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

  // Get non-dismissed inbox items
  const { data: items, error } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Inbox fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch inbox items' }, { status: 500 });
  }

  return NextResponse.json({ items });
}
