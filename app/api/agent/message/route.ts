import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createOpenRouterClient, MODELS } from '@/lib/openrouter';
import { loadAgentContext, formatTranscriptForAgent, formatContextFiles } from '@/lib/agent/context-loader';
import { buildSystemPrompt } from '@/lib/agent/prompts';
import { webSearch, webSearchToolDefinition } from '@/lib/tavily';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, userText } = await request.json();

    if (!sessionId || !userText) {
      return NextResponse.json({ error: 'sessionId and userText are required' }, { status: 400 });
    }

    // Load context
    const context = await loadAgentContext(sessionId);

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      projectName: context.session.projectName,
      workspaceName: context.session.workspaceName,
      contextFiles: formatContextFiles(context.contextFiles),
      transcript: formatTranscriptForAgent(context.transcript),
      preferences: context.preferences,
    });

    // Create OpenRouter client
    const openrouter = createOpenRouterClient();

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chatStream = await openrouter.chat.completions.create({
            model: MODELS.agent,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userText },
            ],
            tools: [webSearchToolDefinition],
            tool_choice: 'auto',
            stream: true,
          });

          let fullResponse = '';
          let toolCall: { name: string; arguments: string } | null = null;

          for await (const chunk of chatStream) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.tool_calls) {
              const tool = delta.tool_calls[0];
              if (tool?.function) {
                if (tool.function.name) {
                  toolCall = { name: tool.function.name, arguments: '' };
                }
                if (tool.function.arguments) {
                  toolCall!.arguments += tool.function.arguments;
                }
              }
            }

            if (delta?.content) {
              fullResponse += delta.content;
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ type: 'text_delta', text: delta.content })}\n\n`
                )
              );
            }
          }

          // Handle tool call if present
          if (toolCall?.name === 'web_search') {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'tool_call', name: toolCall.name })}\n\n`
              )
            );

            try {
              const args = JSON.parse(toolCall.arguments);
              const searchResult = await webSearch(args.query);
              
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ type: 'tool_result', name: 'web_search', result: searchResult })}\n\n`
                )
              );

              // Continue with tool result
              const followUpStream = await openrouter.chat.completions.create({
                model: MODELS.agent,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userText },
                  { role: 'assistant', content: fullResponse },
                  { role: 'tool', tool_call_id: 'search', content: searchResult },
                ],
                stream: true,
              });

              for await (const chunk of followUpStream) {
                const delta = chunk.choices[0]?.delta;
                if (delta?.content) {
                  fullResponse += delta.content;
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ type: 'text_delta', text: delta.content })}\n\n`
                    )
                  );
                }
              }
            } catch (err) {
              console.error('Web search error:', err);
            }
          }

          // Send completion
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'text_done', fullText: fullResponse })}\n\n`
            )
          );

          // Persist agent response to transcript
          const nextSeq = await getNextSequence(supabase, sessionId);
          await supabase.from('transcript_lines').insert({
            session_id: sessionId,
            sequence: nextSeq,
            entry_type: 'utterance',
            speaker: 'AGENT',
            mode: context.session.mode,
            timestamp: formatElapsed(context.session.started_at),
            text: fullResponse,
            mode_change_to: null,
          });

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'done' })}\n\n`
            )
          );

          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', message: 'Stream error' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Agent message error:', err);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}

async function getNextSequence(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string): Promise<number> {
  const { data } = await supabase
    .from('transcript_lines')
    .select('sequence')
    .eq('session_id', sessionId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return (data?.sequence ?? 0) + 1;
}

function formatElapsed(startedAt: string): string {
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
