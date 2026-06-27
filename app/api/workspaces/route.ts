import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/workspaces - List all workspaces for user
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('*, projects(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Workspaces fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }

  return NextResponse.json({ workspaces });
}

// POST /api/workspaces - Create new workspace
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({ user_id: user.id, name: name.trim() })
      .select()
      .single();

    if (error) {
      console.error('Workspace create error:', error);
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
