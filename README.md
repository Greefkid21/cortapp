# Cortapp

League and competition management web app for padel clubs, built with React, TypeScript, Vite, Tailwind, and Supabase.

## What This Repo Contains

- League standings and player profiles
- Fixture generation and match result entry
- Competitions, holidays, rules, chat, and season management
- Supabase-backed auth, database, and edge function integration

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Vercel-ready frontend deployment

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file:

```bash
cp .env.example .env
```

3. Add your Supabase values to `.env`:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

4. Start the app locally:

```bash
npm run dev
```

5. Build for production:

```bash
npm run build
```

## Important Files

- `SETUP.md`: full Supabase and email setup guide
- `supabase_schema.sql`: base database schema and RLS policies
- `supabase/migrations`: additional SQL migrations used during development
- `supabase/functions/send-email`: Supabase Edge Function for email notifications
- `docs/DEVELOPER_HANDOVER.md`: checklist for handing this project to an external web team

## Environment Variables

Frontend environment variables used by this app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not place Supabase `service_role` keys in the frontend app or in any public repository.

## Supabase Setup

Use `SETUP.md` as the primary setup guide.

At a minimum, developers will need to:

- create or access a Supabase project
- run the SQL in `supabase_schema.sql`
- review and apply SQL in `supabase/migrations`
- configure authentication
- deploy the `send-email` edge function if email notifications are required

## Deployment

This frontend is configured for Vercel SPA routing via `vercel.json`.

Recommended production setup:

- main site: `cortclub.co.uk`
- app: `app.cortclub.co.uk` or `play.cortclub.co.uk`

## Handover Recommendation

The cleanest way to share this project with web developers is:

1. Put this codebase in a private Git repository
2. Share repository access with the developers
3. Send `.env` values separately
4. Share Supabase project access or SQL setup files separately
5. Include the handover checklist in `docs/DEVELOPER_HANDOVER.md`

## Optional Zip Export

If you need to send the code without Git, create a clean archive from the project root:

```bash
git archive --format zip --output cortapp-handover.zip HEAD
```

That creates a zip of the tracked code without local build artifacts.
