import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { proposalId } = await request.json();

    if (!proposalId) {
      return NextResponse.json({ error: 'proposalId is required' }, { status: 400 });
    }

    // Get proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*, workspace:workspace_id (user_id, id)')
      .eq('id', proposalId)
      .eq('status', 'pending')
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.workspace?.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mark proposal as rejected
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (updateError) {
      console.error('Proposal update error:', updateError);
      return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
    }

    // Delete draft project
    if (proposal.draft_project_id) {
      await supabase
        .from('projects')
        .delete()
        .eq('id', proposal.draft_project_id);
    }

    // Re-route content to inbox
    if (proposal.content_draft) {
      const lines = proposal.content_draft.split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        if (line.length > 10) {
          await supabase.from('inbox_items').insert({
            workspace_id: proposal.workspace_id,
            session_id: proposal.session_id,
            text: line.replace(/^- /, ''),
          });
        }
      }
    }

    return NextResponse.json({
      proposalId,
      status: 'rejected',
      reroutedTo: 'inbox',
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
