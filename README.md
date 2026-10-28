# 🎯 ClientHunter — Autonomous Freelance Client Discovery Agent

An intelligent, multi-agent lead generation and research engine designed for freelance web developers, designers, and digital agencies. **ClientHunter** autonomously identifies local businesses that lack an online presence or need a modern website redesign, verifies public evidence across the web, extracts operational hours and contact channels, and drafts personalized outreach emails.

---

## 🌟 Key Features

- **🎯 Precise Local Business Discovery**  
  Search for specific business categories across any locality and city (e.g., *"Find 5 cafés in Porur, Chennai that need a website"*).

- **🛡️ Evidence-Grounded Qualification**  
  Every lead is verified using deterministic rules rather than model hallucinations. The engine matches local identity, cross-checks Google Maps, scans directories, and confirms whether an official dedicated website exists.

- **🕒 7-Day Shop Timings & Business Hours**  
  Extracts and displays complete weekly operating schedules (Monday through Sunday) with clear daily status and live "Today" badges.

- **🌐 Free WHOIS Domain Intelligence & Live Screenshots**  
  For businesses with existing websites, ClientHunter displays domain age, ICANN registrar, registration dates, expiration timelines, and live website preview snapshots.

- **📱 Verified Contact & Social Channels**  
  Automatically collects and formats verified phone numbers (+91 normalization), official addresses, WhatsApp chat links, Instagram profiles, and Facebook business pages.

- **✉️ Automated Outreach Email Generation**  
  Generates personalized, non-generic cold outreach email drafts tailored to each specific business's situation and observed opportunities.

- **📊 One-Click Excel Export**  
  Export all qualified leads, verification statuses, evidence URLs, and drafted emails into a clean, formatted spreadsheet (`.xlsx`).

- **⚡ ChatGPT-Style Interactive Workspace**  
  Modern, responsive interface featuring live AI connection status, quick prompt copy & retry controls, paperclip attachments, and confirmation safeguards.

---

## 🏗️ Architecture & Workflow

ClientHunter uses **LangGraph** to coordinate specialized agents with a durable SQLite checkpoint engine:

```
[ User Request ]
       │
       ▼
┌──────────────┐
│   Planner    │ ── Extracts category, target locality, city, and website criteria
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Supervisor  │ ── Dispatches targeted Serper Maps lookups and web searches
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Verifier   │ ── Deterministically inspects pages, audits sites, checks hours
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Writer    │ ── Crafts personalized value-proposition email drafts
└──────┬───────┘
       │
       ▼
[ Qualified Lead Shortlist & Evidence Dossier ]
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 20+**
- **pnpm 9+** or **npm**
- **Google Gemini API Key** (free tier supported)
- *(Optional)* Serper API key for Google Maps search acceleration

---

### Installation & Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/Darshan101005/Freelance-Client-Discovery-Agent.git
cd Freelance-Client-Discovery-Agent
```

#### 2. Start the Python Backend
Create a virtual environment and install backend dependencies:

```bash
# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install requirements
pip install -r backend/requirements.txt

# Run the FastAPI server
python -m backend.run
```
*The backend server will run on `http://127.0.0.1:8000` with local SQLite storage.*

#### 3. Start the Frontend
In a new terminal window:

```bash
# Install frontend dependencies
npm install

# Start the local development server
npm run dev:local
```
*The web workspace will launch at `http://127.0.0.1:5173/`.*

#### 4. Configure API Keys
1. Open `http://127.0.0.1:5173/` in your browser.
2. Create your local account.
3. Open **Settings** (gear icon in the bottom-left profile menu).
4. Enter your **Gemini API Key** and save. The status indicator at the top will turn green (**AI Online**).

---

## 📁 Project Structure

```
├── app/                      # Next.js / React application frontend
│   ├── api/                  # Backend proxy routes (health, domain-info, screenshots)
│   ├── globals.css           # Global design system, glassmorphism, and responsive layout
│   └── page.tsx              # Main interactive chat workspace & lead drawer
├── backend/                  # Python FastAPI service & agent core
│   ├── agent.py              # LangGraph orchestration (planner, verifier, writer)
│   ├── evidence.py           # Deterministic business qualification & hours extractor
│   ├── providers.py          # Gemini AI client, Serper Maps & Selenium tooling
│   ├── run.py                # Server entrypoint with environment loader
│   └── server.py             # FastAPI REST endpoints, auth sessions, and SQLite worker
├── lib/                      # Shared client utilities, database schema, and types
├── public/                   # Static assets, branding, and icons
├── vite.local.config.ts      # Local development configuration with API proxying
└── README.md                 # Project documentation
```

---

## 🔒 Security & Privacy

- **Encrypted Credentials**: API keys are encrypted at rest using local Fernet keys and never leaked to frontend bundles.
- **Local Isolation**: All chat history, checkpoints, and qualified leads remain stored locally in your SQLite database.
- **Strict Guardrails**: Input validation prevents prompt injection and restricts outgoing queries to public HTTPS sources.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
