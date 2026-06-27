import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: proposals, error } = await supabase
    .from('proposals')
    .select(`
      *,
      workspace:workspace_id (*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Proposals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }

  return NextResponse.json({ proposals });
}
