# Pikk
AI-powered WhatsApp storefront for kirana (grocery) stores in India. Customers order via WhatsApp text or Hindi voice notes. The system parses orders with AI, checks inventory, and sends confirmations back on WhatsApp. Store owners get a React dashboard to manage everything.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express.js |
| AI Service | Python, FastAPI, Groq (LLaMA 3.3), Sarvam AI |
| Frontend | React, Vite, Recharts |
| Database | Supabase (PostgreSQL) |
| WhatsApp | Meta WhatsApp Cloud API |

## Architecture

```
Customer (WhatsApp)
       |
       v
[Node.js Service] -----> [Python Service] (Groq, Sarvam)
       |                           |
       v                           v
[Supabase DB]              [React Dashboard] (Owner UI)
```

- **Node.js** handles webhooks, order orchestration, inventory, and REST APIs for the dashboard.
- **Python** handles AI (order parsing, voice transcription).
- **React** is the owner dashboard for managing products, orders, and viewing analytics.
- **Supabase** stores products, customers, orders, and order items.

## Workflow

1. Customer sends a WhatsApp message (e.g. "2kg atta and 1 litre oil")
2. Node service receives the webhook, deduplicates, and routes the message
3. If audio, Python transcribes Hindi/Hinglish via Sarvam AI
4. Python uses Groq LLaMA 3 to parse the message into structured items
5. Node checks inventory, creates the order, deducts stock
6. Customer receives order confirmation on WhatsApp
7. Owner sees everything on the dashboard -- orders, inventory, revenue, low-stock alerts

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.13+
- Supabase account (free tier works)
- Meta WhatsApp Cloud API access
- Groq API key (free at console.groq.com)
- Sarvam AI API key

### Install

```bash
# Clone
git clone <repo-url> shopbot && cd shopbot

# Node service
cd node-service && npm install

# Python service
cd ../python-service
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

# Frontend
cd ../frontend/shopbot && npm install
```

### Environment Variables

Copy `.env.example` to `.env` in each service folder and fill in your keys.

### Run

Start each in a separate terminal:

```bash
# Terminal 1
cd node-service && npm run dev

# Terminal 2
cd python-service && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3
cd frontend/shopbot && npm run dev
```

Dashboard: `http://localhost:5173`

### Database Setup

Paste `node-service/schema.sql` into your Supabase SQL Editor and run it, or:

```bash
cd node-service && node setup-db.js

```

## Demo

<video src="WhatsApp%20Video%202026-06-26%20at%2010.56.18%20PM.mp4" controls width="600"></video>


