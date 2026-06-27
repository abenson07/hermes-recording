interface Chunk {
  timestamp: string;
  text: string;
}

export async function createInboxItems(
  supabase: any,
  workspaceId: string,
  sessionId: string,
  chunks: Chunk[]
): Promise<number> {
  let created = 0;

  for (const chunk of chunks) {
    // Skip very short entries
    if (chunk.text.length < 10) continue;

    const { error } = await supabase
      .from('inbox_items')
      .insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        text: chunk.text,
      });

    if (error) {
      console.error('Failed to create inbox item:', error);
    } else {
      created++;
    }
  }

  console.log(`Created ${created} inbox items`);
  return created;
}
