'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import type { Workspace, Project } from '@/types/database';
import type { TranscriptLineClient } from '@/types/transcript';

export const dynamic = 'force-dynamic';

function RecordPageContent() {
  const searchParams = useSearchParams();
  const initialWorkspaceId = searchParams.get('workspaceId');
  const initialProjectId = searchParams.get('projectId');

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(initialWorkspaceId || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [loading, setLoading] = useState(true);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mode, setMode] = useState<'capture' | 'conversation'>('capture');
  const [transcript, setTranscript] = useState<TranscriptLineClient[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Load projects when workspace changes
  useEffect(() => {
    if (selectedWorkspaceId) {
      loadProjects(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      setError('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError('Failed to load projects');
    }
  };

  const startSession = async () => {
    if (!selectedWorkspaceId || !selectedProjectId) {
      setError('Please select both workspace and project');
      return;
    }

    try {
      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      setTranscript([]);
      setError(null);

      // Start STT
      await startSTT(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const startSTT = async (sid: string) => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create WebSocket connection to our STT proxy
      const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/stt/stream?sessionId=${sid}`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Set up MediaRecorder to send audio chunks
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(100); // Collect 100ms chunks
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleSTTMessage(msg);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Speech recognition error');
      };

      ws.onclose = () => {
        // Stop MediaRecorder when WebSocket closes
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
    } catch (err) {
      console.error('STT start error:', err);
      setError('Failed to start speech recognition');
    }
  };

  const handleSTTMessage = async (msg: { type: string; text?: string; timestamp?: string; is_final?: boolean }) => {
    if (msg.type === 'final' && msg.text) {
      const entry: TranscriptLineClient = {
        speaker: 'USER',
        mode,
        timestamp: formatElapsed(Date.now() - (startTimeRef.current || Date.now())),
        text: msg.text,
      };

      setTranscript(prev => [...prev, entry]);

      // Send to server
      if (sessionId) {
        await fetch('/api/transcript/append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            entries: [entry],
          }),
        });
      }
    }
  };

  const formatElapsed = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const toggleMode = async () => {
    const newMode = mode === 'capture' ? 'conversation' : 'capture';
    setMode(newMode);

    const entry: TranscriptLineClient = {
      timestamp: formatElapsed(Date.now() - (startTimeRef.current || Date.now())),
      mode_change: newMode,
    };

    setTranscript(prev => [...prev, entry]);

    if (sessionId) {
      await fetch('/api/transcript/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          entries: [entry],
        }),
      });
    }
  };

  const endSession = async () => {
    if (!sessionId) return;

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    setIsRecording(false);

    try {
      const response = await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to end session');
      }

      // Redirect to session view
      window.location.href = `/session/${sessionId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session');
    }
  };

  // Update elapsed time
  useEffect(() => {
    if (!isRecording || !startTimeRef.current) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current!);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Record Session</h1>
          {elapsedTime > 0 && (
            <div className="text-2xl font-mono">
              {formatElapsed(elapsedTime)}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}

        {!isRecording ? (
          <Card>
            <CardHeader>
              <CardTitle>Start New Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Workspace
                </label>
                <Select
                  value={selectedWorkspaceId}
                  onChange={(e) => {
                    setSelectedWorkspaceId(e.target.value);
                    setSelectedProjectId('');
                  }}
                >
                  <option value="">Select workspace...</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project
                </label>
                <Select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={!selectedWorkspaceId}
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Button
                onClick={startSession}
                disabled={!selectedWorkspaceId || !selectedProjectId}
                className="w-full"
                size="lg"
              >
                Start Recording
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Recording...</CardTitle>
                  <Button
                    onClick={toggleMode}
                    variant={mode === 'conversation' ? 'secondary' : 'primary'}
                  >
                    {mode === 'capture' ? 'Switch to Conversation' : 'Switch to Capture'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-500 mb-4">
                  Mode: <span className="font-medium">{mode}</span>
                </div>
                <Button onClick={endSession} variant="danger" className="w-full">
                  End Session
                </Button>
              </CardContent>
            </Card>

            {/* Transcript Feed */}
            <Card>
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 overflow-y-auto space-y-2 bg-slate-50 p-4 rounded-md">
                  {transcript.length === 0 ? (
                    <div className="text-slate-400 text-center">
                      Start speaking to see transcript...
                    </div>
                  ) : (
                    transcript.map((entry, idx) => (
                      <div key={idx} className="text-sm">
                        {entry.mode_change ? (
                          <div className="text-center text-slate-500 my-2">
                            --- {entry.mode_change.toUpperCase()} MODE ---
                          </div>
                        ) : (
                          <div>
                            <span className="font-mono text-slate-400">[{entry.timestamp}]</span>{' '}
                            <span className="font-semibold">{entry.speaker}:</span>{' '}
                            {entry.text}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    }>
      <RecordPageContent />
    </Suspense>
  );
}
