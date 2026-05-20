# ShopBot

Polyglot microservices starter for the ShopBot platform.

## Services

- `node-service`: Express API for webhooks, orders, inventory, analytics, and service orchestration.
- `python-service`: FastAPI service for parsing, transcription, and invoice generation.
- `frontend`: Vite + React dashboard.
- `n8n`: Workflow drop-in folder for future automation assets.

## Quick Start

1. Create environment files from the `.env.example` templates in each service folder.
2. Install dependencies in each service.
3. Start the Node API, Python API, and frontend in separate terminals.

## Run

- Node: `cd node-service && npm run dev`
- Python: `cd python-service && uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- Frontend: `cd frontend && npm run dev`
