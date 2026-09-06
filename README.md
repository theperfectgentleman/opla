# Opla

**Stage:** updating — targets FMCGs and other businesses.

B2B field-force platform (Opine v2 rebuild): design forms in Studio, publish JSON blueprints, collect on Expo mobile and public web. Built for market activation, sales tracking, and similar field programmes.

Agent landing: [AGENT.md](./AGENT.md). History: [CHANGELOG.md](./CHANGELOG.md). Docs index: [docs/README.md](docs/README.md). Vocabulary: [docs/PRODUCT_VOCABULARY.md](docs/PRODUCT_VOCABULARY.md).

## Surfaces

| Surface | Path | Stack |
|---|---|---|
| Studio | `opla-frontend/apps/studio` | Vite, React 19, React Router |
| Mobile player | `opla-frontend/apps/mobile` | Expo 54, React Native |
| Intelligence Layer | `opla-backend` | FastAPI, PostgreSQL, Alembic, Redis, Poetry |
| Shared types / logic | `opla-frontend/packages/{types,logic,ui,config}` | TurboRepo |

Ignore leftover root `apps/studio` — it is not the active Studio.

## Local run

Prerequisites: Python 3.10+, Node 18+, PostgreSQL. Redis optional (OTP). Poetry for the backend.

```bash
# API — http://localhost:8000  (docs: /api/docs)
cd opla-backend
python -m poetry install
python -m poetry run alembic upgrade head
python -m poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Studio — http://localhost:5173
cd opla-frontend
npm install
cd apps/studio && npm run dev

# Mobile
cd opla-frontend/apps/mobile
npx expo start
```

Or use `./deploy.sh` / `manage.ps1`. More detail: [QUICK_START.md](QUICK_START.md).

API base for Studio: `VITE_API_URL` (default `http://localhost:8000/api/v1`). Backend reads a repo-root `.env` (`DATABASE_URL`, JWT secrets, optional `REDIS_URL`, `GROQ_API_KEY`).

## Hosts

No public hosts are wired in this repo. Planned names in older docs (`studio.opla.app`, `api.opla.app`) are not live. Do not treat them as deployed.
