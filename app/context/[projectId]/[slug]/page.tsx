'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import ReactMarkdown from 'react-markdown';
import type { ContextFile } from '@/types/database';

export default function ContextFilePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const slug = params.slug as string;
  
  const [file, setFile] = useState<ContextFile | null>(null);
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && slug) {
      loadContextFile();
    }
  }, [projectId, slug]);

  const loadContextFile = async () => {
    try {
      const response = await fetch(`/api/context/${projectId}/${slug}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setFile(data.file);
      setContent(data.file?.content || '');
    } catch (err) {
      setError('Failed to load context file');
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/context/${projectId}/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error('Failed to save');
      
      setIsEditing(false);
      loadContextFile();
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen p-8">
        <div className="text-center text-slate-500">Context file not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href={`/context/${projectId}`} className="text-sm text-slate-500 hover:text-slate-900">
              ← Back to Files
            </Link>
            <h1 className="text-2xl font-bold mt-2">{file.title}</h1>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={() => setIsEditing(false)} variant="secondary">
                  Cancel
                </Button>
                <Button onClick={saveContent} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="secondary">
                Edit
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
          <CardContent className="p-6">
            {isEditing ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
              />
            ) : (
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 text-sm text-slate-500">
          Last updated: {new Date(file.updated_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
