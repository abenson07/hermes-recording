export async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Tavily API key not configured');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: 'basic',
      include_answer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json();
  
  // Format results
  const answer = data.answer || '';
  const results = data.results || [];
  
  let formatted = answer ? `${answer}\n\nSources:\n` : 'Search results:\n';
  
  results.forEach((r: { title: string; content: string; url: string }, idx: number) => {
    formatted += `${idx + 1}. ${r.title}\n${r.content.substring(0, 200)}...\n\n`;
  });

  return formatted;
}

export const webSearchToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description: 'Search the web for general knowledge and current information. Use this when the question is about general knowledge, current events, or topics not covered in the project context.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up',
        },
      },
      required: ['query'],
    },
  },
};
