import { createOpenRouterClient, MODELS } from '@/lib/openrouter';
import type { ContextFile } from '@/types/database';

interface Chunk {
  timestamp: string;
  text: string;
}

export async function runExtractor(
  supabase: any,
  existingFile: ContextFile,
  chunks: Chunk[]
): Promise<void> {
  // Skip empty chunks
  if (chunks.length === 0) {
    return;
  }

  const openrouter = createOpenRouterClient();
  const todayDate = new Date().toISOString().split('T')[0];

  const prompt = `You are a context file distiller. Update the markdown context file with new information from a voice session.

## Existing context file: ${existingFile.slug}
${existingFile.content}

## New utterances for this file
${JSON.stringify(chunks, null, 2)}

## Instructions
Extract and merge ONLY high-signal content:
- Decisions made
- Tasks (use checkbox format: - [ ] task)
- Facts about the project
- Intentions expressed

Discard:
- Filler, rambling, repeated points
- Questions without answers
- Statements the user retracted or corrected (keep only the correction)

## Conflict handling
If new content contradicts existing content:
- Tag the old statement: [SUPERSEDED: ${todayDate}]
- Add the new statement with timestamp ${todayDate}
- Append both entries to ## Changelog at bottom

## Output
Return the COMPLETE updated markdown file. Include all existing content unless superseded. Maintain structure with ## headings. Always include ## Changelog section at the end (create if missing).`;

  try {
    const response = await openrouter.chat.completions.create({
      model: MODELS.distillation,
      messages: [{ role: 'user', content: prompt }],
    });

    const updatedContent = response.choices[0]?.message?.content;
    if (!updatedContent) {
      throw new Error('Empty response from extractor');
    }

    // Update the context file
    const { error } = await supabase
      .from('context_files')
      .update({ content: updatedContent })
      .eq('id', existingFile.id);

    if (error) {
      console.error('Failed to update context file:', error);
      throw error;
    }

    console.log(`Updated context file: ${existingFile.slug}`);
  } catch (err) {
    console.error('Extractor error:', err);
    throw err;
  }
}
