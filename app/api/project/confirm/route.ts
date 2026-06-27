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
      .select('*, workspace:workspace_id (user_id)')
      .eq('id', proposalId)
      .eq('status', 'pending')
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.workspace?.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Activate draft project
    const { error: projectError } = await supabase
      .from('projects')
      .update({ status: 'active' })
      .eq('id', proposal.draft_project_id);

    if (projectError) {
      console.error('Project activation error:', projectError);
      return NextResponse.json({ error: 'Failed to activate project' }, { status: 500 });
    }

    // Create context file from content_draft
    if (proposal.content_draft) {
      await supabase.from('context_files').insert({
        project_id: proposal.draft_project_id,
        slug: 'general',
        title: 'General',
        content: `# ${proposal.suggested_name}\n\n${proposal.content_draft}`,
      });
    }

    // Mark proposal as confirmed
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'confirmed',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    if (updateError) {
      console.error('Proposal update error:', updateError);
      return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
    }

    return NextResponse.json({
      proposalId,
      projectId: proposal.draft_project_id,
      status: 'confirmed',
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
