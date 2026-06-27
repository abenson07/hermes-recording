'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { InboxItem, Project } from '@/types/database';

export default function InboxPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  
  const [items, setItems] = useState<InboxItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentItem, setCurrentItem] = useState<InboxItem | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      loadData();
    }
  }, [workspaceId]);

  const loadData = async () => {
    try {
      const [itemsRes, projectsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/inbox`),
        fetch(`/api/workspaces/${workspaceId}/projects`),
      ]);

      if (!itemsRes.ok || !projectsRes.ok) throw new Error('Failed to fetch');
      
      const itemsData = await itemsRes.json();
      const projectsData = await projectsRes.json();
      
      setItems(itemsData.items || []);
      setProjects(projectsData.projects || []);
      setCurrentItem(itemsData.items?.[0] || null);
    } catch (err) {
      console.error('Failed to load inbox data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoute = async () => {
    if (!currentItem || !selectedProjectId) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/inbox/${currentItem.id}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });

      if (!response.ok) throw new Error('Failed to route');
      
      // Move to next item
      setItems(prev => prev.filter(i => i.id !== currentItem.id));
      setCurrentItem(items.find(i => i.id !== currentItem.id) || null);
      setSelectedProjectId('');
    } catch (err) {
      console.error('Route error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDismiss = async () => {
    if (!currentItem) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/inbox/${currentItem.id}/dismiss`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to dismiss');
      
      // Move to next item
      setItems(prev => prev.filter(i => i.id !== currentItem.id));
      setCurrentItem(items.find(i => i.id !== currentItem.id) || null);
    } catch (err) {
      console.error('Dismiss error:', err);
    } finally {
      setProcessing(false);
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
            <Link href={`/workspaces/${workspaceId}`} className="text-sm text-slate-500 hover:text-slate-900">
              ← Back to Workspace
            </Link>
            <h1 className="text-2xl font-bold mt-2">Inbox</h1>
          </div>
          <div className="text-sm text-slate-500">
            {items.length} item{items.length !== 1 ? 's' : ''} remaining
          </div>
        </div>

        {!currentItem ? (
          <div className="text-center py-12 text-slate-500">
            Inbox is empty.
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Review Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 p-6 rounded-md mb-6">
                <p className="text-lg">{currentItem.text}</p>
                <p className="text-sm text-slate-500 mt-2">
                  From session on {new Date(currentItem.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Route to Project
                  </label>
                  <Select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Select project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={handleRoute}
                    disabled={!selectedProjectId || processing}
                    className="flex-1"
                  >
                    {processing ? 'Processing...' : 'Route to Project'}
                  </Button>
                  <Button
                    onClick={handleDismiss}
                    disabled={processing}
                    variant="secondary"
                    className="flex-1"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
