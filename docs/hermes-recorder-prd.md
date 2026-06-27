# PRD: Voice Capture & Agent System

**Codename:** Hermes Recorder  
**Stack:** React (web), Supabase, Next.js API routes  
**Status:** MVP Spec  
**Last Updated:** June 2026

**Related docs:**
- [Setup & Supabase SQL](./setup-and-supabase.md)
- [Implementation Spec](./implementation-spec.md)
- [Build Checklist](./build-checklist.md)

---

## 1. Overview

A voice-first capture and conversation system. The core loop is: record freely → transcribe → distill into structured context files organized by workspace and project. An on-demand conversation mode allows real-time back-and-forth with an agent that has access to the current session transcript and pre-loaded project context.

The long-term goal is a thoughtless capture experience — open, record, close. Structure is inferred, proposed, and confirmed rather than manually assigned.

---

## 2. Core Concepts

### 2.1 Hierarchy

```
Workspace (e.g., MLCC, Midwestern Originals, Personal)
└── Project (e.g., Dashboard, Website, Garage Gym)
    └── Context Files (e.g., membership.md, volunteer-module.md)
```

- A user has multiple **Workspaces**
- Each Workspace has multiple **Projects**
- Each Project has multiple **Context Files** (markdown, maintained by the distillation layer)
- Each Project also has an **Inbox** — a catch-all for unrouted content (stored in `inbox_items` table, scoped to workspace)

### 2.2 Sessions

A **Session** is a continuous recording period. It has:

- A start time
- A required scope: Workspace + Project (both required in MVP)
- A transcript (full, with speaker labels and mode markers)
- A status: `active | processing | complete`

Sessions end explicitly. On end, the distillation job runs.

### 2.3 Modes

**Capture Mode** (default)

- Microphone is live, streaming STT
- No agent, no LLM calls
- Transcript accumulates silently

**Conversation Mode** (toggled)

- Agent is active
- Agent has access to: current session transcript + loaded project context files + user preferences
- Supports interruption — user can speak at any time to cut off agent response
- Toggle back to capture mode mid-session is allowed; transcript continues uninterrupted

---

## 3. Transcript Format

All transcripts are stored as structured rows in `transcript_lines` and can be rendered as markdown. Speaker labels distinguish user from agent. Mode transitions are marked inline.

```json
[
  { "speaker": "USER", "mode": "capture", "timestamp": "00:00:04", "text": "I want to rethink the volunteer module UX." },
  { "speaker": "USER", "mode": "capture", "timestamp": "00:01:12", "text": "Also need to revisit the membership tiers." },
  { "mode_change": "conversation", "timestamp": "00:02:00" },
  { "speaker": "USER", "mode": "conversation", "timestamp": "00:02:03", "text": "What did I say about the volunteer module?" },
  { "speaker": "AGENT", "mode": "conversation", "timestamp": "00:02:05", "text": "You mentioned wanting to rethink the UX for it." },
  { "mode_change": "capture", "timestamp": "00:03:10" }
]
```

Raw transcripts are always stored. They are the source of truth.

---

## 4. Distillation Layer

Runs **after session end**, not during. Sequential per context file — no parallel writes.

### 4.1 Pipeline

```
Session ends
→ Classify transcript chunks by project (router)
→ For each project touched:
    → Load existing context files for that project
    → Read-before-write: diff new content against existing
    → Extract: decisions, intentions, facts, tasks
    → Discard: rambling, agent responses, walked-back statements
    → Write updated context file
    → Flag conflicts with [SUPERSEDED] tag, don't silently overwrite
→ Check for content that doesn't match any existing project
    → If confidence > threshold: propose new project, stage content in draft
    → If confidence < threshold: route to Inbox
→ Surface proposals to user for confirmation
```

### 4.2 What Gets Stored

**Stored (signal):**

- Decisions made
- Tasks identified
- Facts stated about the project
- Intentions expressed

**Discarded (noise):**

- Agent responses
- Questions asked (unless the answer follows)
- Retracted statements
- Filler and transitions

### 4.3 Conflict Resolution

When new content contradicts existing context:

- Old statement gets tagged `[SUPERSEDED: <date>]`
- New statement is added with timestamp
- A `## Changelog` section at the bottom of each context file tracks these

### 4.4 New Project Proposals

When unrouted content is detected:

- If enough content clusters around a new topic → propose new project
- Content is staged in a draft project
- User sees: "I created 'Garage Gym' under Personal — want to keep it?"
- **Confirm** → project is created, content committed
- **Reject** → re-route job runs, redistributes content to existing projects or Inbox

Confidence threshold for proposal: configurable, default = enough content to fill at least 3 distinct facts/decisions.

---

## 5. Conversation Agent

### 5.1 Context Loading

When conversation mode is activated, the agent loads:

1. Current session transcript (full, up to that moment)
2. All context files for the active project scope
3. Global user preferences (lightweight, always loaded)

It does **not** search across workspaces or other projects unless explicitly asked.

### 5.2 Interruption Handling

- Deepgram VAD detects user speech onset
- TTS audio stream is killed immediately
- LLM response is flushed
- New user utterance begins processing
- Transcript captures both the partial agent response and the interruption

### 5.3 Web Search

Available as a tool the agent can reach for when:

- The question is clearly general knowledge (not memory recall)
- The agent determines it doesn't have the answer in loaded context

Not triggered by default. Agent decides when to use it. MVP uses Tavily API.

---

## 6. MVP Scope

### In Scope

- Single user (no auth complexity beyond basic login)
- Multiple Workspaces and Projects, manually created
- Explicit project selection before recording starts
- Capture mode + Conversation mode toggle
- STT via Deepgram Nova-3 (streaming)
- TTS via OpenAI TTS or Cartesia (streaming)
- Distillation job triggered on explicit session end
- Context files stored as markdown in Supabase
- Raw transcripts stored as structured rows in Supabase
- New project proposals with confirm/reject flow
- Inbox per workspace for unrouted content

### Out of Scope (V2+)

- Top-level capture without project selection
- Auto-scope inference from transcript content
- "End day" button that flushes a daily capture queue
- Cross-workspace search
- Mobile app (Bluetooth headphone support via browser Web Audio API is sufficient for MVP)

---

## 7. Recommended Architecture

### 7.1 Frontend (React / Next.js)

```
/app
  /record          → active recording screen
  /workspaces      → workspace + project browser
  /context         → context file viewer/editor
  /proposals       → new project confirmation queue
  /session/[id]    → transcript viewer
```

**Key React concerns:**

- `getUserMedia` for audio capture — browser handles Bluetooth routing automatically
- Audio chunks streamed to Deepgram via server WebSocket proxy
- TTS audio played via `AudioContext` with a kill-switch on interruption
- Mode toggle is a local state flag synced to DB (`capture | conversation`)
- Session state persisted to Supabase in real-time (transcript append, not batch)

### 7.2 Backend (Next.js API Routes)

```
POST /api/session/start         → create session record
POST /api/session/end           → trigger distillation job
POST /api/transcript/append     → append utterance to session transcript
GET  /api/stt/token             → short-lived token or WS upgrade for STT proxy
WS   /api/stt/stream            → WebSocket proxy to Deepgram
POST /api/agent/message         → conversation turn (returns streaming response)
POST /api/agent/tts             → TTS audio stream for agent response
POST /api/distill               → distillation job (async)
POST /api/project/confirm       → confirm proposed project
POST /api/project/reject        → reject + re-route
GET  /api/context/[projectId]   → load context files for a project
```

### 7.3 Database (Supabase)

See [setup-and-supabase.md](./setup-and-supabase.md) for full SQL.

```
workspaces        id, name, user_id, created_at
projects          id, workspace_id, name, status (active|draft), created_at
context_files     id, project_id, slug, title, content (markdown), updated_at
sessions          id, user_id, workspace_id, project_id, status, mode, started_at, ended_at
transcript_lines  id, session_id, sequence, entry_type, speaker, mode, timestamp, text, ...
proposals         id, session_id, suggested_name, workspace_id, content_draft, status
inbox_items       id, workspace_id, session_id, text, routed_to_project_id, dismissed_at
user_preferences  user_id, preferences (jsonb)
```

### 7.4 External Services

| Role | Service | Notes |
|------|---------|-------|
| STT | Deepgram Nova-3 | WebSocket streaming via server proxy |
| TTS | Cartesia or OpenAI TTS | Streaming audio chunks |
| Router / Classifier | OpenRouter → fast model (`OPENROUTER_MODEL_ROUTER`) | Cheap, fast, JSON output |
| Distillation | OpenRouter → capable model (`OPENROUTER_MODEL_DISTILLATION`) | Read-before-write per file |
| Conversation Agent | OpenRouter → capable model (`OPENROUTER_MODEL_AGENT`) | With web search tool available |
| Web Search | Tavily | Agent tool only |
| Database | Supabase | Postgres + auth |
| Hosting | Vercel | Next.js native |

### 7.5 Distillation Job (Async)

Triggered by `POST /api/session/end`. Runs as background job via internal fetch to `/api/distill`:

```
1. Load full session transcript
2. Call router model: classify each chunk → project slug (or "inbox" or "new:<name>")
3. Group chunks by project
4. For each project:
   a. Load all context files for that project
   b. Call distillation model: given [existing context] + [new chunks], return updated markdown
   c. Write updated context file to Supabase
5. For "new:" proposals:
   a. Check content volume vs. confidence threshold
   b. If sufficient: create draft project, write proposal record
   c. If not: route to inbox
6. Write all inbox items
7. Mark session status = complete
```

---

## 8. Model Cost Estimates

Per 20-minute session (rough):

- STT: Deepgram Nova-3 ~$0.01
- Haiku routing job: ~$0.01–0.02
- Sonnet distillation (per context file touched): ~$0.05–0.10
- Conversation turns (if used): ~$0.02–0.05 per turn
- TTS: ~$0.01–0.03 depending on response length

**Estimated cost per session: $0.10–$0.30** depending on how many projects are touched and how much conversation mode is used.

---

## 9. Resolved MVP Decisions

These resolve the PRD open questions for implementation:

| Question | MVP Decision |
|----------|--------------|
| Session scoping UX | User selects Workspace → Project on `/record` before starting. Both required. Scope locked for session. |
| Conflict flagging | Visible in context file via `[SUPERSEDED]` tags and `## Changelog`. No push notifications. |
| Inbox review flow | One item at a time at `/workspaces/[id]/inbox`. Actions: Route to project or Dismiss. |
| Context file editing | User can manually edit via markdown textarea on `/context/[projectId]/[slug]`. Save overwrites DB content. |
| Multi-project sessions | Not supported. One project per session enforced at DB and API level. |

---

## 10. User Flows

### Flow 1: First-time setup

1. User signs up / logs in at `/login`
2. Lands on `/workspaces`
3. Creates workspace "Personal"
4. Creates project "Dashboard" under Personal
5. Ready to record

### Flow 2: Record a capture session

1. User navigates to `/record`
2. Selects Workspace "Personal" and Project "Dashboard"
3. Clicks **Start Session**
4. Speaks freely in capture mode (default)
5. Transcript appears in real time
6. Clicks **End Session**
7. Redirected to `/session/[id]` showing "Processing…"
8. Within ~2 minutes, context files updated; session status becomes `complete`

### Flow 3: Conversation during session

1. User is recording (session active)
2. Toggles to **Conversation** mode
3. Asks: "What did I say about the volunteer module?"
4. Agent responds with text + TTS audio
5. User interrupts by speaking — agent audio stops, partial response saved
6. User toggles back to **Capture** mode
7. Continues dictating; ends session normally

### Flow 4: Confirm a new project proposal

1. After distillation, user visits `/proposals`
2. Sees: "Garage Gym under Personal — 4 facts captured"
3. Clicks **Confirm** → draft project becomes active, content committed to context files
4. Or clicks **Reject** → re-route job runs, content goes to existing projects or inbox

### Flow 5: Process inbox item

1. User visits `/workspaces/[workspaceId]/inbox`
2. Sees one unrouted item: "Need to call the electrician about the garage outlet"
3. Selects target project "Garage Gym" → **Route**
4. Item removed from inbox; optionally appended to a context file manually or in next distillation

### Flow 6: View and edit context

1. User navigates to `/context/[projectId]`
2. Sees list of context file slugs
3. Opens `/context/[projectId]/membership`
4. Reads distilled markdown; edits a paragraph; clicks **Save**

### Flow 7: View session transcript

1. User navigates to `/session/[id]`
2. Sees full transcript with speaker labels and mode change markers
3. Can retry distillation if session stuck in `processing`

---

## 11. Success Criteria (MVP)

- User can record a 10-minute session, end it, and within 2 minutes see updated context files with accurate distilled content
- Conversation mode responds within 1.5 seconds to first word heard
- Interruption cuts off agent audio within 300ms of user speech onset
- New project proposals are surfaced correctly at least 80% of the time for content clusters of 3+ distinct facts
- Raw transcripts are always preserved and queryable

---

## 12. Non-Goals (Do Not Build in MVP)

- Multi-project sessions or auto-scope inference
- Cross-workspace agent search
- Batch inbox processing
- Push notifications for conflicts
- Mobile native app
- Client-side Deepgram API key exposure
- Parallel distillation writes to the same context file
- Redis/job queue infrastructure (use internal API fetch)
