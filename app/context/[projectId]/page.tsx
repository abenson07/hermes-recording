'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ContextFile } from '@/types/database';

export default function ProjectContextPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadContextFiles();
    }
  }, [projectId]);

  const loadContextFiles = async () => {
    try {
      const response = await fetch(`/api/context/${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setFiles(data.files || []);
      setProjectName(data.projectName || 'Unknown Project');
    } catch (err) {
      setError('Failed to load context files');
    } finally {
      setLoading(false);
    }
  };

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
          <div>
            <Link href="/workspaces" className="text-sm text-slate-500 hover:text-slate-900">
              ← Back to Workspaces
            </Link>
            <h1 className="text-2xl font-bold mt-2">{projectName}</h1>
            <p className="text-sm text-slate-500">Context Files</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}

        {files.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No context files yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {files.map((file) => (
              <Link key={file.id} href={`/context/${projectId}/${file.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle>{file.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Slug: {file.slug}</span>
                      <span>Updated: {new Date(file.updated_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
