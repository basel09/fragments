# Code Selection to Chat Context — Feature Documentation

## The Problem

When working with generated code, users often want to ask about or modify a specific function, block, or section. Without this feature, they'd have to manually copy code, paste it into the chat, and explain which file and lines it came from. This is friction that slows down the workflow.

## The Solution

Select code in the editor → click "Use Selection" (or right-click → "Use as Context") → the snippet appears as an orange badge in the chat input → send your message. The selected code is automatically injected into the message with file name, line numbers, and language metadata.

## What I Built

### 1. New Content Type: `MessageCodeSelection`

**File:** `lib/messages.ts`

I followed the existing pattern — `MessageText`, `MessageCode`, and `MessageImage` already existed as content types in the message system. I added `MessageCodeSelection` with structured metadata:

```ts
type MessageCodeSelection = {
  type: 'codeSelection'
  code: string
  fileName: string
  language: string
  lineRange: { start: number; end: number }
  tokenEstimate: number
}
```

**Why structured metadata instead of plain text?** Three reasons:
- The UI can render a compact badge (file name + line range) instead of dumping raw code into the chat history
- `toAISDKMessages()` can format it optimally with code fences and context
- Enables smart behaviors like duplicate detection and selection expiry (see Token Optimization below)

### 2. Selection Detection via `window.getSelection()`

**File:** `components/code-view.tsx`

The code panel uses PrismJS for syntax highlighting, which wraps tokens in `<span>` elements. I considered two approaches:

| Approach | Pros | Cons |
|----------|------|------|
| `window.getSelection()` on `mouseup` | Works across PrismJS spans, no DOM manipulation needed | Can't detect programmatic selections |
| Custom selection overlay with mouse tracking | Full control over selection UI | Complex, fragile, reinvents the browser |

I chose `window.getSelection()` because it naturally works across PrismJS-highlighted spans without fighting the DOM. The browser handles the hard part (cross-element text selection), and I just read the result.

Line range calculation finds the selected text in the source code and counts newlines before it to determine start/end lines.

### 3. Two Ways to Attach: Button + Context Menu

**Files:** `components/fragment-code.tsx`, `components/code-context-menu.tsx`

- **"Use Selection" button** — appears in the toolbar (orange, hard to miss) when text is selected and chat isn't loading
- **Right-click context menu** — custom context menu with "Copy" and "Use as Context" options

**Why both?** Different users have different habits. Power users prefer right-click workflows. Casual users scan the toolbar. Having both costs very little and covers both interaction patterns.

### 4. Selection Badge in Chat Input

**File:** `components/chat-input.tsx`

When a selection is attached, an orange badge appears above the text input showing:
- File name
- Line range (e.g., lines 12-25)
- Line count
- Estimated token cost
- Expandable preview (click to expand/collapse the actual code)
- X button to clear

**Why show token estimates?** Users need to understand the cost of attaching large selections. Displaying `~200 tokens` gives them a sense of how much context they're using. The estimate uses a simple `chars / 4` heuristic — not perfect, but good enough for user awareness.

### 5. Selection Rendering in Chat History

**File:** `components/chat.tsx`

In the message history, code selections render as compact orange badges (file name + line range + token count) instead of showing the full code. This keeps the chat readable — the full code is already in the conversation context; the user doesn't need to see it repeated visually.

### 6. State Management in `app/page.tsx`

**File:** `app/page.tsx`

All selection state lives in the main page component alongside existing chat state. The flow:

```
CodeView (detects selection)
  → FragmentCode (holds local selection state, shows "Use Selection" button)
    → Preview (passes onAttachSelection callback up)
      → page.tsx (stores codeSelection in state, passes to ChatInput)
        → handleSubmitAuth() injects into message content array
          → toAISDKMessages() formats for the LLM
```

**Why not Context/Redux?** The existing codebase uses props-down-callbacks-up for all chat state. Adding a state management library for one feature would be inconsistent and over-engineered. React `useState` is sufficient here — the selection is only needed by `ChatInput` and `handleSubmitAuth`.

## Token Optimization Strategies

Large code selections can waste tokens and money. I implemented four strategies:

### Strategy 1: Smart Truncation (Token-Based Cap)

**File:** `app/page.tsx` — `truncateSelection()`

Selections are capped at ~800 tokens (configurable via `MAX_SELECTION_TOKENS`). If a selection exceeds this, it's truncated line-by-line (never mid-line) with a `// ... truncated (N lines omitted)` comment.

**Why 800 tokens?** It's roughly 50-60 lines of code — enough to capture a full function but not enough to blow up the context window. The truncation is line-aware to avoid cutting mid-statement.

### Strategy 2: Selection Expiry

**File:** `lib/messages.ts` — inside `toAISDKMessages()`

Selections older than 3 turns (6 messages) are collapsed to a one-line summary: `[Previously selected TypeScript code from app.tsx, lines 12-25]`. The model still knows what was referenced but doesn't waste tokens on stale code.

**Why 3 turns?** After 3 back-and-forth exchanges, the conversation has likely moved on. If the user needs the same code again, they can re-select it.

### Strategy 3: Content Sorting (Cache Optimization)

**File:** `lib/messages.ts` — inside `toAISDKMessages()`

Message content is sorted so text comes first and code selections come last. This improves cache hit rates for providers that use prefix caching — the text prompt (more likely to be cached) stays at the front.

### Strategy 4: Duplicate Detection

**File:** `app/page.tsx` — inside `handleSubmitAuth()`

If the user attaches the exact same selection (same code, same file) that was already sent in a previous message, it's replaced with `[Same code as previously referenced]`. No point sending the same 50 lines twice.

## Edge Cases Handled

| Edge Case | How It's Handled |
|-----------|-----------------|
| Empty selection | Ignored — `trim() + length` check |
| Very large selection (>800 tokens) | Truncated with line-aware cutting |
| Stale selection (code changes) | Auto-cleared via `useEffect` on `fragment.code` |
| Clear chat | Also clears selection |
| Selection during loading | Disabled — "Use Selection" button hidden while chat is loading |
| Multiple selections | Only latest selection kept (single-selection model) |
| Tab switch in code panel | Selection cleared on file tab switch |

## MongoDB Conversation Persistence

### What I Added

**Files:** `lib/mongodb.ts`, `app/api/conversations/route.ts`

A REST API for saving and retrieving conversation messages, backed by MongoDB.

### Why MongoDB?

| Database | Pros | Cons |
|----------|------|------|
| MongoDB | Schema-flexible (messages have varying content types), natural fit for document-shaped data, easy to scale horizontally | No relations, eventual consistency |
| PostgreSQL | Strong consistency, relations | Schema changes needed for each content type, JSON columns lose type safety |
| localStorage | Zero infrastructure | Not persistent across devices, not queryable, size limits |

Messages are document-shaped (varying content types — text, images, code selections, fragments) which maps naturally to MongoDB's document model. No schema migrations needed when adding new content types.

### Architecture Decisions

- **Connection caching on `globalThis`** — Serverless environments (like Vercel) spin up new instances frequently. Without caching, every request would open a new MongoDB connection. The `globalThis` pattern ensures one connection per process.
- **Graceful degradation** — If `MONGODB_URI` is not set, the API returns `{ skipped: true }` instead of erroring. The app works fine without MongoDB; persistence is optional.
- **Non-blocking saves** — `saveToMongoDB()` in `page.tsx` uses fire-and-forget `fetch().catch()`. The user never waits for MongoDB — if the save fails, it logs and moves on.

### API Endpoints

```
POST /api/conversations — Save a message
GET  /api/conversations?id=<conversationId> — Get messages by conversation
GET  /api/conversations?userId=<userId> — Get messages by user
```

## Files Changed

| File | What Changed |
|------|-------------|
| `lib/messages.ts` | Added `MessageCodeSelection` type, `CodeSelectionData` type, updated `toAISDKMessages()` with expiry + sorting |
| `components/code-view.tsx` | Added `onSelectionChange` callback via `mouseup` + `window.getSelection()`, `onContextMenu` for right-click |
| `components/fragment-code.tsx` | Local selection state, "Use Selection" button, context menu integration |
| `components/code-context-menu.tsx` | **New file** — Custom right-click context menu with Copy and Use as Context |
| `components/preview.tsx` | Passes `onAttachSelection` callback through to `FragmentCode` |
| `components/chat-input.tsx` | Orange selection badge with expand/collapse preview, token budget display |
| `components/chat.tsx` | Renders `codeSelection` content as compact orange badge in message history |
| `app/page.tsx` | `codeSelection` state, `truncateSelection()`, `handleAttachSelection()`, injection in `handleSubmitAuth()`, stale selection cleanup, MongoDB save calls |
| `lib/mongodb.ts` | **New file** — MongoDB connection with `globalThis` caching |
| `app/api/conversations/route.ts` | **New file** — REST API for conversation persistence |

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, TailwindCSS, shadcn/ui, Radix primitives
- **Syntax Highlighting:** PrismJS
- **Database:** MongoDB (optional, for conversation persistence)
- **State:** React `useState` + `useLocalStorage` (no external state management)

## Setup

```bash
npm install
npm run dev
```

Required in `.env.local`:
```sh
E2B_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Optional — conversation persistence
MONGODB_URI=mongodb://localhost:27017
```

## Build

```bash
npm run build
```
