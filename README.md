<h1 align="center">ClientHunter</h1>

<p align="center">A feature-rich multi-agent discovery and research engine that identifies local businesses without modern websites, verifies live web evidence, and generates personalized outreach drafts.</p>

<p align="center">
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white" alt="Python" /></a>&nbsp;
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI" /></a>&nbsp;
  <a href="https://langchain-ai.github.io/langgraph/"><img src="https://img.shields.io/badge/LangGraph-Multi--Agent-FF6F00?style=flat" alt="LangGraph" /></a>&nbsp;
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black" alt="React" /></a>&nbsp;
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-WAL_Storage-003B57?style=flat&logo=sqlite&logoColor=white" alt="SQLite" /></a>
</p>

---

## Features

### Core Discovery & Verification

- **Category & Locality Targeting** — Search any business niche across specific neighborhoods and cities
- **Deterministic Website Checks** — Validates true absence of an official website across multiple search sources
- **Fit Scoring & Audit Signals** — Ranks business opportunities using verifiable contact availability and web status
- **Candidate Rejection Tracking** — Logs and documents reasons why specific candidates were excluded

### Business Intelligence & Hours

- **7-Day Operating Schedules** — Displays complete weekly opening hours with live highlight badges for today
- **WHOIS Domain Intelligence** — Inspects domain age, ICANN registrar, registration dates, and expiry status
- **Live Website Snapshots** — Captures and previews visual snapshots of existing websites for redesign leads
- **Verified Contacts & Social Profiles** — Collects verified phone numbers (+91 normalized), Google Maps, WhatsApp, Instagram, and Facebook handles

### Outreach & Workflow

- **Automated Email Drafting** — Prepares tailored cold outreach emails citing verified evidence and opportunities
- **Interactive Chat Controls** — Direct prompt copy and one-click step retry buttons integrated into the conversation
- **Excel Spreadsheet Export** — Downloads clean `.xlsx` workbooks containing qualified leads, facts, and email drafts
- **Durable State Management** — Background SQLite checkpoints ensure research progress is never lost on refresh

---

## How It Works

```text
User Prompt ↔ ClientHunter UI ↔ LangGraph Agent ↔ Search / Maps Providers
                                       │
                                       ▼
                             campaigns.sqlite
                        (State & Checkpoint Storage)
```

1. **User submits prompt** — Enters a targeted request such as *"Find 3 paint shops in Porur, Chennai that need a website"*
2. **Planner node** — Extracts category, city, locality terms, and website criteria into a structured research plan
3. **Supervisor loop** — Dispatches targeted queries to Google Maps, Serper, and web inspection tools
4. **Evidence Verifier** — Applies strict identity gates, parses operating hours, contacts, and audit signals
5. **Outreach Writer** — Automatically generates tailored outreach email drafts using verified business evidence
6. **Persistence & Export** — Commits all qualified leads to SQLite and enables immediate one-click Excel export

---

## Tech Stack

| Component | Technology | Description |
|---|---|---|
| Frontend Framework | Next.js / React 19 / Vite | Fast, responsive workspace with live streaming updates |
| Styling & Design | Vanilla CSS / CSS Variables | Sleek glassmorphism UI with custom theme tokens |
| Backend API | FastAPI (Python 3.11+) | Async REST service with session management and encryption |
| Agent Orchestration | LangGraph & LangChain | Multi-agent state graph with supervisor and verifier nodes |
| Search & Maps | Serper Maps & DuckDuckGo | Public business discovery, rating counts, and address lookup |
| Browser Automation | Selenium WebDriver | Automated headless website inspection and snapshot capture |
| Data Storage | SQLite (WAL Mode) | Durable local database for accounts, chats, and checkpoints |
| Domain Intelligence | RDAP & WHOIS Protocol | Captcha-free domain registration and registrar verification |
| Spreadsheet Export | SheetJS (XLSX) | Client-side Excel workbook generation with multi-tab data |

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **Google Gemini API Key** (free tier supported)
- *(Optional)* Serper API Key for Google Maps acceleration

---

### Setup Instructions

#### 1. Clone the Repository

```bash
git clone https://github.com/Darshan101005/Freelance-Client-Discovery-Agent.git
cd Freelance-Client-Discovery-Agent
```

#### 2. Start the Backend Server

```bash
# Set up virtual environment
python -m venv .venv

# Activate environment (Windows)
.venv\Scripts\activate
# Activate environment (macOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Launch FastAPI service
python -m backend.run
```

*The backend service runs on `http://127.0.0.1:8000`.*

#### 3. Start the Frontend Application

In a separate terminal:

```bash
# Install frontend packages
npm install

# Start local development server
npm run dev:local
```

*The client workspace opens at `http://127.0.0.1:5173/`.*

#### 4. Configure API Keys

1. Navigate to `http://127.0.0.1:5173/`
2. Create your local account
3. Click the **Settings** gear icon in the bottom-left profile section
4. Paste your **Gemini API Key** and save — the top indicator will show **AI Online**

---

## Project Structure

```
├── app/
│   ├── api/                  # API proxy routes (health, domain-info, screenshot)
│   ├── globals.css           # Design system, variables, and responsive layout
│   └── page.tsx              # Main chat interface, lead drawer, and state
├── backend/
│   ├── agent.py              # LangGraph multi-agent orchestration
│   ├── evidence.py           # Business qualification rules and hours extractor
│   ├── providers.py          # Gemini AI client, search, and Selenium tooling
│   ├── run.py                # Server entry point
│   └── server.py             # FastAPI endpoints, auth sessions, and SQLite worker
├── db/                       # Database schema and migration configurations
├── lib/                      # Client utilities, state types, and store helpers
├── public/                   # Static branding assets and icons
├── vite.local.config.ts      # Local Vite server configuration
└── README.md                 # Project documentation
```
