# Hermes Recorder

Voice-first capture and conversation system. Record → transcribe → distill into structured project context.

## Kimi Handoff — Start Here

This repo contains **documentation only**. Build the MVP by following these docs in order:

1. **[PRD](docs/hermes-recorder-prd.md)** — Product requirements, user flows, success criteria
2. **[Setup Guide](docs/setup-and-supabase.md)** — Accounts, API keys, env vars, copy-paste Supabase SQL
3. **[Implementation Spec](docs/implementation-spec.md)** — Repo structure, types, API contracts, prompts, architecture
4. **[Build Checklist](docs/build-checklist.md)** — Phased build order with acceptance tests

## Quick Start (for builder)

```bash
# 1. Copy env template
cp .env.example .env.local
# Fill in all values — see docs/setup-and-supabase.md

# 2. Run SQL in Supabase SQL Editor
# Copy from docs/setup-and-supabase.md Section 6

# 3. Scaffold and build per docs/build-checklist.md Phase 0
npx create-next-app@latest . --typescript --tailwind --eslint --app
```

## Stack

Next.js 15 · React · Supabase · Deepgram Nova-3 · OpenRouter (configurable models) · OpenAI/Cartesia TTS · Tavily

## MVP Guardrails

- One project per session (explicit selection before recording)
- Deepgram API key server-side only (WebSocket proxy)
- Distillation runs after session end, sequential per context file
- No Redis, no mobile app, no cross-workspace search in MVP
