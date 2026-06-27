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

  // Get inbox item
  const { data: item, error: itemError } = await supabase
    .from('inbox_items')
    .select('*, workspace:workspace_id (user_id)')
    .eq('id', id)
    .single();

  if (itemError || !item || item.workspace?.user_id !== user.id) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  // Mark as dismissed
  const { error: updateError } = await supabase
    .from('inbox_items')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    console.error('Dismiss error:', updateError);
    return NextResponse.json({ error: 'Failed to dismiss item' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
