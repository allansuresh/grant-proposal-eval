# Proposal Evaluator

A web app for uploading a grant proposal, extracting a structured summary, scoring it
with an LLM against a rubric, and measuring how reliable those scores are.

**Status:** Phase 1 of 6 (project setup, database, sign-in and roles).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon) via Prisma 6 |
| Auth | Auth.js v5, email + password, JWT sessions |
| Validation | Zod |
| Tests | Vitest |

## Run it locally

You need **Node.js 20 or newer** (`node -v` to check) and a free [Neon](https://neon.tech) account.

1. **Install dependencies.** This also downloads Prisma's engine automatically.

   ```bash
   npm install
   ```

2. **Create a database.** In Neon, create a project and copy its connection string
   (Dashboard → Connect). It looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`.

3. **Configure environment variables.**

   ```bash
   cp .env.example .env
   npx auth secret          # writes AUTH_SECRET into .env.local
   ```

   Then edit `.env`: paste the Neon URL into `DATABASE_URL`, and set `DEMO_PASSWORD`
   to anything with 10+ characters.

   > `npx auth secret` writes to `.env.local`. Next.js reads both files, but the Prisma
   > CLI only reads `.env`. That's fine here, because Prisma doesn't need `AUTH_SECRET`.

4. **Create the tables and demo accounts.**

   ```bash
   npx prisma migrate dev --name init   # creates prisma/migrations/ and applies it
   npx prisma db seed                    # creates the two demo users
   ```

5. **Start the app** and open http://localhost:3000.

   ```bash
   npm run dev
   ```

### Checking your work

```bash
npm run check   # prisma generate → type-check → lint → unit tests
```

Useful extras: `npx prisma studio` opens a browser view of your database tables.

## Demo accounts

| Email | Role |
| --- | --- |
| demo-admin@example.com | admin: sees all proposals, manages users |
| demo-evaluator@example.com | evaluator: sees only their own proposals |

Both use `DEMO_PASSWORD`. The login page also has one-click demo buttons, which read
the password on the server so it never reaches the browser.

## How access control works

- `src/middleware.ts` redirects signed-out visitors to `/login`. This is a **convenience
  only**.
- The actual security boundary is `requireUser()` / `requireAdmin()` in
  `src/lib/auth/session.ts`, called at the top of every page **and every server action**.
  Server actions are public POST endpoints, so hiding a button is not protection.
- The rules themselves (`isAdmin`, `proposalScope`, `canAccessProposal`) are pure
  functions in `src/lib/auth/permissions.ts`, unit-tested in `tests/permissions.test.ts`.
- Non-admins get a 404 on admin pages rather than a 403, so they can't confirm the
  pages exist.
- Sign-up is invite-only: admins create accounts at `/admin/users`.

## Project layout

```
prisma/
  schema.prisma        data model (all tables, defined up front)
  seed.ts              creates the demo accounts
src/
  auth.config.ts       edge-safe Auth.js config (used by middleware)
  auth.ts              full Auth.js config with the password check
  middleware.ts        redirects signed-out users
  lib/
    db.ts              shared Prisma client
    auth/              permissions (pure), password hashing, session guards
    validation/        Zod schemas for form input
  app/
    login/             sign-in page and server actions
    admin/users/       admin-only user management
tests/                 Vitest unit tests
analysis/              Python scripts for offline statistics (later phases)
```

## Data and privacy

This is a demo. Upload synthetic or publicly available documents only, never real
applicant data. A notice saying so appears on every page.

## Python analysis scripts

The web app is Node.js only. The `analysis/` folder will hold Python scripts that
cross-check the app's statistics. To set them up:

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r analysis/requirements.txt
```
