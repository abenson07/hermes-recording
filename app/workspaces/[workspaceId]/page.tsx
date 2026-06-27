'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import type { Project } from '@/types/database';

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  
  const [workspaceName, setWorkspaceName] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceAndProjects();
    }
  }, [workspaceId]);

  const loadWorkspaceAndProjects = async () => {
    try {
      // Load workspace details
      const wsResponse = await fetch('/api/workspaces');
      if (!wsResponse.ok) throw new Error('Failed to fetch workspace');
      const wsData = await wsResponse.json();
      const workspace = wsData.workspaces?.find((w: { id: string; name: string }) => w.id === workspaceId);
      if (workspace) {
        setWorkspaceName(workspace.name);
      }

      // Load projects
      const projResponse = await fetch(`/api/workspaces/${workspaceId}/projects`);
      if (!projResponse.ok) throw new Error('Failed to fetch projects');
      const projData = await projResponse.json();
      setProjects(projData.projects || []);
    } catch (err) {
      setError('Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName }),
      });

      if (!response.ok) throw new Error('Failed to create');
      
      setNewProjectName('');
      loadWorkspaceAndProjects();
    } catch (err) {
      setError('Failed to create project');
    } finally {
      setCreating(false);
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
            <h1 className="text-2xl font-bold mt-2">{workspaceName}</h1>
          </div>
          <Link href={`/workspaces/${workspaceId}/inbox`}>
            <Button variant="secondary">View Inbox</Button>
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}

        {/* Create Project Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createProject} className="flex gap-4">
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="flex-1"
              />
              <Button type="submit" disabled={creating || !newProjectName.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Projects List */}
        {projects.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No projects yet. Create one to start recording.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <div key={project.id} className="space-y-2">
                <Link href={`/context/${project.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-500">
                        Status: {project.status}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                <div className="flex gap-2">
                  <Link href={`/record?workspaceId=${workspaceId}&projectId=${project.id}`} className="flex-1">
                    <Button className="w-full" size="sm">
                      Record
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
