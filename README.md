# crimedetected
# Meridian Link — AI-Powered Criminal Network Analysis System

An investigation-support platform that helps human investigators visualize
relationships between people, phones, vehicles, locations, and cases, and
surfaces AI-generated network indicators — never automated accusations.

**Core principle:** the system never labels a person "criminal" or declares
guilt. Every score is called a *Network Importance* / *Investigation
Priority* indicator, every alert explains what was detected and why, and
every report carries a human-verification disclaimer.

---

## What's included

| Piece | Where | Status |
|---|---|---|
| Interactive frontend prototype (live demo) | `NetworkAnalysisSystem.jsx` artifact | Fully working, runs client-side on synthetic data |
| Production backend architecture | `backend/` | Complete FastAPI app — auth, upload pipeline, graph analysis, reports |
| Database models | `backend/app/models/models.py` | SQLAlchemy models for PostgreSQL |
| Graph abstraction | `backend/app/services/graph_store.py` | NetworkX in-memory today, drop-in Neo4j when available |
| AI analysis engine | `backend/app/services/analysis.py` | Centrality, PageRank, label-propagation communities, explainable anomaly detection |

The frontend artifact and the backend implement the **same algorithms** on
the **same synthetic dataset**, so the interactive demo you can click
through today reflects exactly what the FastAPI service computes.

---

## Architecture

```
 React (Tailwind, d3-force graph, recharts)
        │  REST (JSON)
        ▼
 FastAPI ── auth (JWT, role-based) ── routers
        │        ├── /auth
        │        ├── /entities
        │        ├── /network        (analyze, communities, anomalies)
        │        ├── /data (upload pipeline)
        │        ├── /cases
        │        ├── /alerts
        │        ├── /reports
        │        └── /audit-logs
        │
        ├── PostgreSQL  — structured records, users, audit log, uploads
        └── graph_store  — abstraction; NetworkX in-memory today,
                            Neo4j when NEO4J_ENABLED=true

 AI/analysis: NetworkX (degree, betweenness, PageRank, label-propagation
 communities) + pandas/NumPy for the upload/validation pipeline.
 Architecture keeps analysis.py as the single pluggable surface for a
 future Graph Neural Network model.
```

### Application flow

```
DATA UPLOAD → VALIDATION → PROCESSING → ENTITY EXTRACTION →
RELATIONSHIP DETECTION → GRAPH CREATION → AI NETWORK ANALYSIS →
COMMUNITY DETECTION → ANOMALY DETECTION → PRIORITY SCORE →
INVESTIGATOR DASHBOARD → REPORT GENERATION
```

---

## Installation

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in JWT_SECRET_KEY, DB credentials
uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### Database setup (PostgreSQL)

```bash
createdb meridian_link
# Then, from a Python shell or an Alembic migration (not included in this
# prototype — add Alembic for schema migrations in production):
from app.models.models import Base
from sqlalchemy import create_engine
engine = create_engine(settings.DATABASE_URL)
Base.metadata.create_all(engine)
```

### Neo4j (optional, for production-scale relationship queries)

The prototype runs entirely on an in-memory NetworkX graph so it works with
zero external graph database. To switch to Neo4j:

1. Run a Neo4j instance (`docker run -p 7687:7687 -p 7474:7474 neo4j`)
2. Set `NEO4J_ENABLED=true` and the `NEO4J_*` variables in `.env`
3. No router code changes needed — `graph_store.py` swaps implementations transparently.

### Frontend (interactive artifact)

The `NetworkAnalysisSystem.jsx` file is a self-contained React app (Tailwind
+ d3-force + recharts + lucide-react) that runs the same analysis logic
client-side against the synthetic dataset — open it directly as an artifact,
no build step required for the demo. A production frontend would instead
call the FastAPI endpoints below via `fetch`/`axios`.

---

## Environment variables

See `.env.example`. Never commit a real `.env` file or real secrets.

---

## Demo credentials

```
Username: demo.investigator
Password: demo-pass-2026
Role:     Investigator
```

Demo mode (`DEMO_MODE=true`) uses this single in-memory account and the
synthetic dataset in `app/services/demo_data.py` / `data/sample_upload.csv`.
Production deployments must disable demo mode and back auth with the
`users` table.

---

## Demo dataset

`data/sample_upload.csv` — 15 fictional persons, 6 phones, 4 vehicles, 5
locations, 5 cases. Structured to demonstrate:

- Four distinct communities (label-propagation)
- Two bridge entities connecting communities (**Nisha**, **Geetha↔Joseph** via a shared phone)
- One flagged anomaly (**Nisha**, cross-community connectivity well above the network norm)

No real personal or case data is used anywhere in this repository.

---

## API documentation (summary)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Authenticate, returns JWT |
| GET | `/entities` | List/filter/search entities |
| GET | `/entities/{id}` | Entity detail |
| GET | `/entities/{id}/connections` | Direct relationships + explanations |
| GET | `/network/{id}` | Sub-network around an entity (`depth` param) |
| POST | `/network/analyze` | Full centrality/community/anomaly analysis |
| GET | `/network/communities` | Detected communities |
| GET | `/network/anomalies` | Explainable anomaly alerts |
| POST | `/data/upload` | Upload CSV/Excel/JSON, validate + process |
| GET | `/data/upload/{job_id}` | Upload/processing status + preview |
| GET | `/cases` | List cases with linked persons |
| GET | `/alerts` | List alerts |
| POST | `/alerts/review` | Mark an alert reviewed (audited) |
| POST | `/reports/generate` | Generate an investigation report |
| GET | `/audit-logs` | Audit trail (administrator/analyst only) |

Full interactive schema: `/docs` (Swagger) once the server is running.

---

## Security notes

- JWT auth with role-based dependencies (`investigator` / `analyst` / `administrator`)
- Passwords hashed with bcrypt, never stored or logged in plaintext
- All entity/network/report endpoints require authentication
- Audit log records report generation and alert reviews
- Demo and production data paths are explicitly separated by `DEMO_MODE`
- No real PII is used in the shipped demo dataset

---

## Future improvements

- Graph Neural Network scoring as an additional, opt-in analysis method (architecture already isolates this in `analysis.py`)
- Alembic migrations for the PostgreSQL schema
- Background job queue (Celery/RQ) for large-file uploads instead of `BackgroundTasks`
- Full Neo4j Cypher-based community/centrality queries for very large graphs
- WebSocket push for live alert updates on the dashboard
- PDF export via a headless-rendering service for `/reports/generate`
