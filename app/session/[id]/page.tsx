'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { TranscriptLineRow } from '@/types/database';

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<{
    id: string;
    status: string;
    started_at: string;
    ended_at: string | null;
    workspace: { name: string };
    project: { name: string };
  } | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setSession(data.session);
      setTranscript(data.transcript || []);
    } catch (err) {
      setError('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const retryDistillation = async () => {
    setRetrying(true);
    try {
      await fetch('/api/distill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      loadSession();
    } catch (err) {
      setError('Failed to retry distillation');
    } finally {
      setRetrying(false);
    }
  };

  const formatTranscript = (lines: TranscriptLineRow[]) => {
    return lines.map((line) => {
      if (line.entry_type === 'mode_change') {
        return `\n--- ${line.mode_change_to?.toUpperCase()} MODE ---\n`;
      }
      const speaker = line.speaker || 'UNKNOWN';
      return `[${line.timestamp}] **${speaker}**: ${line.text}`;
    }).join('\n\n');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen p-8">
        <div className="text-center text-slate-500">Session not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link href="/workspaces" className="text-sm text-slate-500 hover:text-slate-900">
              ← Back to Workspaces
            </Link>
            <h1 className="text-2xl font-bold mt-2">Session</h1>
            <p className="text-sm text-slate-500 mt-1">
              {session.workspace?.name} → {session.project?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              session.status === 'complete' 
                ? 'bg-green-100 text-green-800'
                : session.status === 'processing'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {session.status}
            </span>
            {session.status === 'processing' && (
              <Button onClick={retryDistillation} disabled={retrying} size="sm">
                {retrying ? 'Retrying...' : 'Retry'}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            {transcript.length === 0 ? (
              <div className="text-slate-500 text-center py-8">
                No transcript entries yet
              </div>
            ) : (
              <div className="space-y-4">
                {transcript.map((line, idx) => (
                  <div key={idx} className="text-sm">
                    {line.entry_type === 'mode_change' ? (
                      <div className="text-center text-slate-500 my-4 py-2 border-y border-slate-200">
                        --- {line.mode_change_to?.toUpperCase()} MODE ---
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <span className="font-mono text-slate-400 w-16 flex-shrink-0">
                          [{line.timestamp}]
                        </span>
                        <span className="font-semibold w-16 flex-shrink-0">
                          {line.speaker}:
                        </span>
                        <span className="flex-1">{line.text}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {session.started_at && (
          <div className="mt-4 text-sm text-slate-500">
            Started: {new Date(session.started_at).toLocaleString()}
            {session.ended_at && (
              <span> • Ended: {new Date(session.ended_at).toLocaleString()}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
