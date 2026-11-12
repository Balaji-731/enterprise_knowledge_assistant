# Enterprise AI Knowledge Platform

A secure, permission-aware Enterprise Retrieval-Augmented Generation (RAG) and Hybrid Search platform for **TechNova Solutions Pvt. Ltd.** It enforces **Role-Based (RBAC)** and **Attribute-Based (ABAC)** access controls *before* retrieval and context assembly so unauthorized documents are never retrieved, ranked, or leaked to the LLM.

---

## Key Capabilities

- **Zero-Leakage Hybrid Retrieval (`src/retrieval/`):**
  - Combines **dense vector search** (ChromaDB + `all-MiniLM-L6-v2`), **sparse keyword search** (`BM25Okapi` via `rank-bm25`), **Reciprocal Rank Fusion (RRF)**, and **Cross-Encoder reranking** (`cross-encoder/ms-marco-MiniLM-L-6-v2`).
  - Enforces pre-retrieval permission filters and post-retrieval re-validation (`is_chunk_authorized` in `src/retrieval/permissions.py`) across `allowed_roles`, `allowed_departments`, `allowed_users`, and document version status.
- **Grounded Local LLM Generation (`src/rag/`):**
  - Integrates with local **Ollama** (`llama3.2:latest` by default) for both standard (`/api/v1/query/ask`) and streaming (`/api/v1/query/stream`) Q&A with inline numbered citations (`[1]`, `[2]`), verbatim passage inspection, and zero-knowledge refusal when authorized context is insufficient.
- **Document Registry & Policy Modes (`src/ingestion/`):**
  - Parses PDF (`pymupdf`), DOCX (`python-docx`), and text/Markdown files, extracts cover-page metadata/version headers (`src/ingestion/parsers.py`), and archives superseded versions cleanly when new revisions are ingested.
  - Supports **Default Policy Mode** (category-driven RBAC/ABAC via `DEFAULT_CATEGORY_POLICIES`) and **Custom Policy Mode** (per-upload role, department, and explicit user overrides).
- **Employee Directory & Authentication (`src/auth/`, `src/api/routers/auth.py`):**
  - JWT bearer authentication (`pyjwt`) backed by SQLAlchemy (`storage/technova_enterprise.db` by default, or PostgreSQL via `DATABASE_URL`).
  - Admin-only employee provisioning and account activation/deactivation from the **Employee Directory** UI.
- **Security & Compliance Audit Trail (`src/api/routers/audit.py`):**
  - Records authentication attempts, RAG/search queries, document uploads, and user management actions in `AuditLog`, inspectable by administrators in **Security & Audit Logs** and **Access Control Matrix**.
- **Built-in Access Test Queries (`frontend/src/components/ChatInterface.jsx`):**
  - Knowledge Assistant displays tailored **Has Access** and **No Access (Restricted)** (or **Refusal Test (Out of Scope)** for administrators) sample questions for one-click verification of citations vs. zero-disclosure refusals.

---

## Default Category Access Policies

Configured in `src/ingestion/policy.py` (`DEFAULT_CATEGORY_POLICIES`):

| Category | Allowed Roles | Allowed Departments | Notes |
| :--- | :--- | :--- | :--- |
| `HR` | `employee`, `hr`, `manager`, `administrator` | `all` | Company-wide policies and handbooks |
| `ENGINEERING` | `employee`, `hr`, `manager`, `administrator` | `engineering` | Engineering standards & workflows |
| `FINANCE` | `manager`, `administrator` | `finance`, `executive` | Expense, procurement, approval matrix |
| `OPERATIONS` | `employee`, `hr`, `manager`, `administrator` | `operations` | Asset, incident, business continuity |
| `ADMINISTRATION` | `administrator` | `all` | Security, access control, disaster recovery |

> **Administrator Bypass:** Users with role `administrator` bypass RBAC/ABAC document filters (`is_admin` in `src/retrieval/permissions.py`).

### Corporate Knowledge Base (`docs/`)

Currently organized into 5 category folders containing **28** PDF documents (**379** active chunks in ChromaDB):

- `docs/HR/` — 10 documents (Leave, Attendance, WFH & Hybrid Work, Benefits, Code of Conduct & Ethics, Exit, Employee Handbook, Performance Management, Promotion & Career Development, Recruitment & Hiring)
- `docs/ENGINEERING/` — 6 documents (Code Review Guidelines, Coding Standards, Deployment Policy, Engineering Handbook, Git Workflow, Testing Standards)
- `docs/FINANCE/` — 4 documents (Expense Policy, Reimbursement Policy, Procurement Policy, Finance Approval Matrix)
- `docs/OPERATIONS/` — 4 documents (Asset Management, Business Continuity, Incident Response, Operations Handbook)
- `docs/ADMINISTRATION/` — 4 documents (Access Control Policy, Data Retention Policy, Disaster Recovery Policy, Information Security Policy)

---

## Tech Stack

- **Backend:** Python `>=3.10` (`uv`), FastAPI, Uvicorn, SQLAlchemy, PyJWT, PyMuPDF, `python-docx`
- **Embeddings & Retrieval:** ChromaDB (`./storage/chroma_db`, collection `technova_knowledge_base`), `sentence-transformers` (`all-MiniLM-L6-v2`, `cross-encoder/ms-marco-MiniLM-L-6-v2`), `rank-bm25`
- **LLM Runtime:** Ollama (`OLLAMA_BASE_URL`, default `http://127.0.0.1:11434`, default model `llama3.2:latest`)
- **Frontend:** React 19, Vite 8, Tailwind CSS v4, `lucide-react` (`frontend/`)

---

## Project Structure

```text
EnterPrise_AI/
├── main.py                      # FastAPI + built React SPA launcher (port 8000)
├── pyproject.toml               # Python project configuration & dependencies
├── docs/                        # Corporate policy PDFs organized by category
│   ├── ADMINISTRATION/
│   ├── ENGINEERING/
│   ├── FINANCE/
│   ├── HR/
│   └── OPERATIONS/
├── frontend/                    # React + Vite + Tailwind web application
│   ├── src/
│   │   ├── components/          # Dashboard, Chat, Search, Registry, Audit, Users, Matrix
│   │   ├── context/             # AuthContext, ToastContext
│   │   └── services/api.js      # REST + streaming API client
│   └── dist/                    # Production build served by FastAPI
├── src/
│   ├── api/
│   │   ├── app.py               # FastAPI app, router registration, static SPA serving
│   │   └── routers/             # auth.py, query.py, documents.py, audit.py
│   ├── auth/                    # JWT security, dependencies, auth Pydantic schemas
│   ├── database/                # SQLAlchemy models, session config, seed.py
│   ├── ingestion/               # Parsers, cleaner, chunker, policy, indexer, pipeline
│   ├── rag/                     # Ollama client, grounded prompts, RAG engine
│   └── retrieval/               # Permissions filter, hybrid search, RRF, reranker
├── storage/
│   ├── technova_enterprise.db   # SQLite database (auto-created on startup)
│   ├── chroma_db/               # Persistent ChromaDB vector store
│   └── uploads/                 # Stored uploaded source documents
└── tests/                       # Unit and integration test suites
```

---

## Setup & Running Locally

### 1. Prerequisites

- **Python 3.10+** and [`uv`](https://docs.astral.sh/uv/)
- **Node.js & npm** (for frontend builds or dev mode)
- **Ollama** running locally with `llama3.2:latest` installed:
  ```bash
  ollama pull llama3.2:latest
  ```

### 2. Install Dependencies & Build Frontend

```bash
# Install Python dependencies
uv sync

# Install & build React production bundle (served automatically by FastAPI)
npm --prefix frontend install
npm --prefix frontend run build
```

### 3. Start the Application

```bash
uv run python main.py
```

- **Web App UI:** `http://127.0.0.1:8000`
- **API Base:** `http://127.0.0.1:8000/api/v1`
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`

#### Optional: Frontend Hot-Reload Dev Server

Run the backend (`uv run python main.py`) in one terminal and Vite in another:

```bash
npm --prefix frontend run dev
```

### 4. Bootstrap Login & Provisioning Employees

On first startup, `init_db()` (`src/database/seed.py`) initializes the tables and seeds one bootstrap administrator account:

- **Username:** `admin`
- **Password:** `admin123`

Sign in as `admin`, open **Employee Directory** in the sidebar, and provision real employee accounts with their target **Role** (`employee`, `hr`, `manager`, `administrator`) and **Department** (`engineering`, `hr`, `finance`, `operations`, `executive`, etc.).

---

## Environment Variables (Optional)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./storage/technova_enterprise.db` | SQLAlchemy connection string (supports PostgreSQL) |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local or remote Ollama server URL |

---

## REST API Overview (`/api/v1`)

| Prefix | Endpoints | Access |
| :--- | :--- | :--- |
| `/auth` | `POST /login`, `GET /me` | Public (`login`) / Authenticated (`me`) |
| `/auth` | `GET /users`, `POST /users`, `PATCH /users/{user_id}/status` | `administrator` only |
| `/documents` | `GET /` (authorized catalog), `POST /upload` | Authenticated (`GET`) / `hr` or `administrator` (`POST`) |
| `/query` | `POST /ask`, `POST /stream`, `POST /search` | Authenticated (RBAC/ABAC filtered) |
| `/audit` | `GET /logs` | `administrator` only |
