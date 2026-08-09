# Developer Handover Checklist

Use this checklist when handing the Cortapp project to an external web development team.

## 1. Share The Codebase

Preferred:

- create a private GitHub repository
- push this project to that repository
- invite the developer team

Alternative:

- send a zip created from the repo root with:

```bash
git archive --format zip --output cortapp-handover.zip HEAD
```

## 2. Share Environment Variables Separately

Provide these privately, not inside public code or public docs:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not provide any frontend team with a Supabase `service_role` key for use in the browser app.

## 3. Share Backend Setup

Provide access to, or copies of:

- `supabase_schema.sql`
- `supabase/migrations`
- any additional SQL run manually in Supabase for newer features

Useful feature areas to confirm in the target database:

- players and matches schema
- seasons and profiles
- chat/messages
- competitions
- holidays via `player_holidays`
- player league participation via `in_league`
- competition court count via `num_courts`

## 4. Share Supabase Access

Choose one:

- give the developers access to the existing Supabase project
- create a new Supabase project and ask them to rebuild it from the SQL files

They will also need:

- auth provider settings
- edge function access if email notifications are required
- project ref if using Supabase CLI

## 5. Email Notifications

If email notifications are needed, also provide:

- Resend account ownership or access
- Supabase CLI access
- the `RESEND_API_KEY` secret in Supabase

The related function is here:

- `supabase/functions/send-email`

## 6. Deployment Notes

Current app setup is suited to:

- Vercel for the frontend
- Supabase for backend services

Recommended production structure:

- marketing site: `cortclub.co.uk`
- app: `app.cortclub.co.uk` or `play.cortclub.co.uk`

## 7. Brand Notes

The app has begun moving toward the Cort Club brand:

- near-black primary shell
- warm off-white background
- yellow accent
- bold headings and stronger CTA styling

Developers should continue that theme across remaining screens for full visual consistency.

## 8. Local Run Commands

From the project root:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## 9. Final Handover Pack

Before sending to developers, provide all of the following:

- repository or zip file
- `.env` values sent privately
- Supabase SQL/schema files
- Supabase project access or rebuild instructions
- domain/deployment expectations
- Cort Club branding direction
- any outstanding feature notes or known issues
