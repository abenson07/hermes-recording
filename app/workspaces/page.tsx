'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import type { Workspace } from '@/types/database';

export const dynamic = 'force-dynamic';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<any>(null);

  // Lazy load Supabase client
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      setSupabase(createClient());
    }).catch(() => {
      setError('Failed to initialize');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (supabase) {
      loadWorkspaces();
    }
  }, [supabase]);

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

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName }),
      });

      if (!response.ok) throw new Error('Failed to create');
      
      setNewWorkspaceName('');
      loadWorkspaces();
    } catch (err) {
      setError('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = '/login';
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
          <h1 className="text-2xl font-bold">Your Workspaces</h1>
          <Button variant="ghost" onClick={signOut}>
            Sign Out
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}

        {/* Create Workspace Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createWorkspace} className="flex gap-4">
              <Input
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name..."
                className="flex-1"
              />
              <Button type="submit" disabled={creating || !newWorkspaceName.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Workspaces List */}
        {workspaces.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No workspaces yet. Create one to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <Link key={workspace.id} href={`/workspaces/${workspace.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle>{workspace.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-500">
                      Created {new Date(workspace.created_at).toLocaleDateString()}
                    </p>
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
