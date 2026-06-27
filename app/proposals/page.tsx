'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { Proposal, Workspace } from '@/types/database';

interface ProposalWithWorkspace extends Proposal {
  workspace: Workspace;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<ProposalWithWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      const response = await fetch('/api/proposals');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (err) {
      console.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (proposalId: string) => {
    setProcessing(proposalId);
    try {
      const response = await fetch(`/api/project/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });

      if (!response.ok) throw new Error('Failed to confirm');
      loadProposals();
    } catch (err) {
      console.error('Confirm error:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (proposalId: string) => {
    setProcessing(proposalId);
    try {
      const response = await fetch(`/api/project/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });

      if (!response.ok) throw new Error('Failed to reject');
      loadProposals();
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setProcessing(null);
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
          <h1 className="text-2xl font-bold">Project Proposals</h1>
          <Link href="/workspaces">
            <Button variant="secondary">Back to Workspaces</Button>
          </Link>
        </div>

        {proposals.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No pending proposals.
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <Card key={proposal.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{proposal.suggested_name}</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">
                        Workspace: {proposal.workspace?.name}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      {proposal.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 p-4 rounded-md mb-4 max-h-48 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap">
                      {proposal.content_draft}
                    </pre>
                  </div>
                  <div className="flex gap-4">
                    <Button
                      onClick={() => handleConfirm(proposal.id)}
                      disabled={!!processing}
                      className="flex-1"
                    >
                      {processing === proposal.id ? 'Processing...' : 'Confirm'}
                    </Button>
                    <Button
                      onClick={() => handleReject(proposal.id)}
                      disabled={!!processing}
                      variant="secondary"
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
