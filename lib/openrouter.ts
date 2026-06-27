import OpenAI from 'openai';

export function createOpenRouterClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY!,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
      'X-Title': 'Hermes Recorder',
    },
  });
}

export const MODELS = {
  router: process.env.OPENROUTER_MODEL_ROUTER || 'anthropic/claude-3.5-haiku',
  distillation: process.env.OPENROUTER_MODEL_DISTILLATION || 'anthropic/claude-sonnet-4',
  agent: process.env.OPENROUTER_MODEL_AGENT || 'anthropic/claude-sonnet-4',
} as const;
