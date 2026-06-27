import { runRouter } from './router';
import { runExtractor } from './extractor';
import { createProposals } from './proposals';
import { createInboxItems } from './inbox';

interface DistillationResult {
  projectsUpdated: string[];
  proposalsCreated: number;
  inboxItemsCreated: number;
}

export async function runDistillationPipeline(
  supabase: any,
  sessionId: string,
  projectId: string,
  workspaceId: string
): Promise<DistillationResult> {
  const result: DistillationResult = {
    projectsUpdated: [],
    proposalsCreated: 0,
    inboxItemsCreated: 0,
  };

  // 1. Load transcript lines
  const { data: transcriptLines, error: tlError } = await supabase
    .from('transcript_lines')
    .select('*')
    .eq('session_id', sessionId)
    .order('sequence', { ascending: true });

  if (tlError || !transcriptLines || transcriptLines.length === 0) {
    console.log('No transcript lines to process');
    return result;
  }

  // 2. Load existing context files for the project
  const { data: contextFiles, error: cfError } = await supabase
    .from('context_files')
    .select('*')
    .eq('project_id', projectId);

  if (cfError) {
    console.error('Context files fetch error:', cfError);
  }

  const existingSlugs = (contextFiles || []).map((cf: { slug: string }) => cf.slug);

  // 3. Filter USER utterances in capture mode (ignore agent responses and conversation mode)
  const userUtterances = transcriptLines.filter(
    (line: { entry_type: string; speaker: string | null; mode: string | null; text: string | null }) =>
      line.entry_type === 'utterance' &&
      line.speaker === 'USER' &&
      line.mode === 'capture' &&
      line.text &&
      line.text.trim().length > 0
  );

  if (userUtterances.length === 0) {
    console.log('No user utterances to process');
    return result;
  }

  // 4. Route utterances
  const routed = await runRouter(userUtterances, existingSlugs);

  // 5. Group by route
  const grouped: Record<string, typeof userUtterances> = {};
  for (const item of routed) {
    if (!grouped[item.route]) {
      grouped[item.route] = [];
    }
    grouped[item.route].push(item);
  }

  // 6. Process each group
  for (const [route, chunks] of Object.entries(grouped)) {
    if (route === 'inbox') {
      // Route to inbox
      const count = await createInboxItems(supabase, workspaceId, sessionId, chunks);
      result.inboxItemsCreated += count;
    } else if (route.startsWith('new:')) {
      // Check for new project proposal
      const projectName = route.substring(4);
      const proposalCreated = await createProposals(supabase, sessionId, workspaceId, projectName, chunks);
      if (proposalCreated) {
        result.proposalsCreated++;
      } else {
        // Not enough content, route to inbox
        const count = await createInboxItems(supabase, workspaceId, sessionId, chunks);
        result.inboxItemsCreated += count;
      }
    } else {
      // Existing context file
      const existingFile = contextFiles?.find((cf: { slug: string }) => cf.slug === route);
      if (existingFile) {
        await runExtractor(supabase, existingFile, chunks);
        if (!result.projectsUpdated.includes(projectId)) {
          result.projectsUpdated.push(projectId);
        }
      } else {
        // Unknown slug, route to inbox
        const count = await createInboxItems(supabase, workspaceId, sessionId, chunks);
        result.inboxItemsCreated += count;
      }
    }
  }

  return result;
}
