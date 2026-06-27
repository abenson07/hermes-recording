// Deepgram WebSocket proxy helpers
export function createDeepgramUrl(): string {
  const params = new URLSearchParams({
    model: 'nova-3',
    interim_results: 'true',
    vad_events: 'true',
    endpointing: '300',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    punctuate: 'true',
  });

  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

export interface DeepgramResponse {
  type: 'Results' | 'SpeechStarted' | 'SpeechEnded' | 'Error' | 'Metadata';
  channel?: {
    alternatives: {
      transcript: string;
      confidence: number;
      words: {
        word: string;
        start: number;
        end: number;
        confidence: number;
      }[];
    }[];
  };
  is_final?: boolean;
  speech_final?: boolean;
  duration?: number;
  metadata?: {
    request_id: string;
  };
}
