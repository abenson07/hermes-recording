# Hermes Recorder — Setup Guide

Step-by-step instructions to create accounts, collect API keys, configure environment variables, and initialize the Supabase database.

**Related docs:**
- [PRD](./hermes-recorder-prd.md)
- [Implementation Spec](./implementation-spec.md)
- [Build Checklist](./build-checklist.md)

---

## 1. Overview

Before writing code, you need:

1. A Supabase project (database + auth)
2. API keys for Deepgram, OpenRouter, TTS, and web search
3. A local `.env.local` file
4. The SQL script below run in Supabase

Estimated setup time: **30–45 minutes**.

---

## 2. Accounts to Create

Create accounts at each service below. Free tiers are sufficient for development.

### 2.1 Supabase (required)

- **URL:** https://supabase.com
- **Plan:** Free tier is fine for MVP
- **Steps:**
  1. Sign up / log in
  2. Click **New Project**
  3. Choose organization, name it `hermes-recorder` (or similar)
  4. Set a strong database password — save it in a password manager
  5. Pick a region close to you
  6. Wait ~2 minutes for provisioning

### 2.2 Deepgram (required — speech-to-text)

- **URL:** https://console.deepgram.com
- **Plan:** Pay-as-you-go; ~$200 free credit for new accounts
- **Steps:**
  1. Sign up
  2. Go to **API Keys**
  3. Create a key named `hermes-dev`
  4. Copy the key — you won't see it again

### 2.3 OpenRouter (required — router, distillation, agent)

OpenRouter is a unified LLM gateway. One API key routes to any model — you configure model slugs via env vars.

- **URL:** https://openrouter.ai
- **Plan:** Add credits; pay per model usage (~$0.10–0.30 per session)
- **Steps:**
  1. Sign up
  2. Go to **Keys** → https://openrouter.ai/keys
  3. Create key named `hermes-dev`
  4. Copy the key → `OPENROUTER_API_KEY`
  5. Browse models at https://openrouter.ai/models and set:
     - `OPENROUTER_MODEL_ROUTER` — fast/cheap model for transcript routing (e.g. `anthropic/claude-3.5-haiku`)
     - `OPENROUTER_MODEL_DISTILLATION` — capable model for context file updates (e.g. `anthropic/claude-sonnet-4`)
     - `OPENROUTER_MODEL_AGENT` — capable model for conversation mode (e.g. `anthropic/claude-sonnet-4`)

**Note:** Model slugs use the `provider/model-name` format from OpenRouter's model list. You can swap models without code changes — just update env vars.

### 2.4 OpenAI OR Cartesia (required — one TTS provider)

Pick **one** TTS provider:

**Option A: OpenAI TTS (simpler)**

- **URL:** https://platform.openai.com
- **Steps:** Create API key under **API Keys**
- Set `TTS_PROVIDER=openai`

**Option B: Cartesia (lower latency streaming)**

- **URL:** https://cartesia.ai
- **Steps:** Sign up, create API key
- Set `TTS_PROVIDER=cartesia`

### 2.5 Tavily (required — agent web search)

- **URL:** https://tavily.com
- **Plan:** Free tier (1,000 searches/month)
- **Steps:** Sign up, copy API key from dashboard

### 2.6 Vercel (required for deployment)

- **URL:** https://vercel.com
- **Steps:** Sign up with GitHub. Link repo after code is pushed. Add env vars in project settings.

---

## 3. API Keys Reference

| Service | Env Variable | Server or Client | Where to Find |
|---------|-------------|------------------|---------------|
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase → Project Settings → API → Project URL |
| Supabase Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Same page → `anon` `public` key |
| Supabase Service Role | `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Same page → `service_role` key (never expose to client) |
| Deepgram | `DEEPGRAM_API_KEY` | **Server only** | Deepgram Console → API Keys |
| OpenRouter | `OPENROUTER_API_KEY` | **Server only** | https://openrouter.ai/keys |
| Router model | `OPENROUTER_MODEL_ROUTER` | Server | OpenRouter model slug (e.g. `anthropic/claude-3.5-haiku`) |
| Distillation model | `OPENROUTER_MODEL_DISTILLATION` | Server | OpenRouter model slug (e.g. `anthropic/claude-sonnet-4`) |
| Agent model | `OPENROUTER_MODEL_AGENT` | Server | OpenRouter model slug (e.g. `anthropic/claude-sonnet-4`) |
| OpenRouter referer | `OPENROUTER_HTTP_REFERER` | Server (optional) | Your app URL; sent as attribution header |
| OpenAI | `OPENAI_API_KEY` | **Server only** | OpenAI Platform → API Keys |
| Cartesia | `CARTESIA_API_KEY` | **Server only** | Cartesia Dashboard |
| Tavily | `TAVILY_API_KEY` | **Server only** | Tavily Dashboard |
| TTS provider | `TTS_PROVIDER` | Server | Set to `openai` or `cartesia` |
| App URL | `NEXT_PUBLIC_APP_URL` | Server | `http://localhost:3000` locally; Vercel URL in production |

**Security rule:** Only `NEXT_PUBLIC_*` variables are exposed to the browser. All API keys for Deepgram, OpenRouter, OpenAI, Cartesia, Tavily, and the Supabase service role must stay server-side.

---

## 4. Local Environment Setup

1. Copy the example env file:

```bash
cp .env.example .env.local
```

2. Fill in every value in `.env.local`
3. Never commit `.env.local` to git (it's in `.gitignore` by default)

---

## 5. Supabase Project Configuration

### 5.1 Enable Email Auth

1. In Supabase dashboard → **Authentication** → **Providers**
2. Enable **Email**
3. For MVP dev, disable "Confirm email" under **Email** settings (optional — speeds up testing)
4. Save

### 5.2 Run the Database Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy the **entire SQL block in Section 6** below
4. Click **Run**
5. You should see "Success. No rows returned"

### 5.3 Copy Project Credentials

1. Go to **Project Settings** → **API**
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## 6. Full Database Schema (Copy-Paste)

Copy everything below into the Supabase SQL Editor and run it as a single script.

```sql
-- ============================================================
-- Hermes Recorder — Full Database Schema
-- Run once in Supabase SQL Editor
-- ============================================================

begin;

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type project_status as enum ('active', 'draft');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type session_status as enum ('active', 'processing', 'complete');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type proposal_status as enum ('pending', 'confirmed', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type transcript_entry_type as enum ('utterance', 'mode_change');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type transcript_speaker as enum ('USER', 'AGENT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type session_mode as enum ('capture', 'conversation');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  status project_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.context_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug text not null,
  title text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status session_status not null default 'active',
  mode session_mode not null default 'capture',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.transcript_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  sequence integer not null,
  entry_type transcript_entry_type not null,
  speaker transcript_speaker,
  mode session_mode,
  timestamp text not null,
  text text,
  mode_change_to session_mode,
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  draft_project_id uuid references public.projects(id) on delete set null,
  suggested_name text not null,
  content_draft text not null default '',
  status proposal_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  text text not null,
  routed_to_project_id uuid references public.projects(id) on delete set null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_workspaces_user_id on public.workspaces(user_id);
create index if not exists idx_projects_workspace_id on public.projects(workspace_id);
create index if not exists idx_context_files_project_id on public.context_files(project_id);
create index if not exists idx_sessions_user_id_status on public.sessions(user_id, status);
create index if not exists idx_sessions_project_id on public.sessions(project_id);
create index if not exists idx_transcript_lines_session_sequence on public.transcript_lines(session_id, sequence);
create index if not exists idx_proposals_workspace_status on public.proposals(workspace_id, status);
create index if not exists idx_inbox_items_workspace_active on public.inbox_items(workspace_id) where dismissed_at is null;

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists context_files_updated_at on public.context_files;
create trigger context_files_updated_at
  before update on public.context_files
  for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ============================================================
-- HELPER: get next transcript sequence
-- ============================================================

create or replace function public.next_transcript_sequence(p_session_id uuid)
returns integer as $$
  select coalesce(max(sequence), 0) + 1
  from public.transcript_lines
  where session_id = p_session_id;
$$ language sql stable;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.context_files enable row level security;
alter table public.sessions enable row level security;
alter table public.transcript_lines enable row level security;
alter table public.proposals enable row level security;
alter table public.inbox_items enable row level security;
alter table public.user_preferences enable row level security;

-- Workspaces: owner only
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own" on public.workspaces
  for select using (auth.uid() = user_id);
drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own" on public.workspaces
  for insert with check (auth.uid() = user_id);
drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own" on public.workspaces
  for update using (auth.uid() = user_id);
drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_delete_own" on public.workspaces
  for delete using (auth.uid() = user_id);

-- Projects: via workspace ownership
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select using (
    exists (
      select 1 from public.workspaces w
      where w.id = projects.workspace_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update using (
    exists (
      select 1 from public.workspaces w
      where w.id = projects.workspace_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects
  for delete using (
    exists (
      select 1 from public.workspaces w
      where w.id = projects.workspace_id and w.user_id = auth.uid()
    )
  );

-- Context files: via project → workspace
drop policy if exists "context_files_select" on public.context_files;
create policy "context_files_select" on public.context_files
  for select using (
    exists (
      select 1 from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = context_files.project_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "context_files_insert" on public.context_files;
create policy "context_files_insert" on public.context_files
  for insert with check (
    exists (
      select 1 from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = project_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "context_files_update" on public.context_files;
create policy "context_files_update" on public.context_files
  for update using (
    exists (
      select 1 from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = context_files.project_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "context_files_delete" on public.context_files;
create policy "context_files_delete" on public.context_files
  for delete using (
    exists (
      select 1 from public.projects p
      join public.workspaces w on w.id = p.workspace_id
      where p.id = context_files.project_id and w.user_id = auth.uid()
    )
  );

-- Sessions: owner only
drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own" on public.sessions
  for select using (auth.uid() = user_id);
drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own" on public.sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "sessions_update_own" on public.sessions;
create policy "sessions_update_own" on public.sessions
  for update using (auth.uid() = user_id);

-- Transcript lines: via session ownership
drop policy if exists "transcript_lines_select" on public.transcript_lines;
create policy "transcript_lines_select" on public.transcript_lines
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = transcript_lines.session_id and s.user_id = auth.uid()
    )
  );
drop policy if exists "transcript_lines_insert" on public.transcript_lines;
create policy "transcript_lines_insert" on public.transcript_lines
  for insert with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Proposals: via workspace ownership
drop policy if exists "proposals_select" on public.proposals;
create policy "proposals_select" on public.proposals
  for select using (
    exists (
      select 1 from public.workspaces w
      where w.id = proposals.workspace_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "proposals_update" on public.proposals;
create policy "proposals_update" on public.proposals
  for update using (
    exists (
      select 1 from public.workspaces w
      where w.id = proposals.workspace_id and w.user_id = auth.uid()
    )
  );

-- Inbox items: via workspace ownership
drop policy if exists "inbox_items_select" on public.inbox_items;
create policy "inbox_items_select" on public.inbox_items
  for select using (
    exists (
      select 1 from public.workspaces w
      where w.id = inbox_items.workspace_id and w.user_id = auth.uid()
    )
  );
drop policy if exists "inbox_items_update" on public.inbox_items;
create policy "inbox_items_update" on public.inbox_items
  for update using (
    exists (
      select 1 from public.workspaces w
      where w.id = inbox_items.workspace_id and w.user_id = auth.uid()
    )
  );

-- User preferences: owner only
drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own" on public.user_preferences
  for select using (auth.uid() = user_id);
drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own" on public.user_preferences
  for insert with check (auth.uid() = user_id);
drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own" on public.user_preferences
  for update using (auth.uid() = user_id);

commit;
```

---

## 7. Verify Setup

Run these queries in the SQL Editor after the schema script succeeds.

### 7.1 Confirm tables exist

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'workspaces', 'projects', 'context_files', 'sessions',
    'transcript_lines', 'proposals', 'inbox_items', 'user_preferences'
  )
order by table_name;
```

Expected: 8 rows.

### 7.2 Confirm RLS is enabled

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('workspaces', 'sessions', 'transcript_lines');
```

Expected: all show `rowsecurity = true`.

### 7.3 Test after first login (manual)

After signing up in the app:

```sql
-- Replace with your auth user id from Authentication → Users
select id, email from auth.users limit 5;
```

Create a workspace via the app UI, then verify:

```sql
select * from public.workspaces;
select * from public.projects;
```

---

## 8. Deploy Environment Variables (Vercel)

When deploying to Vercel, add these in **Project Settings → Environment Variables**:

| Variable | Environments |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview |
| `DEEPGRAM_API_KEY` | Production, Preview |
| `OPENROUTER_API_KEY` | Production, Preview |
| `OPENROUTER_MODEL_ROUTER` | Production, Preview |
| `OPENROUTER_MODEL_DISTILLATION` | Production, Preview |
| `OPENROUTER_MODEL_AGENT` | Production, Preview |
| `TTS_PROVIDER` | Production, Preview |
| `OPENAI_API_KEY` or `CARTESIA_API_KEY` | Production, Preview |
| `TAVILY_API_KEY` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | Production (`https://your-app.vercel.app`) |

**Note:** Deepgram WebSocket proxy and distillation jobs require server-side keys. Vercel serverless functions handle this; no extra infra needed for MVP.

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| SQL fails with "type already exists" | Script uses idempotent guards; safe to re-run. If stuck, drop types manually or use a fresh Supabase project. |
| RLS blocks inserts | Ensure user is authenticated; `auth.uid()` must match `user_id` on workspaces/sessions. |
| STT not working | Verify `DEEPGRAM_API_KEY` is set server-side; client must connect to `/api/stt/stream`, not Deepgram directly. |
| Distillation stuck on `processing` | Check Vercel function logs; manually POST to `/api/distill` with `{ "sessionId": "..." }`. |
| Auth redirect loop | Check middleware excludes `/login` and Supabase URL/keys match the project. |

---

## 10. Optional: Seed Data

After your first login, you can insert test data manually (replace `YOUR_USER_ID`):

```sql
insert into public.workspaces (user_id, name)
values ('YOUR_USER_ID', 'Personal')
returning id;

-- Use returned workspace id:
insert into public.projects (workspace_id, name)
values ('WORKSPACE_ID', 'Dashboard');

insert into public.context_files (project_id, slug, title, content)
values (
  'PROJECT_ID',
  'general',
  'General',
  '# General Context

No content yet.'
);

insert into public.user_preferences (user_id, preferences)
values ('YOUR_USER_ID', '{"tone": "concise", "name": "User"}'::jsonb)
on conflict (user_id) do nothing;
```
