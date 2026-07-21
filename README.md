# IMS AI Platform

MVP skeleton за уеб платформа за автоматизирано внедряване и управление на интегрирани ISO системи:

- ISO 9001
- ISO 14001
- ISO 45001
- ISO/IEC 27001
- ISO 50001

Първата версия включва базов UI, mock данни, Supabase/PostgreSQL schema, AI adapter placeholder и структура за deployment във Vercel.

## Stack

- Frontend: Next.js + React + TypeScript
- UI: Tailwind CSS + lucide-react
- Database/Auth: Supabase PostgreSQL + Supabase Auth
- AI: provider abstraction с `mock` режим и място за Cloudflare AI/OpenAI
- Deployment: Vercel
- Repository: GitHub

## Modules in MVP

- Dashboard с готовност, документи, задачи и одити
- Организации
- ISO стандарти
- Документи
- Шаблони
- Задачи и напомняния
- AI assistant placeholder
- SQL schema/migration за Supabase

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=mock
```

Keep `AI_PROVIDER=mock` until a real Cloudflare/OpenAI adapter is implemented.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Enable email/password auth or the preferred auth providers.
4. Add the Supabase URL and anon key to `.env.local` and Vercel environment variables.

The initial schema includes:

- `organizations`
- `standards`
- `organization_standards`
- `processes`
- `document_templates`
- `documents`
- `tasks`
- `ai_requests`
- `audit_log`

RLS is enabled for the main tables. The first policies are scoped to organization ownership and active templates.

## AI layer

The app exposes `POST /api/ai/draft`.

Expected payload:

```json
{
  "organizationId": "org-1",
  "prompt": "Генерирай оценка на риска за CNC оператор",
  "standards": ["ISO 9001", "ISO 45001"]
}
```

Current behavior:

- `AI_PROVIDER=mock` returns a structured placeholder response.
- Other providers intentionally throw until implemented.

Next implementation step is to add provider-specific calls inside `src/lib/ai.ts`.

## Suggested next phases

1. Connect Supabase reads/writes for organizations, documents, templates and tasks.
2. Add Supabase Auth screens and user-owned organization access.
3. Implement CRUD forms for organizations and standard selection.
4. Add DOCX template generation and PDF export.
5. Implement Cloudflare AI/OpenAI adapter with audit logging.
6. Add real reminder scheduling through email/calendar/SMS provider.
7. Add document versioning UI and approval workflow.

## Deployment

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Add the same environment variables from `.env.example`.
4. Deploy.
