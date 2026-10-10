# {{APP_NAME}}

A database-first rental infrastructure for high-value physical assets between untrusted parties. PostgreSQL is the authoritative source of truth for condition, custody, double-booking prevention, double-entry financial ledger records, and audit history.

## Prerequisites

- **Node.js**: v20+ LTS
- **npm**: v10+
- **Docker** and **Docker Compose**
- **Git**

## Quick Start (5 steps)

```bash
# 1. Copy environment configuration
cp .env.example .env

# 2. Install workspace dependencies
npm install

# 3. Start PostgreSQL container in background
npm run db:up

# 4. Initialize, migrate, and seed the database
npm run db:reset

# 5. Start development servers
npm run dev:api    # Terminal 1: NestJS API on http://localhost:4000
npm run dev:web    # Terminal 2: Next.js Web on http://localhost:3000
```

## Repository Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run db:up` | `docker compose up -d db` | Starts the PostgreSQL 16 container and checks health |
| `npm run db:migrate` | `tsx db/migrate.ts` | Applies pending SQL migrations in numerical order |
| `npm run db:seed` | `tsx db/seed/seed.ts` | Populates database with initial seed data |
| `npm run db:reset` | `tsx db/reset.ts` | Drops public schema, runs all migrations and seed |
| `npm run db:test` | `node --test ...` | Runs database constraint and schema tests |
| `npm run dev:api` | `npm run dev -w apps/api` | Starts NestJS API application in watch mode |
| `npm run dev:web` | `npm run dev -w apps/web` | Starts Next.js application in dev mode |

## Repository Layout

```text
/
├── apps/
│   ├── api/                 # NestJS application (REST API & OpenAPI)
│   └── web/                 # Next.js App Router application (Tailwind CSS)
├── db/
│   ├── migrations/          # Numbered SQL migration files (001_*.sql ...)
│   ├── seed/                # Seed script & fixtures (seed.ts)
│   ├── tests/               # Schema constraint tests (node:test)
│   ├── migrate.ts           # Migration runner
│   └── reset.ts             # Schema teardown, migrate, and seed
├── references/              # Project blueprints, execution briefs, and documentation
├── .github/                 # PR templates and GitHub workflows
├── docker-compose.yml       # Docker Compose setup for PostgreSQL, MinIO, Redis, apps
├── .env.example             # Template for required environment variables
├── .gitignore               # Ignored directories and build artifacts
├── package.json             # Workspace definition and root scripts
└── README.md                # Project introduction and quick-start guide
```
