import { createOpenRouterClient, MODELS } from '@/lib/openrouter';

interface Utterance {
  timestamp: string;
  text: string;
}

interface RoutedUtterance extends Utterance {
  route: string;
}

export async function runRouter(
  utterances: Utterance[],
  existingSlugs: string[]
): Promise<RoutedUtterance[]> {
  // Skip empty utterances
  if (utterances.length === 0) {
    return [];
  }

  const openrouter = createOpenRouterClient();

  const prompt = `You are a transcript router for a voice capture app. Given utterances from a recording session, classify each utterance into a destination.

## Active project
Existing context file slugs: ${existingSlugs.join(', ') || 'general'}

## Utterances
${JSON.stringify(utterances, null, 2)}

## Output
Return ONLY a JSON array. Each item:
{
  "timestamp": "<from input>",
  "text": "<from input>",
  "route": "<slug>" | "inbox" | "new:<ProjectName>"
}

## Rules
- Route to the best matching existing slug when confident
- Route to "inbox" when content doesn't fit any slug or project topic
- Route to "new:<Name>" when content clearly describes a distinct new project/topic with a sensible name
- Ignore filler, "um", "okay", incomplete thoughts under 5 words
- Do NOT route agent responses (there are none in input)
- Prefer specific slugs over inbox when reasonable`;

  try {
    const response = await openrouter.chat.completions.create({
      model: MODELS.router,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from router');
    }

    // Parse the JSON array
    let parsed: RoutedUtterance[];
    try {
      const raw = JSON.parse(content);
      parsed = Array.isArray(raw) ? raw : raw.routes || raw.items || [];
    } catch (e) {
      console.error('Failed to parse router response:', content);
      // Fallback: route everything to 'general' or inbox
      return utterances.map(u => ({
        ...u,
        route: existingSlugs.includes('general') ? 'general' : 'inbox',
      }));
    }

    return parsed;
  } catch (err) {
    console.error('Router error:', err);
    // Fallback routing
    return utterances.map(u => ({
      ...u,
      route: existingSlugs.includes('general') ? 'general' : 'inbox',
    }));
  }
}
