import type { TranscriptLineRow } from '@/types/database';

const MIN_FACTS_FOR_PROPOSAL = 3;

export async function createProposals(
  supabase: any,
  sessionId: string,
  workspaceId: string,
  suggestedName: string,
  chunks: { timestamp: string; text: string }[]
): Promise<boolean> {
  // Simple heuristic: count distinct facts/decisions
  // A more sophisticated approach would use the LLM to count
  const contentDraft = chunks.map(c => `- ${c.timestamp}: ${c.text}`).join('\n');
  
  // Count bullet points and decision-like statements
  const factCount = chunks.filter(c => 
    c.text.length > 20 && 
    (c.text.includes('decide') || 
     c.text.includes('need to') || 
     c.text.includes('should') ||
     c.text.includes('will') ||
     c.text.includes('plan') ||
     c.text.includes('want') ||
     c.text.length > 50)
  ).length;

  if (factCount < MIN_FACTS_FOR_PROPOSAL) {
    console.log(`Not enough facts (${factCount}) for proposal: ${suggestedName}`);
    return false;
  }

  // Create draft project
  const { data: draftProject, error: projError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: suggestedName,
      status: 'draft',
    })
    .select()
    .single();

  if (projError || !draftProject) {
    console.error('Failed to create draft project:', projError);
    return false;
  }

  // Create proposal
  const { error: proposalError } = await supabase
    .from('proposals')
    .insert({
      session_id: sessionId,
      workspace_id: workspaceId,
      draft_project_id: draftProject.id,
      suggested_name: suggestedName,
      content_draft: contentDraft,
      status: 'pending',
    });

  if (proposalError) {
    console.error('Failed to create proposal:', proposalError);
    // Clean up draft project
    await supabase.from('projects').delete().eq('id', draftProject.id);
    return false;
  }

  console.log(`Created proposal for: ${suggestedName}`);
  return true;
}
