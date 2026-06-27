import { NextResponse } from 'next/server';

// This is a simplified approach using Server-Sent Events instead of WebSockets
// for better compatibility with Next.js App Router

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
  
  if (!DEEPGRAM_API_KEY) {
    return NextResponse.json({ error: 'Deepgram not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as Blob;
    
    if (!audio) {
      return NextResponse.json({ error: 'No audio data' }, { status: 400 });
    }

    // Send to Deepgram for transcription
    const deepgramResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&punctuate=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm',
        },
        body: audio,
      }
    );

    if (!deepgramResponse.ok) {
      const error = await deepgramResponse.text();
      console.error('Deepgram error:', error);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const result = await deepgramResponse.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return NextResponse.json({
      text: transcript,
      confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
    });

  } catch (err) {
    console.error('STT error:', err);
    return NextResponse.json({ error: 'Failed to process audio' }, { status: 500 });
  }
}
