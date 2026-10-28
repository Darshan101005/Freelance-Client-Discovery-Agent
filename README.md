# Client Hunter

A multi-agent lead research application with a bright React chat workspace, Gemini, LangGraph, local business evidence, strict website qualification, and automatic personalized email drafts. Email sending and inbox automation are intentionally outside this release.

## Run the Python project locally

Requires Python 3.11+, Node 22.13+, and pnpm 11. Chrome is optional; without it the agent uses API search fallbacks.

```bash
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
python -m backend.run
```

You can press Enter at both key prompts and configure keys after signing up in the app. In a second terminal:

```bash
pnpm install
pnpm dev:local
```

Open **http://127.0.0.1:5173/index.local.html**. Create a local account, open Settings, and configure Gemini and optional Serper keys. The backend listens on 127.0.0.1:8000. Keep it running for background research; closing or switching the browser does not stop the Python worker.

Data lives in `backend/data/`: account and campaign SQLite databases, LangGraph checkpoints, and an encryption master key. Back up this entire directory. Do not publish it. The first account created after upgrading the old single-user version owns its previous chats. Subsequent accounts have isolated chat histories and key settings.

- `SELENIUM_ENABLED=0` skips Chrome.
- `SELENIUM_HEADLESS=0` shows browser windows when Chrome is available.
- `GEMINI_MODEL` optionally selects a compatible model; otherwise the application discovers supported Flash models.
- `CLIENT_HUNTER_DATA` changes the local data directory.
- Existing `GEMINI_API_KEY` / `SERPER_API_KEY` environment variables can act as server defaults. Per-account settings override them.

## What changed in v2

- Persistent chat history, with conversation, leads, and email drafts scoped to each chat.
- Independent research execution: switching chats/tabs cannot discard state. The hosted UI schedules all active chats while open and resumes unfinished work after reopening; the Python server worker also continues while the browser is closed.
- Explicit website criteria: no website found, existing website needing improvements, or any local business.
- Locality AND city matching. A same-name website in another country cannot establish ownership.
- Structured Serper Maps address, phone, website, rating, and rating-count extraction.
- Two successful name-and-location website searches for every no-site finding. Unresolved possible websites and incomplete identity evidence are rejected.
- Existing-site redesign leads require a matched official website, successful page inspection, and observed improvement signals. Missing viewport/title or legacy markup are signals, not a complete visual judgment.
- +91 phone normalization and fact-specific source links. Missing contacts, ratings, social accounts and audit fields are hidden.
- Dynamic cards and evidence drawers, observed social/WhatsApp links, and an Excel workbook with qualified leads, drafts and fact provenance.
- An email draft is prepared automatically as each lead qualifies. A personalized evidence-based template remains available if Gemini cannot enhance it. Drafts are editable and copyable.
- Action summaries and tool outcomes appear inside the conversation; the hosted endpoint streams NDJSON events as actions occur. The local worker persists incremental events and the UI updates every 1.8 seconds.
- Human clarification interrupts, pause/resume, bounded search passes, rejected-candidate explanations, and error recovery.
- Encrypted per-account API key settings. Keys never appear in GET responses or frontend bundles.
- Local signup/login with salted PBKDF2 password hashes, hashed session tokens, HttpOnly SameSite cookies, login rate limits, origin checks, and account-scoped queries.
- Previous results are preserved separately and require rechecking under the stronger rules.

## Agent concepts for a college presentation

The graph routes between a planner, supervisor, verifier, writer, and (Python) a native human interrupt node. Each specialist has a separate role prompt and structured output contract. The supervisor chooses among search, Maps lookup, page inspection, candidate verification, clarification, and completion. The verification specialist performs dedicated searches, chooses evidence pages, extracts facts, and passes them through deterministic qualification gates. The writer uses accepted evidence only.

The loop is observe → choose an action → use a tool → verify evidence → checkpoint. Specialists share campaign state and can adapt their next action to tool failures and the evidence already found. These are multiple agent roles using Gemini, not separately trained models or necessarily simultaneous agents. Deterministic gates complement model judgment; “agentic” does not mean allowing unsupported facts through.

Concepts demonstrated: multi-agent orchestration, conditional graph routing, tool selection, structured outputs, shared state, evidence grounding, provenance, entity/location resolution, duplicate prevention, bounded autonomy, persistent checkpoints, native `interrupt()` / `Command(resume=...)`, human oversight, provider fallback, repeated-action guards, incremental progress events, error recovery, and heuristic scoring.

Scores measure source coverage, contact availability and website opportunity, not sales conversion probability. A 90 does not mean a 90% chance of buying.

## Runtime differences

| Feature | Local Python | Hosted workspace |
|---|---|---|
| Backend | FastAPI + Python LangGraph | Worker + JavaScript LangGraph |
| Storage | SQLite + native LangGraph checkpoints | D1 with revision checks and step leases |
| Accounts | Local email/password signup/login | Native ChatGPT account identity |
| Browser | Selenium when Chrome is installed | Chrome/Python cannot run here |
| Search | Google Selenium → DDG Selenium → DDG HTML → Serper | DDG HTML → Serper |
| Structured business data | Serper Maps | Serper Maps |
| Background work | Continues with backend running | Continues across views while app open; resumes on reopening |
| Human gates | Native interrupt/resume | Persisted question/pause states |
| Progress | Persisted tool events, polled UI | Streaming NDJSON tool events |
| Secret storage | Fernet, local master key | AES-GCM with server encryption key |

The public search provider can block automation or exhaust quotas. No CAPTCHA bypass, stealth plugin or proxy rotation is implemented. The application is not guaranteed free or unlimited. Serper Maps is a third-party Google-results service, not a direct Google Places API integration. Full review text and authenticated social scraping are not implemented.

## Truth and readiness limits

“No official site found” is a documented finding within the searches performed. It cannot guarantee that no website exists anywhere. Source facts can change or be wrong; even matching logic needs human review. A failed page fetch never proves absence. HTML checks do not certify modern visual design, performance, accessibility, or business quality. A business without a public email can still have a draft.

This is a working college-project foundation with tested evidence and account boundaries, not an independently audited production SaaS. The local server must remain bound to loopback. Internet production hosting of the Python app would additionally require HTTPS, deployment/session hardening, recovery/email verification, operational monitoring, backups, and queue management. Hosted access remains private through ChatGPT. Never expose API keys in client code.

## Checks

```bash
python -m pytest backend/tests -q
node tests/evidence.mjs
node tests/export.mjs
pnpm exec tsc --noEmit
pnpm build:local
```

Shared evidence fixtures exercise both runtimes: wrong city/neighbourhood, the same-name USA website, unresolved website, insufficient searches, blocked pages, absent improvement signals, +91 normalization, structured ratings, and fabricated contacts. Python tests also cover native checkpoint recovery, automatic drafting, quota recovery, local account isolation, login, encrypted key storage and CSRF rejection.

## Source map

- `app/page.tsx`, `app/globals.css`: shared React UI.
- `backend/agent.py`, `backend/evidence.py`, `backend/providers.py`: Python agent, evidence gates and tools.
- `backend/server.py`: local accounts, encrypted settings, storage and worker.
- `lib/client-hunter/`: hosted agent, qualification, providers, encrypted settings.
- `app/api/`: hosted API and streamed actions.
- `db/`, `drizzle/`: D1 schema and versioned migrations.
- `tests/`, `backend/tests/`: qualification and persistence tests.
- `scripts/package-source.py`: creates the source ZIP, excluding keys, accounts and runtime data.
