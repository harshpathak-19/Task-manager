# Task Manager

A simple task management web app: users sign in with Google, create tasks,
assign them to other users, and get email notifications when a task is
created or completed.

## Architecture

```
┌─────────────┐        ┌──────────────┐        ┌────────────────┐
│  Next.js    │  REST  │    Flask     │  SQL   │    Supabase     │
│  Frontend   │◄──────►│   Backend    │◄──────►│  (Postgres +    │
│ (TypeScript)│  JWT   │              │        │   Auth)         │
└─────────────┘        └──────┬───────┘        └────────┬────────┘
                               │                          │
                               │ SMTP                     │ Google OAuth
                               ▼                          ▼
                          Gmail (send)              Google Sign-In
```

**Auth flow:** The frontend never talks to a custom auth server — it
calls `supabase.auth.signInWithOAuth({ provider: "google" })`, which
redirects to Google's consent screen and back. Supabase issues a JWT
("access token") for the logged-in user. That token is sent as
`Authorization: Bearer <token>` on every request to the Flask backend.
The backend verifies the token's signature using the project's JWT
secret (see `backend/auth.py`) — this proves the request really came
from that authenticated user, without the backend needing to call
Supabase over the network on every request.

**Data flow:** The backend uses Supabase's Python client with the
**service role key** (full DB access, bypasses Row Level Security)
because the backend already does its own authorization checks in each
route — e.g. only a task's creator can assign it; only the creator or
assignee can mark it complete. RLS policies in
`migrations/001_init.sql` still protect the tables in case anything
ever queries Supabase directly from the frontend.

**Email flow:** When a task is created with an assignee, or assigned
after the fact, the backend sends the assignee an email via Gmail SMTP
(`backend/email_utils.py`). When a task is marked complete, the
creator gets a notification email. This uses a Gmail **app password**
rather than the full Gmail API OAuth flow — simpler to set up for a
single sending account, at the cost of not being able to send "as" a
logged-in user.

## Project structure

```
backend/            Flask API
  app.py            Routes: list/create/assign/complete tasks
  auth.py            Verifies Supabase JWTs
  email_utils.py     Gmail SMTP notifications
  requirements.txt
  .env.example

frontend/           Next.js (TypeScript)
  pages/index.tsx     Login page (Google OAuth button)
  pages/dashboard.tsx Task list, create form, assign, complete
  lib/supabaseClient.ts
  .env.example

migrations/
  001_init.sql       profiles + tasks tables, trigger, RLS policies
```

## Setup

1. **Supabase**: create a project at supabase.com. In the SQL Editor,
   run `migrations/001_init.sql`. In Authentication > Providers,
   enable Google and follow Supabase's guide to create a Google Cloud
   OAuth Client ID (Authentication > Providers > Google has a link to
   the exact steps).
2. **Backend**: `cd backend && pip install -r requirements.txt`, copy
   `.env.example` to `.env` and fill it in (Supabase URL/keys from
   Project Settings > API; Gmail app password from
   myaccount.google.com/apppasswords), then `python app.py`.
3. **Frontend**: `cd frontend && npm install`, copy `.env.example` to
   `.env.local` and fill it in, then `npm run dev`.
4. **Deploy**: frontend → Vercel, backend → Railway or Render (set the
   same env vars there), Supabase is already hosted. Update
   `NEXT_PUBLIC_API_URL` and `FRONTEND_ORIGIN` to the deployed URLs.

## Known trade-offs (worth mentioning in interview)

- Email uses Gmail SMTP + app password instead of the full Gmail API
  OAuth flow, for simplicity.
- The Flask backend uses the Supabase service-role key and does its
  own authorization checks per route, rather than relying solely on
  Postgres RLS.
