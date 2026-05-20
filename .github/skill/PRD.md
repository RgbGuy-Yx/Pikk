# ShopBot — Product Requirements Document (PRD)

## Project Overview

ShopBot is a WhatsApp-native AI storefront for kirana stores in India.

Customers place grocery orders through WhatsApp using:

* text messages
* Hindi/Hinglish voice notes

The system automatically:

1. parses the order using AI
2. checks inventory
3. creates the order
4. generates invoice + UPI QR
5. sends confirmation back on WhatsApp

The project uses a polyglot microservices architecture:

* Node.js handles real-time operations and business logic
* Python handles AI processing and PDF generation
* React provides the owner dashboard
* Supabase provides PostgreSQL database infrastructure

---

# Core Product Goals

## Customer Side

* Order groceries using natural language
* Support Hindi/Hinglish orders
* Receive invoice and payment QR automatically
* No separate mobile app required

## Store Owner Side

* Manage inventory
* Track revenue and orders
* Receive new order notifications
* Handle operations through WhatsApp + dashboard

---

# Architecture

## Service 1 — Node.js + Express.js

Responsibilities:

* Receive WhatsApp webhooks
* Process customer messages
* Handle business logic
* Query Supabase
* Create orders
* Send WhatsApp responses
* Call Python service via axios
* Expose REST APIs for dashboard

### Tech Stack

* Node.js
* Express.js
* Axios
* dotenv
* Supabase JS Client
* Meta WhatsApp Cloud API

---

## Service 2 — Python + FastAPI

Responsibilities:

* Parse orders using Groq LLaMA 3
* Transcribe Hindi/Hinglish audio using Sarvam AI
* Generate PDF invoices using weasyprint
* Generate UPI QR using qrcode
* Upload files to Cloudinary

### Tech Stack

* Python 3.11+
* FastAPI
* Uvicorn
* Groq SDK
* Sarvam AI SDK
* weasyprint
* qrcode
* Cloudinary

---

## Frontend — React Dashboard

Responsibilities:

* Inventory management
* Revenue analytics
* Customer management
* Order history
* CSV stock upload

### Tech Stack

* React
* Vite
* TailwindCSS
* Axios
* Recharts
* React Router DOM

---

# Database — Supabase PostgreSQL

## products

* id
* name
* price
* stock_quantity
* reorder_level
* unit

## orders

* id
* customer_phone
* total_amount
* status
* created_at

## order_items

* id
* order_id
* product_id
* quantity
* unit_price

## customers

* id
* phone
* name
* created_at

---

# Folder Structure

```txt
shopbot/
├── node-service/
│   ├── server.js
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── middleware/
│   ├── utils/
│   ├── .env
│   └── package.json
│
├── python-service/
│   ├── main.py
│   ├── routes/
│   ├── services/
│   ├── templates/
│   ├── utils/
│   ├── .env
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── charts/
│   └── package.json
│
└── README.md
```

---

# Core User Flow

## Customer Order Flow

### Step 1 — Customer Sends WhatsApp Message

Customer sends:

* text order
  OR
* voice note

Example:

```txt
2kg atta and 1 litre oil
```

---

### Step 2 — Webhook Received

Node.js Express webhook receives Meta webhook payload.

Extract:

* sender number
* message type
* message content

---

### Step 3 — Voice Handling

If message is audio:

1. download media from Meta
2. send to Python `/transcribe`
3. receive transcript

---

### Step 4 — Order Parsing

Node.js sends message text to:

```http
POST /parse-order
```

Python uses Groq LLaMA 3 to return structured JSON.

Example:

```json
[
  {
    "item": "atta",
    "qty": 2,
    "unit": "kg"
  }
]
```

---

### Step 5 — Inventory Validation

Node.js:

* queries Supabase
* checks stock
* validates quantities
* creates order
* deducts stock

---

### Step 6 — Invoice Generation

Node.js calls:

```http
POST /generate-invoice
```

Python:

* generates PDF invoice
* generates UPI QR
* uploads assets to Cloudinary
* returns public URLs

---

### Step 7 — WhatsApp Confirmation

Node.js sends:

1. confirmation text
2. invoice PDF
3. UPI QR image

---

# Owner Operations

## WhatsApp Commands

### orders today

Returns:

* order count
* revenue
* pending deliveries

### order 42 ready

Marks order ready and notifies customer.

---

# Dashboard Features

## Inventory

* add products
* edit products
* delete products
* update stock
* reorder alerts
* CSV upload

## Analytics

* daily revenue
* weekly revenue
* top selling items
* customer purchase frequency

## Customers

* customer list
* order history
* balances

---

# Environment Variables

## Node.js (.env)

```env
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
VERIFY_TOKEN=
PYTHON_SERVICE_URL=
OWNER_PHONE=
OWNER_UPI_ID=
SUPABASE_URL=
SUPABASE_ANON_KEY=
PORT=3000
```

---

## Python (.env)

```env
GROQ_API_KEY=
SARVAM_API_KEY=
CLOUDINARY_URL=
PORT=8000
```

---

# Engineering Rules

## Mandatory Rules

### Architecture

* Maintain strict service boundaries
* Node.js handles business logic
* Python handles AI/PDF logic
* No tight coupling

### Environment Variables

* Never hardcode secrets
* Always use env variables

### Database

* Use Supabase JS client
* Avoid raw SQL unless necessary

### Node.js

* Use CommonJS only
* Use Express Router
* Keep routes thin
* Business logic belongs in services

### Python

* Use FastAPI APIRouter
* Use pydantic schemas
* Centralize exception handling

### Frontend

* Use reusable components
* Keep API calls inside service layer

---

# AI Agent Development Rules

## Copilot/Codex Constraints

### DO NOT:

* use MongoDB
* use Prisma
* use OpenAI
* use Puppeteer
* use TypeScript
* use Next.js
* use raw SQL unnecessarily
* place business logic inside routes
* hardcode credentials

### ALWAYS:

* use async/await
* add try/catch
* use environment variables
* separate services cleanly
* maintain modular structure
* return JSON APIs consistently

---

# Phases

## Phase 1 — Infrastructure Setup

* folder structure
* dependency installation
* Express server
* FastAPI server
* React boot
* ngrok setup
* Meta webhook verification

---

## Phase 2 — AI Core

* Groq integration
* parse-order endpoint
* JSON validation
* Node ↔ Python communication

---

## Phase 3 — Business Logic

* Supabase integration
* order creation
* stock deduction
* customer records
* WhatsApp replies

---

## Phase 4 — Voice Support

* Sarvam AI integration
* audio transcription
* Hindi/Hinglish support

---

## Phase 5 — Invoice System

* PDF invoice
* UPI QR generation
* Cloudinary upload

---

## Phase 6 — Dashboard

* inventory CRUD
* analytics
* customers
* charts
* login

---

## Phase 7 — Production Hardening

* Railway deploy
* Vercel deploy
* error handling
* retries
* rate limiting
* documentation
* demo video

---

# Success Criteria

The project is considered successful when:

* WhatsApp orders work end-to-end
* inventory updates automatically
* invoices generate successfully
* UPI QR works
* dashboard manages operations
* services deploy successfully
* architecture remains maintainable

---

# Final Objective

Build a portfolio-quality AI commerce platform demonstrating:

* microservices architecture
* AI integration
* real-time systems
* Supabase PostgreSQL
* WhatsApp automation
* production-grade backend engineering
