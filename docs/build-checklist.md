# Hermes Recorder — Build Checklist

Phased build order for Kimi. Complete each phase in sequence. Do not skip ahead — later phases depend on earlier ones.

**Reference docs:**
- [PRD](./hermes-recorder-prd.md) — product requirements
- [Setup Guide](./setup-and-supabase.md) — accounts, env, SQL
- [Implementation Spec](./implementation-spec.md) — types, API contracts, prompts

---

## Phase 0: Project Scaffold

### Tasks

- [ ] `npx create-next-app@latest hermes-recording --typescript --tailwind --eslint --app --src-dir=false`
- [ ] Install dependencies:
  ```bash
  npm install @supabase/supabase-js @supabase/ssr openai
  npm install -D @types/node
  npx shadcn@latest init
  npx shadcn@latest add button card dialog select textarea toast dropdown-menu badge
  ```
- [ ] Copy `.env.example` → `.env.local`, fill all values
- [ ] Run Supabase SQL from [setup-and-supabase.md](./setup-and-supabase.md)
- [ ] Create `lib/supabase/client.ts`, `server.ts`, `middleware.ts` per Supabase SSR docs
- [ ] Create `middleware.ts` — protect routes, allow `/login`
- [ ] Create `app/login/page.tsx` — email/password sign in and sign up
- [ ] Create `app/page.tsx` — redirect to `/workspaces`
- [ ] Create `types/database.ts`, `types/transcript.ts`, `types/api.ts` from implementation spec

### Done when

- `npm run dev` starts without errors
- User can sign up, log in, and reach `/workspaces` (even if empty)
- Unauthenticated visit to `/workspaces` redirects to `/login`

### Manual test

1. Open http://localhost:3000
2. Sign up with test email/password
3. Confirm landing on `/workspaces`

---

## Phase 1: Workspaces & Projects CRUD

### Tasks

- [ ] `app/workspaces/page.tsx` — list workspaces, create dialog
- [ ] `app/workspaces/[workspaceId]/page.tsx` — list projects, create dialog
- [ ] API routes or server actions for:
  - Create workspace (`insert into workspaces`)
  - Create project (`insert into projects`)
  - List workspaces / projects (Supabase select with RLS)
- [ ] Navigation links between pages
- [ ] Empty states: "No workspaces yet — create one"

### Done when

- User can create workspace "Personal"
- User can create project "Dashboard" under Personal
- Data persists in Supabase (verify in dashboard)

### Manual test

1. Create workspace and project via UI
2. Refresh page — data still there
3. Check Supabase table editor

---

## Phase 2: Sessions & Transcript Persistence

### Tasks

- [ ] `POST /api/session/start` — full contract from implementation spec
- [ ] `POST /api/session/end` — set processing, trigger distill fetch (stub distill for now)
- [ ] `POST /api/transcript/append` — sequence assignment, mode_change handling
- [ ] `lib/transcript.ts` — format helpers
- [ ] `app/record/page.tsx` — workspace/project selectors, Start/End buttons (no STT yet)
- [ ] `app/session/[id]/page.tsx` — display transcript lines from DB
- [ ] Prevent multiple active sessions per user (409 on second start)

### Done when

- User can start session, manually append test transcript via API/curl, end session
- Session page shows transcript lines in order
- Session status transitions: active → processing

### Manual test

```bash
# After starting session via UI, test append:
curl -X POST http://localhost:3000/api/transcript/append \
  -H "Content-Type: application/json" \
  -H "Cookie: <session cookie>" \
  -d '{"sessionId":"...","entries":[{"speaker":"USER","mode":"capture","timestamp":"00:00:01","text":"Test utterance"}]}'
```

---

## Phase 3: Speech-to-Text (Deepgram)

### Tasks

- [ ] `lib/deepgram.ts` — WebSocket proxy helpers
- [ ] `app/api/stt/stream/route.ts` — WebSocket upgrade, proxy to Deepgram Nova-3
- [ ] `components/recording/AudioCapture.tsx` — getUserMedia, MediaRecorder, WS client
- [ ] `components/recording/TranscriptFeed.tsx` — live display
- [ ] Wire AudioCapture into `/record` active session view
- [ ] On STT `final` event → auto-call `/api/transcript/append`
- [ ] Elapsed timer for `timestamp` field (MM:SS)
- [ ] STT reconnect with exponential backoff (max 3)

### Done when

- User speaks on `/record` and sees transcript appear within ~2 seconds
- Transcript lines persist to Supabase with correct timestamps
- STT connection indicator shows connected/disconnected

### Manual test

1. Start session on `/record`
2. Speak: "This is a test of the recording system"
3. Confirm text appears in UI and in `transcript_lines` table
4. End session, view on `/session/[id]`

---

## Phase 4: Mode Toggle

### Tasks

- [ ] `components/recording/ModeToggle.tsx`
- [ ] On toggle → append `mode_change` entry via `/api/transcript/append`
- [ ] Update `sessions.mode` in DB
- [ ] `TranscriptFeed` renders mode change dividers (e.g., `--- Conversation ---`)
- [ ] Local React state tracks current mode

### Done when

- User can toggle Capture ↔ Conversation mid-session
- Transcript shows mode markers at correct timestamps
- Toggling does not stop STT

### Manual test

1. Record for 30 seconds in capture mode
2. Toggle to conversation, speak one sentence
3. Toggle back to capture, speak another sentence
4. End session — verify 2 mode_change rows + utterances in DB

---

## Phase 5: Conversation Agent (Text)

### Tasks

- [ ] `lib/agent/context-loader.ts`
- [ ] `lib/agent/prompts.ts` — system prompt template (Appendix A)
- [ ] `lib/agent/tools.ts` — web_search via Tavily
- [ ] `lib/openrouter.ts` — OpenRouter client + `MODELS` env config
- [ ] `POST /api/agent/message` — SSE streaming via OpenRouter (`OPENROUTER_MODEL_AGENT`)
- [ ] `components/recording/AgentResponse.tsx` — display streaming text
- [ ] On USER final utterance in conversation mode → call agent API
- [ ] Persist AGENT utterance to transcript on completion

### Done when

- In conversation mode, user asks "What did I just say?" and agent responds with accurate summary
- Agent response appears in transcript as AGENT speaker
- Response time to first token < 1.5 seconds (warm connection)

### Manual test

1. Start session, speak: "I want to redesign the membership page"
2. Toggle to conversation
3. Ask: "What did I say about membership?"
4. Agent should reference membership page redesign

---

## Phase 6: TTS & Interruption

### Tasks

- [ ] `lib/tts.ts` — OpenAI or Cartesia streaming
- [ ] `POST /api/agent/tts` — audio stream endpoint
- [ ] Client `AudioContext` player with `stop()` kill-switch
- [ ] After agent text completes → fetch TTS → play audio
- [ ] On Deepgram `speech_started` VAD event:
  - Abort agent message fetch (AbortController)
  - Stop TTS immediately
  - Save partial agent response with `[interrupted]` suffix
- [ ] Visual indicator when agent is speaking

### Done when

- Agent responses are spoken aloud
- User speaking during agent response cuts audio within 300ms
- Partial agent text saved to transcript on interrupt

### Manual test

1. Trigger agent response in conversation mode
2. While agent is speaking, start talking
3. Confirm audio stops immediately
4. Confirm partial response in transcript with `[interrupted]`

---

## Phase 7: Distillation Pipeline

### Tasks

- [ ] `lib/distillation/router.ts` — router model classifier (Appendix B prompt)
- [ ] `lib/distillation/extractor.ts` — distillation model per-file writer (Appendix C prompt)
- [ ] `lib/distillation/proposals.ts` — draft project + proposal creation
- [ ] `lib/distillation/inbox.ts` — inbox item creation
- [ ] `POST /api/distill` — full pipeline, sequential file writes
- [ ] Wire `/api/session/end` to trigger distill via internal fetch
- [ ] Create default context file slug `general` if none exists for project
- [ ] `app/context/[projectId]/page.tsx` — list context files
- [ ] `app/context/[projectId]/[slug]/page.tsx` — view/edit markdown

### Done when

- 10-minute capture session → end → within 2 minutes context files contain distilled decisions/tasks/facts
- Session status becomes `complete`
- Agent responses NOT in distilled content
- `[SUPERSEDED]` tags appear when content contradicts

### Manual test

1. Create project with empty `general` context file
2. Record session: "We decided to use Stripe for payments. Task: set up webhook endpoint. The old plan was PayPal but we're switching."
3. End session, wait for processing
4. Open context file — should contain decision (Stripe), task (webhook), superseded note (PayPal)

---

## Phase 8: Project Proposals

### Tasks

- [ ] `app/proposals/page.tsx` — list pending proposals
- [ ] `POST /api/project/confirm` — activate draft, commit content
- [ ] `POST /api/project/reject` — reject + re-route (Appendix D prompt)
- [ ] UI: Confirm / Reject buttons with suggested name display
- [ ] After confirm → project visible in workspace, context files populated

### Done when

- Session mentioning distinct new topic (3+ facts) creates pending proposal
- Confirm creates active project with content
- Reject re-routes to inbox or existing project

### Manual test

1. Record session scoped to "Dashboard" but talk about "Garage Gym" with 3+ facts (equipment, layout, budget)
2. End session
3. Visit `/proposals` — should see "Garage Gym" proposal
4. Confirm → verify new project under workspace

---

## Phase 9: Inbox

### Tasks

- [ ] `app/workspaces/[workspaceId]/inbox/page.tsx`
- [ ] Show one item at a time (oldest first, `dismissed_at IS NULL`)
- [ ] Route action: set `routed_to_project_id`, optionally append to context file
- [ ] Dismiss action: set `dismissed_at`
- [ ] Empty state: "Inbox is empty"

### Done when

- Low-confidence routed content appears in inbox
- User can route item to existing project or dismiss
- Routed/dismissed items no longer shown

### Manual test

1. Record session with off-topic sentence
2. End session
3. Check inbox — item should appear
4. Route to a project — item disappears from inbox

---

## Phase 10: Context Editor & Session Viewer Polish

### Tasks

- [ ] `PATCH /api/context/[projectId]/[slug]` — manual edit save
- [ ] Context file edit toggle (view ↔ edit textarea)
- [ ] Session page: status badge, processing spinner, retry distill button
- [ ] Session page: render full transcript with speaker labels and mode dividers
- [ ] `rowsToMarkdown()` rendering on session page
- [ ] Navigation: header links to Workspaces, Record, Proposals
- [ ] Toast notifications for errors

### Done when

- All PRD pages functional and linked
- User can edit and save context files manually
- Session viewer shows complete formatted transcript
- Stuck `processing` sessions can be retried

---

## Phase 11: Success Criteria Verification

Run through each PRD success criterion:

| Criterion | Test | Pass? |
|-----------|------|-------|
| 10-min session → context updated within 2 min | Record, end, time distillation | [ ] |
| Conversation responds within 1.5s | Measure first SSE token | [ ] |
| Interruption < 300ms | Speak during agent TTS, measure cut-off | [ ] |
| Proposals for 3+ fact clusters | Record new topic cluster, check proposals | [ ] |
| Raw transcripts preserved | Query `transcript_lines` after distillation | [ ] |

### Additional smoke tests

- [ ] Login/logout works
- [ ] RLS prevents cross-user data access (create second test user)
- [ ] No API keys in client bundle (check Network tab — no Deepgram/OpenRouter keys)
- [ ] `.env.local` not committed
- [ ] App deploys to Vercel with env vars configured

---

## Phase 12: Deploy (Optional but Recommended)

### Tasks

- [ ] Push to GitHub
- [ ] Import to Vercel
- [ ] Add all env vars from [setup-and-supabase.md](./setup-and-supabase.md) Section 8
- [ ] Set `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Generate and set `DISTILLATION_SECRET`
- [ ] Test production: sign up, record, distill

### Done when

- Production URL serves the app
- Recording and distillation work on deployed instance

---

## File Checklist (Quick Reference)

Minimum files to create (from implementation spec):

```
middleware.ts
app/layout.tsx
app/page.tsx
app/login/page.tsx
app/workspaces/page.tsx
app/workspaces/[workspaceId]/page.tsx
app/workspaces/[workspaceId]/inbox/page.tsx
app/record/page.tsx
app/context/[projectId]/page.tsx
app/context/[projectId]/[slug]/page.tsx
app/proposals/page.tsx
app/session/[id]/page.tsx
app/api/session/start/route.ts
app/api/session/end/route.ts
app/api/transcript/append/route.ts
app/api/stt/stream/route.ts
app/api/agent/message/route.ts
app/api/agent/tts/route.ts
app/api/distill/route.ts
app/api/project/confirm/route.ts
app/api/project/reject/route.ts
app/api/context/[projectId]/route.ts
app/api/context/[projectId]/[slug]/route.ts
components/recording/AudioCapture.tsx
components/recording/ModeToggle.tsx
components/recording/TranscriptFeed.tsx
components/recording/AgentResponse.tsx
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/middleware.ts
lib/deepgram.ts
lib/openrouter.ts
lib/tts.ts
lib/tavily.ts
lib/transcript.ts
lib/distillation/router.ts
lib/distillation/extractor.ts
lib/distillation/proposals.ts
lib/distillation/inbox.ts
lib/agent/prompts.ts
lib/agent/tools.ts
lib/agent/context-loader.ts
types/database.ts
types/transcript.ts
types/api.ts
```

---

## Handoff Notes for Kimi

1. **Read order:** PRD → Setup Guide (run SQL first) → Implementation Spec → this checklist
2. **Do not invent UX** — all open questions are resolved in PRD Section 9
3. **Do not skip sequential distillation** — one context file write at a time
4. **Keep Deepgram key server-side** — WebSocket proxy only
5. **Use exact prompt templates** from implementation spec appendices
6. **Ask before adding** Redis, queues, OAuth, multi-project sessions, or cross-workspace search
